begin;

alter table public.profiles add column if not exists is_locked boolean not null default false;
alter table public.profiles add column if not exists active_session_id text;

-- Enable globally only after deploying the server login/session endpoints.
create table if not exists public.academy_security_config (
  id boolean primary key default true check (id),
  enforce_sessions boolean not null default false
);
insert into public.academy_security_config(id) values(true) on conflict do nothing;
alter table public.academy_security_config enable row level security;
revoke all on public.academy_security_config from public, anon, authenticated;
grant all on public.academy_security_config to service_role;

create table if not exists public.user_security_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address text not null check (length(ip_address) <= 45),
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id, ip_address)
);
create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.parental_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  consent_text text not null,
  accepted_at timestamptz not null default now()
);

create or replace function public.academy_session_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active and not p.is_locked
    and (
      (p.active_session_id is null and not (select enforce_sessions from public.academy_security_config where id))
      or p.active_session_id = (auth.jwt() ->> 'session_id')
    )
  );
$$;
revoke all on function public.academy_session_allowed() from public, anon;
grant execute on function public.academy_session_allowed() to authenticated, service_role;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.academy_session_allowed() and exists (
    select 1 from public.profiles where id = auth.uid() and role in ('teacher','profesor')
  );
$$;
create or replace function public.is_inspector()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.academy_session_allowed() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'inspector'
  );
$$;
create or replace function public.academy_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.academy_session_allowed();
$$;

create or replace function public.academy_check_session(
  p_user_id uuid, p_session_id text, p_ip text, p_user_agent text, p_register boolean default false
) returns text language plpgsql security definer set search_path = '' as $$
declare
  account public.profiles%rowtype;
  ip_count integer;
begin
  if p_session_id is null or p_session_id !~ '^[0-9a-fA-F-]{36}$' or p_ip is null or length(p_ip) > 45 then
    raise exception 'Invalid security context';
  end if;
  perform p_ip::inet;
  select * into account from public.profiles where id = p_user_id for update;
  if not found then return 'missing_profile'; end if;
  if account.is_locked then return 'locked'; end if;
  if not account.is_active then return 'inactive'; end if;
  if not p_register and account.active_session_id is distinct from p_session_id then return 'replaced'; end if;

  insert into public.user_security_logs(user_id, ip_address, user_agent)
  values(p_user_id, host(p_ip::inet), left(p_user_agent, 400))
  on conflict(user_id, ip_address) do nothing;
  select count(*) into ip_count from public.user_security_logs where user_id = p_user_id;
  if ip_count > 2 then
    update public.profiles set is_locked = true, active_session_id = null where id = p_user_id;
    insert into public.security_alerts(user_id, reason) values(p_user_id, 'more_than_two_ips');
    return 'locked';
  end if;
  if p_register then
    update public.profiles set active_session_id = p_session_id where id = p_user_id;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.academy_check_session(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.academy_check_session(uuid,text,text,text,boolean) to service_role;

create or replace function public.academy_end_session(p_user_id uuid, p_session_id text)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set active_session_id = 'signed-out'
  where id = p_user_id and active_session_id = p_session_id;
$$;
revoke all on function public.academy_end_session(uuid,text) from public, anon, authenticated;
grant execute on function public.academy_end_session(uuid,text) to service_role;

create or replace function public.protect_academy_security_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is not null
    and (new.is_locked is distinct from old.is_locked or new.active_session_id is distinct from old.active_session_id) then
    raise exception 'Security fields can only be changed by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_academy_security_fields on public.profiles;
create trigger protect_academy_security_fields before update on public.profiles
for each row execute function public.protect_academy_security_fields();

create or replace function public.require_parental_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only the Auth Admin API can set app_metadata; teachers provision accounts separately.
  if new.raw_app_meta_data -> 'academy_provisioned' = 'true'::jsonb then return new; end if;
  if not (select enforce_sessions from public.academy_security_config where id)
    and new.raw_user_meta_data -> 'parental_consent' is null then return new; end if;
  if new.raw_user_meta_data -> 'parental_consent' is distinct from 'true'::jsonb
    or new.raw_user_meta_data ->> 'consent_version' is distinct from '2026-10-20' then
    raise exception 'Parental consent is required';
  end if;
  insert into public.parental_consents(user_id, policy_version, consent_text)
  values(new.id, '2026-10-20', 'Confirm că sunt părintele/tutorele legal și sunt de acord cu prelucrarea datelor minorului conform GDPR.');
  return new;
end;
$$;
drop trigger if exists require_parental_consent on auth.users;
create trigger require_parental_consent after insert on auth.users
for each row execute function public.require_parental_consent();

-- Restrictive policies intersect existing assignment/teacher policies; they never widen access.
do $$
declare target record;
begin
  for target in select tablename from pg_tables where schemaname = 'public'
    and tablename not in ('academy_security_config','user_security_logs','security_alerts','parental_consents')
    and rowsecurity
  loop
    execute format('drop policy if exists academy_valid_session on public.%I', target.tablename);
    execute format('create policy academy_valid_session on public.%I as restrictive for all to authenticated using (public.academy_session_allowed()) with check (public.academy_session_allowed())', target.tablename);
  end loop;
end;
$$;
drop policy if exists academy_valid_session on storage.objects;
create policy academy_valid_session on storage.objects as restrictive for all to authenticated
using (public.academy_session_allowed()) with check (public.academy_session_allowed());

do $$
declare target text;
begin
  foreach target in array array['user_security_logs','security_alerts','parental_consents'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on public.%I from public, anon, authenticated', target);
    execute format('grant select on public.%I to authenticated', target);
    execute format('grant all on public.%I to service_role', target);
    execute format('drop policy if exists security_teacher_read on public.%I', target);
    execute format('create policy security_teacher_read on public.%I for select to authenticated using (public.is_teacher())', target);
  end loop;
  if to_regclass('public.lessons') is not null then
    alter table public.lessons enable row level security;
    drop policy if exists academy_valid_session on public.lessons;
    create policy academy_valid_session on public.lessons as restrictive for all to authenticated
      using(public.academy_session_allowed()) with check(public.academy_session_allowed());
    drop policy if exists academy_teacher_write on public.lessons;
    create policy academy_teacher_write on public.lessons for all to authenticated
      using(public.is_teacher()) with check(public.is_teacher());
    drop policy if exists academy_student_no_insert on public.lessons;
    create policy academy_student_no_insert on public.lessons as restrictive for insert to authenticated with check(public.is_teacher());
    drop policy if exists academy_student_no_update on public.lessons;
    create policy academy_student_no_update on public.lessons as restrictive for update to authenticated using(public.is_teacher()) with check(public.is_teacher());
    drop policy if exists academy_student_no_delete on public.lessons;
    create policy academy_student_no_delete on public.lessons as restrictive for delete to authenticated using(public.is_teacher());
  end if;
end;
$$;

create or replace function public.start_activity_session(p_user_agent text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.academy_session_allowed() then raise exception 'Unauthorized' using errcode = '42501'; end if;
  insert into public.activity_sessions(user_id, user_agent)
  values(auth.uid(), left(coalesce(p_user_agent, ''), 400)) returning id into v_id;
  return v_id;
end;
$$;
create or replace function public.touch_activity_session(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.academy_session_allowed() then raise exception 'Unauthorized' using errcode = '42501'; end if;
  update public.activity_sessions set last_seen_at = now(),
    duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
  where id = p_session and user_id = auth.uid();
end;
$$;

commit;

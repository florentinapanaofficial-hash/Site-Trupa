begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('teacher','student','profesor','elev','inspector'));
alter table public.profiles alter column role set default 'elev';

create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and role in ('teacher','profesor'));
$$;
create or replace function public.is_inspector() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and role = 'inspector');
$$;
create or replace function public.academy_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;
revoke all on function public.is_teacher(), public.is_inspector(), public.academy_active() from public, anon;
grant execute on function public.is_teacher(), public.is_inspector(), public.academy_active() to authenticated;

create or replace function public.can_access_piece(p_piece uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.academy_active() and (public.is_teacher() or exists(select 1 from public.pieces where id = p_piece and is_published));
$$;
drop policy if exists pieces_select on public.pieces;
create policy pieces_select on public.pieces for select to authenticated using (public.academy_active() and (is_published or public.is_teacher()));
drop policy if exists group_pieces_select on public.group_pieces;
create policy group_pieces_select on public.group_pieces for select to authenticated using (public.academy_active());
drop policy if exists study_groups_select on public.study_groups;
create policy study_groups_select on public.study_groups for select to authenticated using (public.academy_active());
drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources for select to authenticated using (public.academy_active());
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_teacher() or public.is_inspector());

create table if not exists public.online_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 15 and 240),
  timezone text not null default 'Europe/Bucharest' check (timezone = 'Europe/Bucharest'),
  created_at timestamptz not null default now()
);
create table if not exists public.online_group_members (
  group_id uuid not null references public.online_groups(id) on delete cascade,
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  primary key(group_id, student_id)
);
create or replace function public.can_join_online_group(group_uuid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.academy_active() and exists(select 1 from public.online_groups where id = group_uuid)
    and (public.is_teacher() or public.is_inspector() or exists(select 1 from public.online_group_members where group_id = group_uuid and student_id = auth.uid()));
$$;
revoke all on function public.can_join_online_group(uuid) from public, anon;
grant execute on function public.can_join_online_group(uuid) to authenticated;
alter table public.online_groups enable row level security;
alter table public.online_group_members enable row level security;
revoke all on public.online_groups, public.online_group_members from anon, authenticated;
grant select, insert, update, delete on public.online_groups, public.online_group_members to authenticated;
drop policy if exists online_groups_read on public.online_groups;
create policy online_groups_read on public.online_groups for select to authenticated using (public.can_join_online_group(id));
drop policy if exists online_groups_manage on public.online_groups;
create policy online_groups_manage on public.online_groups for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists online_members_read on public.online_group_members;
create policy online_members_read on public.online_group_members for select to authenticated using (public.is_teacher() or public.is_inspector() or (public.academy_active() and student_id = auth.uid()));
drop policy if exists online_members_manage on public.online_group_members;
create policy online_members_manage on public.online_group_members for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create or replace function public.save_online_group(group_uuid uuid, group_name text, day_number smallint, lesson_time time, minutes smallint, students uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
  if not public.is_teacher() then raise exception 'Acces refuzat'; end if;
  if students is null or cardinality(students) > 200 then raise exception 'Lista elevilor este invalidă'; end if;
  if exists(select 1 from unnest(students) requested(id) left join public.profiles profile on profile.id = requested.id
    where profile.id is null or not profile.is_active or profile.role not in ('student','elev')) then raise exception 'Selectează numai elevi activi'; end if;
  if group_uuid is null then
    insert into public.online_groups(name,weekday,start_time,duration_minutes) values(trim(group_name),day_number,lesson_time,minutes) returning id into saved_id;
  else
    update public.online_groups set name=trim(group_name),weekday=day_number,start_time=lesson_time,duration_minutes=minutes where id=group_uuid returning id into saved_id;
    if saved_id is null then raise exception 'Grupă inexistentă'; end if;
  end if;
  delete from public.online_group_members where group_id=saved_id;
  insert into public.online_group_members(group_id,student_id) select saved_id,student_id from (select distinct unnest(students) student_id) selected;
  return saved_id;
end;
$$;
revoke all on function public.save_online_group(uuid,text,smallint,time,smallint,uuid[]) from public, anon;
grant execute on function public.save_online_group(uuid,text,smallint,time,smallint,uuid[]) to authenticated;

do $$
declare target text;
begin
  foreach target in array array['profiles','pieces','study_groups','group_pieces','group_members','student_pieces','resources','submissions','quiz_results','quizzes','quiz_questions','student_homework','online_groups','online_group_members'] loop
    execute format('drop policy if exists inspector_no_insert on public.%I', target);
    execute format('create policy inspector_no_insert on public.%I as restrictive for insert to authenticated with check (public.academy_active() and not public.is_inspector())', target);
    execute format('drop policy if exists inspector_no_update on public.%I', target);
    execute format('create policy inspector_no_update on public.%I as restrictive for update to authenticated using (public.academy_active() and not public.is_inspector()) with check (public.academy_active() and not public.is_inspector())', target);
    execute format('drop policy if exists inspector_no_delete on public.%I', target);
    execute format('create policy inspector_no_delete on public.%I as restrictive for delete to authenticated using (public.academy_active() and not public.is_inspector())', target);
  end loop;
end;
$$;
drop policy if exists inspector_no_insert on storage.objects;
create policy inspector_no_insert on storage.objects as restrictive for insert to authenticated with check (public.academy_active() and not public.is_inspector());
drop policy if exists inspector_no_update on storage.objects;
create policy inspector_no_update on storage.objects as restrictive for update to authenticated using (public.academy_active() and not public.is_inspector()) with check (public.academy_active() and not public.is_inspector());
drop policy if exists inspector_no_delete on storage.objects;
create policy inspector_no_delete on storage.objects as restrictive for delete to authenticated using (public.academy_active() and not public.is_inspector());

commit;
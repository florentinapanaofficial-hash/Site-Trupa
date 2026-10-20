begin;

alter table public.profiles
  add column if not exists study_level text not null default 'incepator';
alter table public.profiles drop constraint if exists profiles_study_level_check;
alter table public.profiles add constraint profiles_study_level_check
  check (study_level in ('incepator', 'mediu', 'avansat'));

create or replace function public.study_level_rank(p_level text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_level, '')))
    when 'incepator' then 1::smallint
    when 'începător' then 1::smallint
    when 'mediu' then 2::smallint
    when 'intermediar' then 2::smallint
    when 'avansat' then 3::smallint
    else null::smallint
  end;
$$;

create or replace function public.protect_student_profile_controls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.id and not public.is_teacher() and (
    new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.grade_level is distinct from old.grade_level
    or new.study_level is distinct from old.study_level
    or new.avatar_path is distinct from old.avatar_path
  ) then
    raise exception 'Aceste setări de profil pot fi schimbate numai de profesor.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_student_profile_controls() from public, anon, authenticated;

drop trigger if exists protect_student_profile_controls on public.profiles;
create trigger protect_student_profile_controls
  before update on public.profiles
  for each row execute function public.protect_student_profile_controls();

create or replace function public.get_my_study_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_next text;
  v_assigned integer;
  v_completed integer;
begin
  select p.study_level into v_level
  from public.profiles p
  where p.id = auth.uid() and p.is_active and p.role in ('student', 'elev');

  if v_level is null or not public.academy_active() then
    raise exception 'Progresul este disponibil numai elevilor activi.' using errcode = '42501';
  end if;

  v_next := case v_level when 'incepator' then 'mediu' when 'mediu' then 'avansat' else null end;

  with assigned as (
    select sp.piece_id
    from public.student_pieces sp
    where sp.student_id = auth.uid()
    union
    select gp.piece_id
    from public.group_members gm
    join public.group_pieces gp on gp.group_id = gm.group_id
    where gm.student_id = auth.uid()
  ), current_level_pieces as (
    select distinct a.piece_id
    from assigned a
    join public.pieces p on p.id = a.piece_id
    where p.is_published and p.level = v_level
  ), submitted as (
    select c.piece_id
    from public.catalog_teme c
    join current_level_pieces a on a.piece_id = c.piece_id
    where c.student_id = auth.uid() and c.piece_id is not null
    union
    select s.piece_id
    from public.submissions s
    join current_level_pieces a on a.piece_id = s.piece_id
    where s.student_id = auth.uid() and s.media_type in ('audio', 'video')
  )
  select (select count(*)::integer from current_level_pieces),
         (select count(*)::integer from submitted)
    into v_assigned, v_completed;

  return jsonb_build_object(
    'study_level', v_level,
    'next_level', v_next,
    'assigned_count', coalesce(v_assigned, 0),
    'completed_count', coalesce(v_completed, 0),
    'next_level_unlocked', v_next is not null and coalesce(v_assigned, 0) > 0 and coalesce(v_completed, 0) >= coalesce(v_assigned, 0)
  );
end;
$$;
revoke all on function public.get_my_study_progress() from public, anon;
grant execute on function public.get_my_study_progress() to authenticated;

create or replace function public.can_access_piece(p_piece uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_level text;
  v_piece_level text;
  v_published boolean;
  v_progress jsonb;
  v_unlocked_rank smallint;
begin
  if auth.uid() is null or not public.academy_active() then
    return false;
  end if;
  if public.is_teacher() then
    return true;
  end if;

  select p.role into v_role from public.profiles p where p.id = auth.uid();
  if v_role not in ('student', 'elev') then
    return exists (
      select 1 from public.student_pieces sp where sp.student_id = auth.uid() and sp.piece_id = p_piece
      union all
      select 1 from public.group_members gm join public.group_pieces gp on gp.group_id = gm.group_id
      where gm.student_id = auth.uid() and gp.piece_id = p_piece
    );
  end if;

  select p.level, p.is_published into v_piece_level, v_published
  from public.pieces p where p.id = p_piece;
  if not found or not v_published then
    return false;
  end if;

  if public.study_level_rank(v_piece_level) is null then
    return exists (
      select 1 from public.student_pieces sp where sp.student_id = auth.uid() and sp.piece_id = p_piece
      union all
      select 1 from public.group_members gm join public.group_pieces gp on gp.group_id = gm.group_id
      where gm.student_id = auth.uid() and gp.piece_id = p_piece
    );
  end if;

  v_progress := public.get_my_study_progress();
  v_level := v_progress ->> 'study_level';
  v_unlocked_rank := public.study_level_rank(v_level)
    + case when (v_progress ->> 'next_level_unlocked')::boolean then 1 else 0 end;
  return public.study_level_rank(v_piece_level) <= v_unlocked_rank;
end;
$$;
revoke all on function public.can_access_piece(uuid) from public, anon;
grant execute on function public.can_access_piece(uuid) to authenticated;

-- Metadata for published repertoire is visible; audio/PDF access remains gated by can_access_piece.
drop policy if exists pieces_select on public.pieces;
create policy pieces_select on public.pieces
  for select to authenticated
  using (public.academy_active() and (is_published or public.is_teacher()));

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
using (bucket_id = 'avatars' and public.academy_active() and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and public.academy_active()
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp'));
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and public.academy_active() and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher()));

-- The private channel exposes only ephemeral presence for active signed-in members.
drop policy if exists academy_online_presence_read on realtime.messages;
create policy academy_online_presence_read on realtime.messages for select to authenticated
using (extension = 'presence' and realtime.topic() = 'academy:online' and public.academy_active());
drop policy if exists academy_online_presence_write on realtime.messages;
create policy academy_online_presence_write on realtime.messages for insert to authenticated
with check (extension = 'presence' and realtime.topic() = 'academy:online' and public.academy_active());

commit;

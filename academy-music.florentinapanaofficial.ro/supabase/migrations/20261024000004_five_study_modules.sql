begin;

create or replace function public.study_level_rank(p_level text)
returns smallint language sql immutable set search_path = '' as $$
  select case lower(trim(coalesce(p_level, '')))
    when 'modul_1' then 1::smallint
    when 'modul_2' then 2::smallint
    when 'modul_3' then 3::smallint
    when 'modul_4' then 4::smallint
    when 'modul_5' then 5::smallint
    when 'incepator' then 1::smallint
    when 'începător' then 1::smallint
    when 'mediu' then 3::smallint
    when 'intermediar' then 3::smallint
    when 'avansat' then 4::smallint
    else null::smallint
  end;
$$;
revoke all on function public.study_level_rank(text) from public, anon;
grant execute on function public.study_level_rank(text) to authenticated, service_role;

alter table public.profiles drop constraint if exists profiles_study_level_check;
alter table public.pieces drop constraint if exists pieces_level_check;

-- Keep the meaning of historical levels: intermediate -> 3, advanced -> 4.
update public.profiles set study_level = 'modul_' || public.study_level_rank(study_level)::text
where study_level not in ('modul_1','modul_2','modul_3','modul_4','modul_5')
  and public.study_level_rank(study_level) is not null;
update public.pieces set level = 'modul_' || public.study_level_rank(level)::text
where level not in ('modul_1','modul_2','modul_3','modul_4','modul_5')
  and public.study_level_rank(level) is not null;

alter table public.profiles alter column study_level set default 'modul_1';
alter table public.pieces alter column level set default 'modul_1';
alter table public.profiles add constraint profiles_study_level_check
  check (study_level in ('modul_1','modul_2','modul_3','modul_4','modul_5'));
alter table public.pieces add constraint pieces_level_check
  check (level in ('modul_1','modul_2','modul_3','modul_4','modul_5'));

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

  v_next := case when public.study_level_rank(v_level) < 5
    then 'modul_' || (public.study_level_rank(v_level) + 1)::text else null end;

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


commit;

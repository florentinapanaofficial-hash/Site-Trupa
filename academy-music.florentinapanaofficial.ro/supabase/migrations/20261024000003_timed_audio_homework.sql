begin;

create or replace function public.valid_piano_events(events jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if events is null or jsonb_typeof(events) <> 'array' then return false; end if;
  if jsonb_array_length(events) not between 1 and 2000 or octet_length(events::text) > 200000 then return false; end if;
  for item in select value from jsonb_array_elements(events) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if not (item ?& array['note','timestamp','duration']) or item - array['note','timestamp','duration'] <> '{}'::jsonb then return false; end if;
    if jsonb_typeof(item->'note') <> 'number' or jsonb_typeof(item->'timestamp') <> 'number' or jsonb_typeof(item->'duration') <> 'number' then return false; end if;
    if (item->>'note') !~ '^(4[89]|[5-7][0-9]|8[0-4])$' then return false; end if;
    if (item->>'timestamp')::numeric < 0 or (item->>'duration')::numeric < 1 then return false; end if;
    if (item->>'timestamp')::numeric + (item->>'duration')::numeric > 300000 then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.valid_piano_events(jsonb) from public, anon;
grant execute on function public.valid_piano_events(jsonb) to authenticated;

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_start timestamptz not null,
  submission_end timestamptz not null,
  created_at timestamptz not null default now(),
  check (isfinite(submission_start) and isfinite(submission_end) and submission_start < submission_end)
);
create index if not exists homework_assignments_student_idx on public.homework_assignments(student_id, submission_start desc);
alter table public.homework_assignments enable row level security;
revoke all on public.homework_assignments from public, anon, authenticated;
grant select, insert on public.homework_assignments to authenticated;
grant all on public.homework_assignments to service_role;
drop policy if exists homework_assignments_session on public.homework_assignments;
create policy homework_assignments_session on public.homework_assignments as restrictive for all to authenticated
  using (public.academy_session_allowed() and public.academy_active())
  with check (public.academy_session_allowed() and public.academy_active());
drop policy if exists homework_assignments_read on public.homework_assignments;
create policy homework_assignments_read on public.homework_assignments for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());
drop policy if exists homework_assignments_insert on public.homework_assignments;
create policy homework_assignments_insert on public.homework_assignments for insert to authenticated
  with check (public.is_teacher() and exists (select 1 from public.profiles where id = student_id and role in ('student', 'elev')));

create table if not exists public.student_homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null default gen_random_uuid(),
  events jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, attempt_id)
);
alter table public.student_homework
  add column if not exists student_id uuid references public.profiles(id) on delete cascade,
  add column if not exists audio_path text,
  add column if not exists submission_start timestamptz,
  add column if not exists submission_end timestamptz,
  add column if not exists status text not null default 'pending',
  add column if not exists teacher_feedback text,
  add column if not exists assignment_id uuid references public.homework_assignments(id);
alter table public.student_homework alter column events drop not null;
alter table public.student_homework drop constraint if exists student_homework_events_check;
alter table public.student_homework add constraint student_homework_events_check check (events is null or public.valid_piano_events(events));
alter table public.student_homework alter column student_id set not null;
alter table public.student_homework alter column attempt_id set default gen_random_uuid();
alter table public.student_homework alter column status set default 'pending';
alter table public.student_homework alter column status set not null;
alter table public.student_homework drop constraint if exists student_homework_status_check;
alter table public.student_homework add constraint student_homework_status_check check (status in ('pending', 'approved', 'rejected'));
alter table public.student_homework drop constraint if exists student_homework_audio_shape;
alter table public.student_homework add constraint student_homework_audio_shape check (
  (audio_path is null and assignment_id is null and submission_start is null and submission_end is null and events is not null)
  or (audio_path is not null and assignment_id is not null and events is null
    and submission_start is not null and submission_end is not null
    and isfinite(submission_start) and isfinite(submission_end) and submission_start < submission_end)
);
create unique index if not exists homework_assignment_once_idx on public.student_homework(assignment_id);
create index if not exists homework_student_idx on public.student_homework(student_id, created_at desc);

-- Dates are trusted only when they match an assignment created by a teacher.
create or replace function public.homework_window_open(p_assignment text, p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.homework_assignments a join public.profiles p on p.id = a.student_id
    where a.id::text = p_assignment and a.student_id = p_student
      and p.id = auth.uid() and p.role in ('student', 'elev') and p.is_active
      and now() >= a.submission_start and now() <= a.submission_end
  );
$$;
revoke all on function public.homework_window_open(text, uuid) from public, anon;
grant execute on function public.homework_window_open(text, uuid) to authenticated;

alter table public.student_homework enable row level security;
revoke all on public.student_homework from public, anon, authenticated;
grant select, insert on public.student_homework to authenticated;
grant update (status, teacher_feedback) on public.student_homework to authenticated;
grant all on public.student_homework to service_role;
drop policy if exists homework_session on public.student_homework;
create policy homework_session on public.student_homework as restrictive for all to authenticated
  using (public.academy_session_allowed() and public.academy_active())
  with check (public.academy_session_allowed() and public.academy_active());
drop policy if exists homework_read on public.student_homework;
create policy homework_read on public.student_homework for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());
drop policy if exists homework_insert on public.student_homework;
create policy homework_insert on public.student_homework for insert to authenticated
  with check (student_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('student', 'elev') and is_active));
-- The existing MIDI event log remains separate from timed audio homework.
drop policy if exists homework_insert_guard on public.student_homework;
create policy homework_insert_guard on public.student_homework as restrictive for insert to authenticated with check (
  student_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('student', 'elev') and is_active)
  and status = 'pending' and teacher_feedback is null and (
    (audio_path is null and assignment_id is null and events is not null)
    or (audio_path is not null and student_id = auth.uid()
      and now() >= submission_start and now() <= submission_end
      and public.homework_window_open(assignment_id::text, student_id)
      and exists (select 1 from public.homework_assignments a where a.id = assignment_id
        and a.student_id = student_homework.student_id
        and a.submission_start = student_homework.submission_start and a.submission_end = student_homework.submission_end)
      and split_part(audio_path, '/', 1) = auth.uid()::text
      and split_part(audio_path, '/', 2) = assignment_id::text
      and exists (select 1 from storage.objects o where o.bucket_id = 'homework-audio' and o.name = audio_path))
  )
);
drop policy if exists homework_update_teacher on public.student_homework;
create policy homework_update_teacher on public.student_homework for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists homework_update_guard on public.student_homework;
create policy homework_update_guard on public.student_homework as restrictive for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create or replace function public.protect_homework_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and
    (to_jsonb(new) - array['status', 'teacher_feedback']) is distinct from
    (to_jsonb(old) - array['status', 'teacher_feedback']) then
    raise exception 'Only homework status and teacher feedback can be updated.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_homework_submission() from public, anon, authenticated;
drop trigger if exists protect_homework_submission on public.student_homework;
create trigger protect_homework_submission before update on public.student_homework
  for each row execute function public.protect_homework_submission();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('homework-audio', 'homework-audio', false, 31457280,
  array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists homework_audio_read on storage.objects;
create policy homework_audio_read on storage.objects for select to authenticated using (
  bucket_id = 'homework-audio' and public.academy_active()
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_teacher())
);
drop policy if exists homework_audio_read_guard on storage.objects;
create policy homework_audio_read_guard on storage.objects as restrictive for select to authenticated using (
  bucket_id <> 'homework-audio' or (public.academy_session_allowed() and public.academy_active()
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_teacher()))
);
drop policy if exists homework_audio_insert on storage.objects;
create policy homework_audio_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'homework-audio' and public.academy_active()
  and split_part(name, '/', 1) = auth.uid()::text
  and public.homework_window_open(split_part(name, '/', 2), auth.uid())
  and not exists (select 1 from public.student_homework h where h.assignment_id::text = split_part(name, '/', 2))
);
-- Prevent older permissive Storage policies from bypassing the deadline.
drop policy if exists homework_audio_insert_guard on storage.objects;
create policy homework_audio_insert_guard on storage.objects as restrictive for insert to authenticated with check (
  bucket_id <> 'homework-audio' or (public.academy_session_allowed() and public.academy_active()
    and split_part(name, '/', 1) = auth.uid()::text
    and public.homework_window_open(split_part(name, '/', 2), auth.uid())
    and not exists (select 1 from public.student_homework h where h.assignment_id::text = split_part(name, '/', 2)))
);
drop policy if exists homework_audio_immutable on storage.objects;
create policy homework_audio_immutable on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'homework-audio') with check (bucket_id <> 'homework-audio');
drop policy if exists homework_audio_delete_guard on storage.objects;
create policy homework_audio_delete_guard on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'homework-audio');

commit;

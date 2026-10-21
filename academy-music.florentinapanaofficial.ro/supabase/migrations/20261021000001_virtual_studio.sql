do $$
begin
  create type public.studio_request_status as enum (
    'pending',
    'processing',
    'completed'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.studio_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  song_id uuid not null references public.pieces (id) on delete restrict,
  raw_audio_url text not null,
  final_audio_url text,
  status public.studio_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  notification_seen_at timestamptz,
  constraint studio_requests_completed_has_master
    check (status <> 'completed' or final_audio_url is not null)
);

create index if not exists studio_requests_student_created_idx
  on public.studio_requests (student_id, created_at desc);

create index if not exists studio_requests_open_idx
  on public.studio_requests (status, created_at)
  where status in ('pending', 'processing');

alter table public.studio_requests enable row level security;

revoke all on public.studio_requests from public, anon, authenticated;
grant usage on type public.studio_request_status to authenticated;
grant select on public.studio_requests to authenticated;
grant insert (id, student_id, song_id, raw_audio_url)
  on public.studio_requests to authenticated;
grant update (status, final_audio_url, notification_seen_at)
  on public.studio_requests to authenticated;

drop policy if exists studio_requests_student_read on public.studio_requests;
create policy studio_requests_student_read
  on public.studio_requests
  for select to authenticated
  using (student_id = auth.uid() and public.academy_active());

drop policy if exists studio_requests_teacher_read on public.studio_requests;
create policy studio_requests_teacher_read
  on public.studio_requests
  for select to authenticated
  using (public.is_teacher());

drop policy if exists studio_requests_student_insert on public.studio_requests;
create policy studio_requests_student_insert
  on public.studio_requests
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and final_audio_url is null
    and notification_seen_at is null
    and public.academy_active()
    and public.can_access_piece(song_id)
    and raw_audio_url in (
      'raw/' || auth.uid()::text || '/' || id::text || '/take.webm',
      'raw/' || auth.uid()::text || '/' || id::text || '/take.mp4'
    )
  );

drop policy if exists studio_requests_teacher_update on public.studio_requests;
create policy studio_requests_teacher_update
  on public.studio_requests
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists studio_requests_student_notification_ack on public.studio_requests;
create policy studio_requests_student_notification_ack
  on public.studio_requests
  for update to authenticated
  using (
    student_id = auth.uid()
    and status = 'completed'
    and notification_seen_at is null
  )
  with check (
    student_id = auth.uid()
    and status = 'completed'
    and notification_seen_at is not null
  );

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'student_records',
  'student_records',
  false,
  209715200,
  array[
    'audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg',
    'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/flac'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists student_records_read on storage.objects;
create policy student_records_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student_records'
    and (
      public.is_teacher()
      or exists (
        select 1
        from public.studio_requests sr
        where sr.id::text = (storage.foldername(name))[3]
          and sr.student_id = auth.uid()
          and (
            (
              (storage.foldername(name))[1] = 'raw'
              and sr.raw_audio_url = name
            )
            or
            (
              (storage.foldername(name))[1] = 'mastered'
              and sr.status = 'completed'
              and sr.final_audio_url = name
            )
          )
      )
    )
  );

drop policy if exists student_records_raw_insert_own on storage.objects;
create policy student_records_raw_insert_own
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student_records'
    and public.academy_active()
    and (storage.foldername(name))[1] = 'raw'
    and (storage.foldername(name))[2] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 3
  );

drop policy if exists student_records_raw_delete_own on storage.objects;
create policy student_records_raw_delete_own
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student_records'
    and (storage.foldername(name))[1] = 'raw'
    and (storage.foldername(name))[2] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 3
    and not exists (
      select 1
      from public.studio_requests sr
      where sr.id::text = (storage.foldername(name))[3]
        and sr.student_id = auth.uid()
    )
  );

drop policy if exists student_records_mastered_insert_teacher on storage.objects;
create policy student_records_mastered_insert_teacher
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student_records'
    and public.is_teacher()
    and (storage.foldername(name))[1] = 'mastered'
    and array_length(storage.foldername(name), 1) = 3
    and exists (
      select 1
      from public.studio_requests sr
      where sr.id::text = (storage.foldername(name))[3]
        and sr.student_id::text = (storage.foldername(name))[2]
        and sr.status in ('pending', 'processing')
    )
  );

drop policy if exists student_records_mastered_delete_teacher on storage.objects;
create policy student_records_mastered_delete_teacher
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student_records'
    and public.is_teacher()
    and (storage.foldername(name))[1] = 'mastered'
    and array_length(storage.foldername(name), 1) = 3
  );

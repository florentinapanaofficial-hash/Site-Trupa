begin;

create table if not exists public.student_repertoire (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null check (status in ('wishlist', 'in_progress', 'stage_ready')),
  audio_path text,
  created_at timestamptz not null default now()
);

create index if not exists student_repertoire_student_created_idx
  on public.student_repertoire(student_id, created_at);

alter table public.student_repertoire enable row level security;
revoke all on public.student_repertoire from public, anon, authenticated;
grant select, insert, update, delete on public.student_repertoire to authenticated;
grant all on public.student_repertoire to service_role;

drop policy if exists student_repertoire_valid_session on public.student_repertoire;
create policy student_repertoire_valid_session on public.student_repertoire
  as restrictive for all to authenticated
  using (public.academy_session_allowed())
  with check (public.academy_session_allowed());

drop policy if exists student_repertoire_select on public.student_repertoire;
create policy student_repertoire_select on public.student_repertoire
  for select to authenticated
  using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));

drop policy if exists student_repertoire_insert on public.student_repertoire;
create policy student_repertoire_insert on public.student_repertoire
  for insert to authenticated
  with check (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));

drop policy if exists student_repertoire_update on public.student_repertoire;
create policy student_repertoire_update on public.student_repertoire
  for update to authenticated
  using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()))
  with check (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));

drop policy if exists student_repertoire_delete on public.student_repertoire;
create policy student_repertoire_delete on public.student_repertoire
  for delete to authenticated
  using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backing_tracks', 'backing_tracks', false, 31457280, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists backing_tracks_read on storage.objects;
create policy backing_tracks_read on storage.objects
  for select to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active());

drop policy if exists backing_tracks_insert_teacher on storage.objects;
create policy backing_tracks_insert_teacher on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());

drop policy if exists backing_tracks_update_teacher on storage.objects;
create policy backing_tracks_update_teacher on storage.objects
  for update to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher())
  with check (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());

drop policy if exists backing_tracks_delete_teacher on storage.objects;
create policy backing_tracks_delete_teacher on storage.objects
  for delete to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());

commit;

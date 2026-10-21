begin;

do $$
begin
  create type public.audio_processing_status as enum ('pending', 'processing', 'completed', 'error');
exception when duplicate_object then null;
end $$;

create table if not exists public.audio_processing_queue (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.pieces(id) on delete cascade,
  original_url text not null check (length(btrim(original_url)) between 1 and 4096 and original_url ~* '^https?://'),
  status public.audio_processing_status not null default 'pending',
  result_url text,
  error_message text check (error_message is null or length(error_message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (result_url is null or result_url ~ '^karaoke-audio:negative/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}[.](mp3|wav|flac|aac|m4a|ogg)$'),
  check (status <> 'completed' or result_url is not null),
  check (status <> 'error' or error_message is not null)
);

create index if not exists audio_processing_queue_song_created_idx
  on public.audio_processing_queue (song_id, created_at desc);
create index if not exists audio_processing_queue_pending_idx
  on public.audio_processing_queue (created_at)
  where status = 'pending';
create unique index if not exists audio_processing_queue_one_active_per_song_idx
  on public.audio_processing_queue (song_id)
  where status in ('pending', 'processing');

alter table public.audio_processing_queue enable row level security;
revoke all on public.audio_processing_queue from public, anon;
grant select, insert, update on public.audio_processing_queue to authenticated;
grant select, insert, update on public.audio_processing_queue to service_role;

drop policy if exists audio_processing_queue_teacher_read on public.audio_processing_queue;
create policy audio_processing_queue_teacher_read
  on public.audio_processing_queue for select to authenticated
  using (public.is_teacher());

drop policy if exists audio_processing_queue_teacher_insert on public.audio_processing_queue;
create policy audio_processing_queue_teacher_insert
  on public.audio_processing_queue for insert to authenticated
  with check (public.is_teacher() and status = 'pending' and result_url is null);

drop policy if exists audio_processing_queue_teacher_update on public.audio_processing_queue;
create policy audio_processing_queue_teacher_update
  on public.audio_processing_queue for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'karaoke-audio',
  'karaoke-audio',
  false,
  524288000,
  array['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/ogg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists karaoke_audio_read on storage.objects;
create policy karaoke_audio_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'karaoke-audio'
    and (
      public.is_teacher()
      or exists (
        select 1 from public.pieces p
        where p.audio_negativ_path = 'karaoke-audio:' || name
          and public.can_access_piece(p.id)
      )
    )
  );

drop policy if exists karaoke_audio_insert_teacher on storage.objects;
create policy karaoke_audio_insert_teacher
  on storage.objects for insert to authenticated
  with check (bucket_id = 'karaoke-audio' and public.is_teacher());

drop policy if exists karaoke_audio_update_teacher on storage.objects;
create policy karaoke_audio_update_teacher
  on storage.objects for update to authenticated
  using (bucket_id = 'karaoke-audio' and public.is_teacher())
  with check (bucket_id = 'karaoke-audio' and public.is_teacher());

drop policy if exists karaoke_audio_delete_teacher on storage.objects;
create policy karaoke_audio_delete_teacher
  on storage.objects for delete to authenticated
  using (bucket_id = 'karaoke-audio' and public.is_teacher());

-- Supabase exposes this publication. The catalog guard keeps local migration tests portable.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'audio_processing_queue'
     ) then
    execute 'alter publication supabase_realtime add table public.audio_processing_queue';
  end if;
end $$;

commit;

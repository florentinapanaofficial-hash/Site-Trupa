begin;

create table if not exists public.catalog_teme (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_name text not null default '' check (char_length(student_name) <= 300),
  title text not null default '' check (char_length(title) <= 200),
  student_note text check (char_length(student_note) <= 500),
  piece_id uuid references public.pieces(id) on delete set null,
  created_at timestamptz not null default now(),
  drive_url text not null unique check (
    char_length(drive_url) <= 2048
    and drive_url ~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/view([?][^[:space:]]*)?$'
  )
);

create index if not exists catalog_teme_student_idx on public.catalog_teme(student_id, created_at desc);
alter table public.catalog_teme add column if not exists midi_url text check (
  midi_url is null or (char_length(midi_url) <= 2048
    and midi_url ~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/view([?][^[:space:]]*)?$')
);
alter table public.catalog_teme enable row level security;
revoke all on public.catalog_teme from public, anon, authenticated;
grant select on public.catalog_teme to authenticated;
grant insert (student_id, student_name, drive_url, midi_url, title, student_note, piece_id) on public.catalog_teme to authenticated;

drop policy if exists catalog_teme_read on public.catalog_teme;
create policy catalog_teme_read on public.catalog_teme for select to authenticated using (
  public.academy_active() and (student_id = auth.uid() or public.is_teacher())
);

drop policy if exists catalog_teme_insert on public.catalog_teme;
create policy catalog_teme_insert on public.catalog_teme for insert to authenticated with check (
  student_id = auth.uid() and exists (
    select 1 from public.profiles where id = auth.uid() and is_active
      and role in ('student', 'elev', 'teacher', 'profesor')
      and catalog_teme.student_name = coalesce(full_name, '')
  )
);

commit;
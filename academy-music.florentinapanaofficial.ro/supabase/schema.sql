-- ============================================================
-- Academy Music — schema completă Supabase
-- Rulare: Supabase Dashboard → SQL Editor → paste → Run
-- Idempotent: poate fi rulat de mai multe ori.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILE ȘI ROLURI
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  username    text,
  role        text        not null default 'student' check (role in ('student', 'teacher')),
  disciplines text[]      not null default array['orga', 'canto'],
  grade_level text,
  study_level text not null default 'modul_1' check (study_level in ('modul_1','modul_2','modul_3','modul_4','modul_5')),
  -- Cale în bucketul privat `avatars`, nu URL public: sunt fotografii de minori.
  avatar_path text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists study_level text not null default 'modul_1';
alter table public.profiles drop constraint if exists profiles_study_level_check;
alter table public.profiles add constraint profiles_study_level_check check (study_level in ('modul_1','modul_2','modul_3','modul_4','modul_5'));
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_username_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_username_format
      check (
        username is null
        or (username = lower(username)
          and username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
          and position('..' in username) = 0)
      );
  end if;
end
$$;

-- Ocolește RLS intenționat: altfel politicile de pe `profiles` s-ar auto-apela recursiv.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher' and is_active
  );
$$;

create or replace function public.academy_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;
revoke all on function public.academy_active() from public, anon;
grant execute on function public.academy_active() to authenticated;

-- Profilul se creează automat la înregistrare; rolul implicit este întotdeauna `student`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fără acest trigger, un elev și-ar putea seta singur role='teacher' printr-un UPDATE pe propriul rând.
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `auth.uid()` este NULL în SQL Editor și pentru `service_role`. Fără această condiție,
  -- promovarea manuală a profesorului ar fi anulată în tăcere, deși UPDATE-ul raportează succes.
  if auth.uid() is not null and not public.is_teacher() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.lock_profile_role();

-- ------------------------------------------------------------
-- 2. REPERTORIU (piese orgă / canto)
-- ------------------------------------------------------------
create table if not exists public.pieces (
  id           uuid primary key default gen_random_uuid(),
  discipline   text not null check (discipline in ('orga', 'canto')),
  title        text not null,
  composer     text,
  level        text not null default 'modul_1' check (level in ('modul_1','modul_2','modul_3','modul_4','modul_5')),
  description  text,
  -- Căi în bucketul privat `academy-media`, NU URL-uri publice.
  audio_negativ_path text,
  audio_pozitiv_path text,
  -- Varianta „Online”: linkuri către surse externe, folosite când nu există fișier local.
  positive_url text,
  negative_url text,
  score_path   text,
  youtube_id   text,
  tags         text[] not null default '{}',
  is_published boolean not null default true,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists pieces_discipline_idx on public.pieces (discipline, level);

-- Migrare pentru bazele create înainte de introducerea modului „Online”.
alter table public.pieces add column if not exists positive_url text;
alter table public.pieces add column if not exists negative_url text;

-- Blochează scheme periculoase (`javascript:`, `data:`) chiar dacă interfața ar fi ocolită.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pieces_positive_url_scheme') then
    alter table public.pieces add constraint pieces_positive_url_scheme
      check (positive_url is null or positive_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pieces_negative_url_scheme') then
    alter table public.pieces add constraint pieces_negative_url_scheme
      check (negative_url is null or negative_url ~* '^https?://');
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2b. GRUPE DE STUDIU ȘI REPERTORIUL LOR
-- ------------------------------------------------------------
create table if not exists public.study_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  position   smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Tabel de legătură: o piesă poate fi în mai multe grupe, fără duplicare de date.
create table if not exists public.group_pieces (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  position smallint not null default 0,
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (group_id, piece_id)
);

create index if not exists group_pieces_group_idx on public.group_pieces (group_id, position);

-- Apartenența elevilor la grupe: fără ea, „repertoriul grupei lui” nu are cum să fie evaluat.
create table if not exists public.group_members (
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index if not exists group_members_student_idx on public.group_members (student_id);

insert into public.study_groups (name, slug, position)
values ('Începători', 'incepatori', 1), ('Avansați', 'avansati', 2)
on conflict (slug) do nothing;

-- Repertoriul individual: ce a primit fiecare elev de studiat.
create table if not exists public.student_pieces (
  student_id  uuid not null references public.profiles (id) on delete cascade,
  piece_id    uuid not null references public.pieces (id) on delete cascade,
  position    smallint not null default 0,
  note        text,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (student_id, piece_id)
);

create index if not exists student_pieces_student_idx on public.student_pieces (student_id, position);

/**
 * Sursa unică de adevăr pentru „are voie elevul la această piesă?”.
 * Folosită și de politica pe `pieces`, și de cea pe `storage.objects`, ca
 * regula să nu poată ajunge să difere între tabel și fișiere.
 */
create or replace function public.can_access_piece(p_piece uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_teacher()
    or exists (
      select 1 from public.student_pieces sp
      where sp.piece_id = p_piece and sp.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.group_pieces gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.piece_id = p_piece and gm.student_id = auth.uid()
    );
$$;

-- ------------------------------------------------------------
-- 3. RED — Resurse Educaționale Deschise
-- ------------------------------------------------------------
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  discipline  text not null check (discipline in ('orga', 'canto', 'comun')),
  category    text not null check (category in ('partitura', 'fisa-teoretica', 'exercitiu', 'link')),
  title       text not null,
  description text,
  file_path   text,
  external_url text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists resources_discipline_idx on public.resources (discipline, category);

-- ------------------------------------------------------------
-- 4. PORTOFOLIU — teme încărcate de elevi
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  piece_id    uuid references public.pieces (id) on delete set null,
  title       text not null,
  student_note text,
  media_path  text not null,
  media_type  text not null check (media_type in ('video', 'audio', 'image')),
  status      text not null default 'trimis' check (status in ('trimis', 'vazut', 'notat')),
  grade       smallint check (grade between 1 and 10),
  feedback    text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists submissions_student_idx on public.submissions (student_id, created_at desc);

-- Teme audio asociate pieselor: baza progresului pentru deblocarea nivelurilor.
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
  ),
  midi_url text check (
    midi_url is null or (char_length(midi_url) <= 2048
      and midi_url ~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/view([?][^[:space:]]*)?$')
  )
);
create index if not exists catalog_teme_student_idx on public.catalog_teme(student_id, created_at desc);


-- ------------------------------------------------------------
-- 5. MONITORIZARE ACTIVITATE
-- ------------------------------------------------------------
create table if not exists public.activity_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  duration_seconds integer not null default 0,
  user_agent       text
);

create index if not exists activity_sessions_user_idx on public.activity_sessions (user_id, started_at desc);

create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.activity_sessions (id) on delete cascade,
  event_type text not null,
  path       text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_idx on public.activity_events (user_id, created_at desc);

create table if not exists public.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quiz_id    text not null,
  score      smallint not null,
  total      smallint not null,
  created_at timestamptz not null default now()
);

-- Durata este calculată din `now()` server-side; clientul nu poate raporta ore false.
create or replace function public.start_activity_session(p_user_agent text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Neautentificat';
  end if;

  insert into public.activity_sessions (user_id, user_agent)
  values (auth.uid(), left(coalesce(p_user_agent, ''), 400))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.touch_activity_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activity_sessions
  set last_seen_at = now(),
      duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int)
  where id = p_session and user_id = auth.uid();
end;
$$;

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
    or (
      new.avatar_path is distinct from old.avatar_path
      and new.avatar_path is not null
      and split_part(new.avatar_path, '/', 1) is distinct from auth.uid()::text
    )
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


-- ------------------------------------------------------------
-- 6. RLS — totul este refuzat implicit, apoi deschis punctual
-- ------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.pieces            enable row level security;
alter table public.study_groups      enable row level security;
alter table public.group_pieces      enable row level security;
alter table public.group_members     enable row level security;
alter table public.student_pieces    enable row level security;
alter table public.resources         enable row level security;
alter table public.submissions       enable row level security;
alter table public.catalog_teme       enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.activity_events   enable row level security;
alter table public.quiz_results      enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_teacher());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_teacher())
  with check (id = auth.uid() or public.is_teacher());

drop policy if exists profiles_insert_teacher on public.profiles;
create policy profiles_insert_teacher on public.profiles
  for insert to authenticated
  with check (public.is_teacher());

-- pieces: elevul vede exclusiv ce i-a fost alocat, direct sau prin grupa lui.
drop policy if exists pieces_select on public.pieces;
create policy pieces_select on public.pieces
  for select to authenticated
  using (public.academy_active() and (is_published or public.is_teacher()));

drop policy if exists pieces_write_teacher on public.pieces;
create policy pieces_write_teacher on public.pieces
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- grupe de studiu
drop policy if exists study_groups_select on public.study_groups;
create policy study_groups_select on public.study_groups
  for select to authenticated using (true);

drop policy if exists study_groups_write_teacher on public.study_groups;
create policy study_groups_write_teacher on public.study_groups
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists group_pieces_select on public.group_pieces;
create policy group_pieces_select on public.group_pieces
  for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_pieces.group_id and gm.student_id = auth.uid()
    )
  );

drop policy if exists group_pieces_write_teacher on public.group_pieces;
create policy group_pieces_write_teacher on public.group_pieces
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());

drop policy if exists group_members_write_teacher on public.group_members;
create policy group_members_write_teacher on public.group_members
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- repertoriu individual: elevul își vede propriile piese, profesorul le gestionează pe toate
drop policy if exists student_pieces_select on public.student_pieces;
create policy student_pieces_select on public.student_pieces
  for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());

drop policy if exists student_pieces_write_teacher on public.student_pieces;
create policy student_pieces_write_teacher on public.student_pieces
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- resources
drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated using (true);

drop policy if exists resources_write_teacher on public.resources;
create policy resources_write_teacher on public.resources
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- submissions
revoke all on public.catalog_teme from public, anon, authenticated;
grant select on public.catalog_teme to authenticated;
grant insert (student_id, student_name, drive_url, midi_url, title, student_note, piece_id) on public.catalog_teme to authenticated;
drop policy if exists catalog_teme_read on public.catalog_teme;
create policy catalog_teme_read on public.catalog_teme for select to authenticated using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));
drop policy if exists catalog_teme_insert on public.catalog_teme;
create policy catalog_teme_insert on public.catalog_teme for insert to authenticated with check (student_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and is_active and role in ('student', 'elev', 'teacher', 'profesor') and catalog_teme.student_name = coalesce(full_name, '')));

drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (student_id = auth.uid() or public.is_teacher());

drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own on public.submissions
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists submissions_update_teacher on public.submissions;
create policy submissions_update_teacher on public.submissions
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete to authenticated
  using (student_id = auth.uid() or public.is_teacher());

-- activity
drop policy if exists activity_sessions_select on public.activity_sessions;
create policy activity_sessions_select on public.activity_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());

drop policy if exists activity_events_insert_own on public.activity_events;
create policy activity_events_insert_own on public.activity_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());

-- quiz
drop policy if exists quiz_results_insert_own on public.quiz_results;
create policy quiz_results_insert_own on public.quiz_results
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists quiz_results_select on public.quiz_results;
create policy quiz_results_select on public.quiz_results
  for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());

-- ------------------------------------------------------------
-- 7. STORAGE — buckete PRIVATE (fără acces public, fără linkuri directe)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('academy-media', 'academy-media', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', false)
on conflict (id) do update set public = false;

-- Fotografii de profil ale unor minori: bucket privat, niciodată public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.academy_active());

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars' and public.academy_active()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars' and public.academy_active()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  )
  with check (
    bucket_id = 'avatars' and public.academy_active()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars' and public.academy_active()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

-- Fără această restricție, un elev care află calea unui fișier ar putea cere URL semnat
-- pentru orice material din bucket, chiar dacă piesa nu îi este alocată.
drop policy if exists media_read_authenticated on storage.objects;
create policy media_read_authenticated on storage.objects
  for select to authenticated
  using (
    bucket_id = 'academy-media'
    and (
      public.is_teacher()
      -- Resursele RED rămân comune întregii clase.
      or exists (select 1 from public.resources r where r.file_path = name)
      or exists (
        select 1 from public.pieces p
        where (
            p.audio_pozitiv_path = name
            or p.audio_negativ_path = name
            or p.score_path = name
          )
          and p.is_published
          and public.can_access_piece(p.id)
      )
    )
  );

drop policy if exists media_write_teacher on storage.objects;
create policy media_write_teacher on storage.objects
  for insert to authenticated
  with check (bucket_id = 'academy-media' and public.is_teacher());

drop policy if exists media_update_teacher on storage.objects;
create policy media_update_teacher on storage.objects
  for update to authenticated
  using (bucket_id = 'academy-media' and public.is_teacher());

drop policy if exists media_delete_teacher on storage.objects;
create policy media_delete_teacher on storage.objects
  for delete to authenticated
  using (bucket_id = 'academy-media' and public.is_teacher());

-- Portofoliu: fiecare elev scrie doar în folderul propriu `<user_id>/...`.
drop policy if exists portfolio_read on storage.objects;
create policy portfolio_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portfolio'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

drop policy if exists portfolio_insert_own on storage.objects;
create policy portfolio_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists portfolio_delete on storage.objects;
create policy portfolio_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

-- ------------------------------------------------------------
-- 8. PROMOVARE PROFESOR (rulează manual, o singură dată)
-- ------------------------------------------------------------
-- update public.profiles set role = 'teacher'
-- where id = (select id from auth.users where email = 'adresa@ta.ro');
--
-- Verifică întotdeauna rezultatul — "Success. 1 row affected" nu garantează că
-- valoarea s-a schimbat, fiindcă un trigger BEFORE UPDATE poate rescrie rândul:
-- select u.email, p.role, p.is_active
-- from public.profiles p join auth.users u on u.id = p.id
-- where u.email = 'adresa@ta.ro';


-- Private Realtime presence is limited to authenticated, active Academy members.
drop policy if exists academy_online_presence_read on realtime.messages;
create policy academy_online_presence_read on realtime.messages for select to authenticated
using (extension = 'presence' and realtime.topic() = 'academy:online' and public.academy_active());
drop policy if exists academy_online_presence_write on realtime.messages;
create policy academy_online_presence_write on realtime.messages for insert to authenticated
with check (extension = 'presence' and realtime.topic() = 'academy:online' and public.academy_active());


-- 9. QUEUE DE PROCESARE AUDIO LOCALĂ (SpectraLayers)
-- Definiția completă și politicile sunt păstrate în migrarea repetabilă dedicată.
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

-- Virtual Studio: requests, private recordings and notification protection.
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

-- RLS selects rows; the trigger enforces the student's column boundary.
revoke update on public.studio_requests from public, anon, authenticated;
revoke update (id, student_id, song_id, raw_audio_url, final_audio_url, status, created_at, notification_seen_at)
  on public.studio_requests from public, anon, authenticated;
grant update (status, final_audio_url, notification_seen_at)
  on public.studio_requests to authenticated;

drop policy if exists studio_requests_student_notification_ack on public.studio_requests;
create policy studio_requests_student_notification_ack
  on public.studio_requests
  for update to authenticated
  using (
    student_id = auth.uid()
    and public.academy_active()
    and status = 'completed'
    and notification_seen_at is null
  )
  with check (
    student_id = auth.uid()
    and public.academy_active()
    and status = 'completed'
    and notification_seen_at is not null
  );

create or replace function public.guard_studio_notification_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_teacher() or current_user in ('postgres', 'service_role') then
    return new;
  end if;

  if old.student_id is distinct from auth.uid()
     or not public.academy_active()
     or old.status <> 'completed'
     or old.notification_seen_at is not null
     or new.notification_seen_at is null
     or (to_jsonb(new) - 'notification_seen_at')
        is distinct from (to_jsonb(old) - 'notification_seen_at') then
    raise exception 'Elevul poate modifica doar notification_seen_at pentru o notificare proprie necitita.'
      using errcode = '42501';
  end if;

  new.notification_seen_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.guard_studio_notification_update() from public, anon, authenticated;
drop trigger if exists studio_notification_update_guard on public.studio_requests;
create trigger studio_notification_update_guard
  before update on public.studio_requests
  for each row execute function public.guard_studio_notification_update();


-- Portofoliul personal și negativele încărcate exclusiv de profesori.
create table if not exists public.student_repertoire (
  id uuid primary key default gen_random_uuid(),
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
  using (public.academy_active()) with check (public.academy_active());
drop policy if exists student_repertoire_select on public.student_repertoire;
create policy student_repertoire_select on public.student_repertoire
  for select to authenticated using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));
drop policy if exists student_repertoire_insert on public.student_repertoire;
create policy student_repertoire_insert on public.student_repertoire
  for insert to authenticated with check (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));
drop policy if exists student_repertoire_update on public.student_repertoire;
create policy student_repertoire_update on public.student_repertoire
  for update to authenticated using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()))
  with check (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));
drop policy if exists student_repertoire_delete on public.student_repertoire;
create policy student_repertoire_delete on public.student_repertoire
  for delete to authenticated using (public.academy_active() and (student_id = auth.uid() or public.is_teacher()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backing_tracks', 'backing_tracks', false, 31457280, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists backing_tracks_read on storage.objects;
create policy backing_tracks_read on storage.objects for select to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active());
drop policy if exists backing_tracks_insert_teacher on storage.objects;
create policy backing_tracks_insert_teacher on storage.objects for insert to authenticated
  with check (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());
drop policy if exists backing_tracks_update_teacher on storage.objects;
create policy backing_tracks_update_teacher on storage.objects for update to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher())
  with check (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());
drop policy if exists backing_tracks_delete_teacher on storage.objects;
create policy backing_tracks_delete_teacher on storage.objects for delete to authenticated
  using (bucket_id = 'backing_tracks' and public.academy_active() and public.is_teacher());

commit;


-- Banca de quiz-uri și Etapa 2: Joc Ritmic, podium, dueluri între elevi.
begin;

create table if not exists public.quizzes (
  id text primary key default gen_random_uuid()::text,
  title text not null check (length(title) between 1 and 150),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_option smallint not null check (correct_option >= 0 and correct_option < jsonb_array_length(options)),
  position smallint not null check (position between 0 and 99),
  unique (quiz_id, position)
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id text not null,
  score smallint not null,
  total smallint not null,
  created_at timestamptz not null default now()
);

alter table public.quiz_results add column if not exists answers jsonb;
alter table public.quiz_results add column if not exists attempt_id uuid;
create unique index if not exists quiz_results_attempt_idx on public.quiz_results(user_id, attempt_id);
create index if not exists quiz_results_user_idx on public.quiz_results(user_id, created_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes for select to authenticated using (
  public.is_teacher() or (is_published and exists (select 1 from public.profiles where id = auth.uid() and is_active))
);
drop policy if exists quizzes_manage on public.quizzes;
create policy quizzes_manage on public.quizzes for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists questions_read on public.quiz_questions;
create policy questions_read on public.quiz_questions for select to authenticated using (
  exists (select 1 from public.quizzes where id = quiz_id)
);
drop policy if exists questions_manage on public.quiz_questions;
create policy questions_manage on public.quiz_questions for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

revoke all on public.quizzes, public.quiz_questions, public.quiz_results from anon, authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select (id, quiz_id, prompt, options, position), insert, update, delete on public.quiz_questions to authenticated;
grant select, insert on public.quiz_results to authenticated;

drop policy if exists quiz_results_insert_own on public.quiz_results;
create policy quiz_results_insert_own on public.quiz_results for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and is_active)
);
drop policy if exists quiz_results_select on public.quiz_results;
create policy quiz_results_select on public.quiz_results for select to authenticated using (user_id = auth.uid() or public.is_teacher());

create or replace function public.grade_quiz_result()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  question record;
  answer_index integer;
  question_count integer;
begin
  if exists (select 1 from public.quizzes where id = new.quiz_id) then
    if not exists (select 1 from public.quizzes where id = new.quiz_id and (is_published or public.is_teacher())) then
      raise exception 'Quiz unavailable';
    end if;
    select count(*) into question_count from public.quiz_questions where quiz_id = new.quiz_id;
    if question_count = 0 or question_count > 100 or new.attempt_id is null
      or new.answers is null or jsonb_typeof(new.answers) <> 'array' then
      raise exception 'Invalid attempt';
    end if;
    if jsonb_array_length(new.answers) <> question_count then raise exception 'Incomplete answers'; end if;
    new.score := 0;
    new.total := question_count;
    answer_index := 0;
    for question in select * from public.quiz_questions where quiz_id = new.quiz_id order by position loop
      if (new.answers ->> answer_index) is null or (new.answers ->> answer_index) !~ '^[0-7]$' then
        raise exception 'Invalid answer';
      end if;
      if (new.answers ->> answer_index)::integer >= jsonb_array_length(question.options) then raise exception 'Invalid option'; end if;
      if (new.answers ->> answer_index)::integer = question.correct_option then new.score := new.score + 1; end if;
      answer_index := answer_index + 1;
    end loop;
  elsif new.answers is not null or new.attempt_id is not null then
    raise exception 'Unknown quiz';
  end if;
  if new.total < 1 or new.score < 0 or new.score > new.total then raise exception 'Invalid score'; end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.grade_quiz_result() from public, anon, authenticated;
drop trigger if exists grade_quiz_result on public.quiz_results;
create trigger grade_quiz_result before insert on public.quiz_results for each row execute function public.grade_quiz_result();

insert into public.quizzes(id, title, is_published) values ('note-muzicale-intro', 'Notele muzicale', true) on conflict do nothing;
insert into public.quiz_questions(quiz_id, prompt, options, correct_option, position) values
  ('note-muzicale-intro', 'Ce notă urmează după Do?', '["Re", "Fa", "Sol"]', 0, 0),
  ('note-muzicale-intro', 'Câte note naturale are gama Do major?', '["Cinci", "Șapte", "Nouă"]', 1, 1)
on conflict (quiz_id, position) do nothing;

commit;
begin;

do $$ begin
  if to_regclass('public.quizzes') is null or to_regclass('public.quiz_questions') is null then
    raise exception 'Instalează întâi supabase/setup_quizzes.sql (banca de quiz-uri).';
  end if;
end $$;

create table if not exists public.game_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  alias text not null check (length(alias) between 2 and 24),
  visible boolean not null default false
);
create table if not exists public.rhythm_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pattern jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  score integer check (score between 0 and 1000),
  hits integer,
  mistakes integer
);
create index if not exists rhythm_attempts_user on public.rhythm_attempts(user_id, started_at desc);
create table if not exists public.live_quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  host_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  review_until timestamptz,
  status text not null default 'lobby' check (status in ('lobby','question','review','completed')),
  question_index integer not null default -1,
  opened_at timestamptz,
  deadline timestamptz,
  duration_seconds integer not null check (duration_seconds between 10 and 60),
  revision integer not null default 0,
  created_at timestamptz not null default clock_timestamp()
);
-- Snapshots keep the quiz stable if a teacher edits the library during a contest.
create table if not exists public.live_quiz_questions (
  room_id uuid not null references public.live_quiz_rooms(id) on delete cascade,
  position integer not null,
  prompt text not null,
  options jsonb not null,
  correct_option integer not null,
  primary key(room_id, position)
);
create table if not exists public.live_quiz_members (
  room_id uuid not null references public.live_quiz_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  alias text not null,
  joined_at timestamptz not null default clock_timestamp(),
  primary key(room_id,user_id)
);
create table if not exists public.live_quiz_answers (
  room_id uuid not null,
  user_id uuid not null,
  position integer not null,
  choice integer not null,
  points integer not null check (points in (0,100)),
  answered_at timestamptz not null default clock_timestamp(),
  primary key(room_id,user_id,position),
  foreign key(room_id,user_id) references public.live_quiz_members(room_id,user_id) on delete cascade,
  foreign key(room_id,position) references public.live_quiz_questions(room_id,position) on delete cascade
);

alter table public.game_profiles enable row level security;
alter table public.rhythm_attempts enable row level security;
alter table public.live_quiz_rooms enable row level security;
alter table public.live_quiz_questions enable row level security;
alter table public.live_quiz_members enable row level security;
alter table public.live_quiz_answers enable row level security;
revoke all on public.game_profiles,public.rhythm_attempts,public.live_quiz_rooms,public.live_quiz_questions,public.live_quiz_members,public.live_quiz_answers from public,anon,authenticated;
grant select on public.game_profiles,public.rhythm_attempts,public.live_quiz_rooms to authenticated;
drop policy if exists game_profiles_own on public.game_profiles;
create policy game_profiles_own on public.game_profiles for select to authenticated using(user_id=auth.uid() and public.academy_active());
drop policy if exists rhythm_attempts_own on public.rhythm_attempts;
create policy rhythm_attempts_own on public.rhythm_attempts for select to authenticated using(user_id=auth.uid() and public.academy_active());
drop policy if exists live_rooms_member on public.live_quiz_rooms;
create policy live_rooms_member on public.live_quiz_rooms for select to authenticated using(public.academy_active() and (host_id=auth.uid() or opponent_id=auth.uid() or exists(select 1 from public.live_quiz_members m where m.room_id=id and m.user_id=auth.uid())));
-- The policy above needs a narrow membership lookup, not access to other players.
grant select on public.live_quiz_members to authenticated;
drop policy if exists live_members_own on public.live_quiz_members;
create policy live_members_own on public.live_quiz_members for select to authenticated using(user_id=auth.uid() and public.academy_active());

create or replace function public.game_require_player() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.academy_active() or not exists(
    select 1 from public.profiles where id=auth.uid() and role in ('student','elev','teacher','profesor')
  ) then raise exception 'Cont activ de elev sau profesor necesar.' using errcode='42501'; end if;
end $$;

create or replace function public.game_set_profile(p_alias text,p_visible boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.game_require_player();
  if p_alias is null or length(trim(p_alias)) not between 2 and 24 or p_alias ~ '[[:cntrl:]]' or p_visible is null then
    raise exception 'Alege un pseudonim de 2-24 caractere.'; end if;
  insert into public.game_profiles(user_id,alias,visible) values(auth.uid(),trim(p_alias),p_visible)
    on conflict(user_id) do update set alias=excluded.alias,visible=excluded.visible;
  return jsonb_build_object('alias',trim(p_alias),'visible',p_visible);
end $$;

create or replace function public.game_rhythm_start() returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt public.rhythm_attempts; pattern jsonb;
begin
  perform public.game_require_player();
  perform pg_advisory_xact_lock(hashtext('rhythm:'||auth.uid()::text));
  if exists(select 1 from public.rhythm_attempts where user_id=auth.uid() and started_at>clock_timestamp()-interval '25 seconds') then
    raise exception 'Așteaptă încheierea rundei înainte de a începe alta.'; end if;
  select jsonb_agg(jsonb_build_object('id',i,'note',60+(array[0,2,4,5,7])[1+floor(random()*5)::integer], 'time',2+i*0.65,'duration',0.4) order by i) into pattern from generate_series(0,11) i;
  insert into public.rhythm_attempts(user_id,pattern) values(auth.uid(),pattern) returning * into attempt;
  return jsonb_build_object('id',attempt.id,'pattern',pattern,'duration',10,'bpm',92);
end $$;

create or replace function public.game_rhythm_finish(p_attempt uuid,p_events jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.rhythm_attempts; e jsonb; n jsonb; used integer[]='{}'; matched integer; hit_count integer=0; bad integer=0; previous_time numeric=-1; t numeric; pitch integer; result integer;
begin
  perform public.game_require_player();
  select * into a from public.rhythm_attempts where id=p_attempt and user_id=auth.uid() for update;
  if not found then raise exception 'Runda nu este disponibilă.'; end if;
  if a.finished_at is not null then return jsonb_build_object('score',a.score,'hits',a.hits,'mistakes',a.mistakes,'total',12); end if;
  if clock_timestamp()<a.started_at+interval '10 seconds' or clock_timestamp()>a.started_at+interval '3 minutes' then raise exception 'Runda nu poate fi salvată în acest interval.'; end if;
  if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>256 then raise exception 'Apăsări invalide.'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(e->'time') is distinct from 'number' or jsonb_typeof(e->'note') is distinct from 'number' then raise exception 'Apăsări invalide.'; end if;
    t=(e->>'time')::numeric; pitch=(e->>'note')::integer;
    if t<previous_time or t<0 or t>10 or pitch<0 or pitch>127 or (e->>'note')::numeric<>pitch then raise exception 'Apăsări invalide.'; end if;
    previous_time=t;
    select (value->>'id')::integer into matched from jsonb_array_elements(a.pattern)
      where (value->>'note')::integer=pitch and not ((value->>'id')::integer=any(used)) and (value->>'time')::numeric>=t-0.18 and (value->>'time')::numeric<t+0.180001
      order by abs((value->>'time')::numeric-t), (value->>'id')::integer limit 1;
    if matched is null then bad=bad+1; else used=array_append(used,matched); hit_count=hit_count+1; end if;
  end loop;
  result=greatest(0,round(hit_count*1000.0/12)::integer-bad*20);
  update public.rhythm_attempts set score=result,hits=hit_count,mistakes=bad,finished_at=clock_timestamp() where id=a.id;
  return jsonb_build_object('score',result,'hits',hit_count,'mistakes',bad,'total',12);
end $$;

create or replace function public.game_live_create(p_quiz text,p_opponent uuid default null,p_seconds integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.live_quiz_rooms; quiz_title text;
begin
  perform public.game_require_player();
  if p_seconds is null or p_seconds not between 10 and 60 then raise exception 'Alege 10-60 secunde.'; end if;
  if p_opponent=auth.uid() or (p_opponent is not null and not exists(select 1 from public.game_profiles g join public.profiles p on p.id=g.user_id where g.user_id=p_opponent and g.visible and p.is_active and p.role in ('student','elev'))) then raise exception 'Adversarul nu acceptă invitații.'; end if;
  perform pg_advisory_xact_lock(hashtext('live:'||auth.uid()::text));
  if (select count(*) from public.live_quiz_rooms where host_id=auth.uid() and status<>'completed' and created_at>clock_timestamp()-interval '10 minutes')>=3
    or (select count(*) from public.live_quiz_rooms where host_id=auth.uid() and created_at>clock_timestamp()-interval '1 day')>=30 then raise exception 'Prea multe invitații. Așteaptă sau încheie duelurile existente.'; end if;
  select title into quiz_title from public.quizzes where id=p_quiz and (is_published or public.is_teacher());
  if not found or (select count(*) from public.quiz_questions where quiz_id=p_quiz) not between 1 and 100 then raise exception 'Quiz indisponibil sau fără întrebări.'; end if;
  if exists(
    select 1 from public.quiz_questions q where q.quiz_id=p_quiz and (
      length(trim(q.prompt)) not between 1 and 1000 or exists(
        select 1 from jsonb_array_elements(q.options) o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}')) not between 1 and 200
      )
    )
  ) then raise exception 'Quiz-ul conține întrebări/opțiuni invalide. Cere profesorului să le revizuiască.'; end if;
  insert into public.live_quiz_rooms(host_id,opponent_id,title,duration_seconds) values(auth.uid(),p_opponent,quiz_title,p_seconds) returning * into r;
  insert into public.live_quiz_questions(room_id,position,prompt,options,correct_option)
    select r.id,(row_number() over(order by position)-1)::integer,prompt,options,correct_option from public.quiz_questions where quiz_id=p_quiz;
  insert into public.live_quiz_members(room_id,user_id,alias)
    values(r.id,auth.uid(),coalesce((select alias from public.game_profiles where user_id=auth.uid()),'Elev '||upper(substr(replace(auth.uid()::text,'-',''),1,6))));
  return jsonb_build_object('id',r.id,'code',r.code);
end $$;

create or replace function public.game_live_join(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.live_quiz_rooms; nickname text;
begin
  perform public.game_require_player();
  select * into r from public.live_quiz_rooms where code=upper(trim(p_code)) and created_at>clock_timestamp()-interval '4 hours' for update;
  if not found then raise exception 'Cod invalid sau duel expirat.'; end if;
  if exists(select 1 from public.live_quiz_members where room_id=r.id and user_id=auth.uid()) then return r.id; end if;
  if r.opponent_id is not null and r.opponent_id<>auth.uid() then raise exception 'Invitația este destinată altui elev.' using errcode='42501'; end if;
  if r.status<>'lobby' or r.created_at<clock_timestamp()-interval '10 minutes' then raise exception 'Invitația nu mai este disponibilă.'; end if;
  select alias into nickname from public.game_profiles where user_id=auth.uid();
  nickname=coalesce(nickname,'Elev '||upper(substr(replace(auth.uid()::text,'-',''),1,6)));
  insert into public.live_quiz_members(room_id,user_id,alias) values(r.id,auth.uid(),nickname);
  update public.live_quiz_rooms set opponent_id=auth.uid(),status='question',question_index=0,opened_at=clock_timestamp(),deadline=clock_timestamp()+make_interval(secs=>duration_seconds),revision=revision+1 where id=r.id;
  return r.id;
end $$;

create or replace function public.game_live_cancel(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.game_require_player();
  update public.live_quiz_rooms set status='completed',revision=revision+1
    where id=p_room and status='lobby' and (host_id=auth.uid() or opponent_id=auth.uid());
  if not found then raise exception 'Invitația nu mai poate fi anulată.'; end if;
end $$;

create or replace function public.game_live_advance(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.live_quiz_rooms; total integer;
begin
  select * into r from public.live_quiz_rooms where id=p_room for update;
  select count(*) into total from public.live_quiz_questions where room_id=p_room;
  loop
    if r.status='lobby' and r.created_at<clock_timestamp()-interval '10 minutes' then
      update public.live_quiz_rooms set status='completed',revision=revision+1 where id=r.id returning * into r;
    elsif r.status='question' and clock_timestamp()>=r.deadline then
      update public.live_quiz_rooms set status='review',review_until=deadline+interval '4 seconds',revision=revision+1 where id=r.id returning * into r;
    elsif r.status='review' and clock_timestamp()>=r.review_until then
      if r.question_index+1>=total then
        update public.live_quiz_rooms set status='completed',revision=revision+1 where id=r.id returning * into r;
      else
        update public.live_quiz_rooms set status='question',question_index=question_index+1,opened_at=review_until,deadline=review_until+make_interval(secs=>duration_seconds),review_until=null,revision=revision+1 where id=r.id returning * into r;
      end if;
    else exit; end if;
  end loop;
end $$;

create or replace function public.game_live_answer(p_room uuid,p_position integer,p_choice integer) returns void
language plpgsql security definer set search_path='' as $$
declare r public.live_quiz_rooms; q public.live_quiz_questions;
begin
  perform public.game_require_player();
  -- Lock the room so answer/close/next are serialized at the server.
  select * into r from public.live_quiz_rooms where id=p_room for update;
  if not found or not exists(select 1 from public.live_quiz_members where room_id=p_room and user_id=auth.uid()) then raise exception 'Nu participi în această cameră.' using errcode='42501'; end if;
  perform public.game_live_advance(p_room);
  select * into r from public.live_quiz_rooms where id=p_room;
  if r.status<>'question' or p_position is distinct from r.question_index or clock_timestamp()>=r.deadline or r.created_at<clock_timestamp()-interval '4 hours' then raise exception 'Întrebarea nu mai acceptă răspunsuri.'; end if;
  select * into q from public.live_quiz_questions where room_id=r.id and position=r.question_index;
  if p_choice is null or p_choice<0 or p_choice>=jsonb_array_length(q.options) then raise exception 'Opțiune invalidă.'; end if;
  if exists(select 1 from public.live_quiz_answers where room_id=r.id and user_id=auth.uid() and position=r.question_index) then raise exception 'Răspunsul a fost deja înregistrat.'; end if;
  insert into public.live_quiz_answers(room_id,user_id,position,choice,points) values(r.id,auth.uid(),r.question_index,p_choice,case when p_choice=q.correct_option then 100 else 0 end);
  if (select count(*) from public.live_quiz_answers where room_id=r.id and position=r.question_index)=2 then
    update public.live_quiz_rooms set status='review',review_until=clock_timestamp()+interval '4 seconds',revision=revision+1 where id=r.id;
  else update public.live_quiz_rooms set revision=revision+1 where id=r.id; end if;
end $$;

create or replace function public.game_live_state(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.live_quiz_rooms; question jsonb; rankings jsonb; own_answer integer; count_questions integer;
begin
  perform public.game_require_player();
  select * into r from public.live_quiz_rooms where id=p_room;
  if not found or (r.host_id<>auth.uid() and r.opponent_id is distinct from auth.uid() and not exists(select 1 from public.live_quiz_members where room_id=r.id and user_id=auth.uid())) then raise exception 'Camera nu este accesibilă.' using errcode='42501'; end if;
  perform public.game_live_advance(p_room);
  select * into r from public.live_quiz_rooms where id=p_room;
  select count(*) into count_questions from public.live_quiz_questions where room_id=r.id;
  select jsonb_build_object('prompt',prompt,'options',options,'correct_option',case when r.status in ('review','completed') then correct_option else null end)
    into question from public.live_quiz_questions where room_id=r.id and position=r.question_index;
  select choice into own_answer from public.live_quiz_answers where room_id=r.id and user_id=auth.uid() and position=r.question_index;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.points desc,x.alias,x.user_id),'[]') into rankings from (
    select m.user_id,m.alias,coalesce(sum(a.points),0)::integer points,count(a.position)::integer answered
    from public.live_quiz_members m left join public.live_quiz_answers a on a.room_id=m.room_id and a.user_id=m.user_id
      and (a.position<r.question_index or r.status in ('review','completed'))
    where m.room_id=r.id group by m.user_id,m.alias
  ) x;
  if not exists(select 1 from public.live_quiz_members where room_id=r.id and user_id=auth.uid()) then question=null; rankings='[]'; end if;
  return jsonb_build_object('id',r.id,'code',r.code,'title',r.title,'status',r.status,'host',r.host_id=auth.uid(),'question_index',r.question_index,'total',count_questions,'deadline',r.deadline,'review_until',r.review_until,'server_now',clock_timestamp(),'question',question,'answer',own_answer,'players',rankings,'answer_count',(select count(*) from public.live_quiz_answers where room_id=r.id and position=r.question_index));
end $$;

create or replace function public.game_live_inbox() returns jsonb
language plpgsql security definer set search_path='' as $$
declare room record;
begin
  perform public.game_require_player();
  for room in select id from (
    select id from public.live_quiz_rooms where (host_id=auth.uid() or opponent_id=auth.uid()) and status<>'completed' order by created_at desc limit 30
  ) recent order by id loop
    perform public.game_live_advance(room.id);
  end loop;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select id,code,title,status,host_id,opponent_id,created_at from public.live_quiz_rooms
    where host_id=auth.uid() or opponent_id=auth.uid() order by created_at desc limit 30
  ) x),'[]');
end $$;
revoke all on function public.game_live_inbox() from public,anon,authenticated;
grant execute on function public.game_live_inbox() to authenticated;

create or replace function public.game_leaderboard() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.game_require_player();
  perform public.game_live_inbox();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.total desc,x.alias,x.user_id),'[]') into result from (
    select gp.user_id,gp.alias,p.avatar_path,coalesce(r.best,0)::integer rhythm,coalesce(q.best,0)::integer quiz,
      (coalesce(r.best,0)+coalesce(q.best,0))::integer total
    from public.game_profiles gp join public.profiles p on p.id=gp.user_id and p.is_active and p.role in ('student','elev')
    left join lateral(select max(score) best from public.rhythm_attempts where user_id=gp.user_id and finished_at is not null) r on true
    left join lateral(
      select max(points) best from (
        select round(sum(a.points)*10.0/(select count(*) from public.live_quiz_questions where room_id=room.id))::integer points
        from public.live_quiz_rooms room join public.live_quiz_answers a on a.room_id=room.id and a.user_id=gp.user_id
        where room.status='completed' group by room.id
      ) totals
    ) q on true
    where gp.visible and (r.best is not null or q.best is not null)
    order by total desc,gp.alias,gp.user_id limit 50
  ) x;
  return result;
end $$;

-- Opt-in photos only; no global profiles SELECT or public avatar bucket.
create or replace function public.game_avatar_visible(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.academy_active() and exists(select 1 from public.game_profiles gp join public.profiles p on p.id=gp.user_id where gp.visible and p.is_active and p.role in ('student','elev') and p.avatar_path=p_path)
$$;
drop policy if exists avatars_game_opt_in on storage.objects;
create policy avatars_game_opt_in on storage.objects for select to authenticated using(bucket_id='avatars' and public.game_avatar_visible(name));

revoke all on function public.game_live_advance(uuid),public.game_require_player(),public.game_set_profile(text,boolean),public.game_rhythm_start(),public.game_rhythm_finish(uuid,jsonb),public.game_live_create(text,uuid,integer),public.game_live_join(text),public.game_live_cancel(uuid),public.game_live_answer(uuid,integer,integer),public.game_live_state(uuid),public.game_leaderboard(),public.game_avatar_visible(text) from public,anon,authenticated;
grant execute on function public.game_set_profile(text,boolean),public.game_rhythm_start(),public.game_rhythm_finish(uuid,jsonb),public.game_live_create(text,uuid,integer),public.game_live_join(text),public.game_live_cancel(uuid),public.game_live_answer(uuid,integer,integer),public.game_live_state(uuid),public.game_leaderboard(),public.game_avatar_visible(text) to authenticated;

create or replace function public.game_opponents() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.game_require_player();
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select g.user_id,g.alias,p.avatar_path from public.game_profiles g join public.profiles p on p.id=g.user_id
    where g.visible and p.is_active and p.role in ('student','elev') and g.user_id<>auth.uid() order by g.alias,g.user_id limit 100
  ) x),'[]');
end $$;
revoke all on function public.game_opponents() from public,anon,authenticated;
grant execute on function public.game_opponents() to authenticated;

-- Prepared starter quizzes; reruns never overwrite a teacher's edits.
do $$ begin
  if not exists(select 1 from public.quizzes where id='academy-duel-notatie-1') then
    insert into public.quizzes(id,title,is_published) values ('academy-duel-notatie-1','Duel: note și portativ',true);
    insert into public.quiz_questions(quiz_id,prompt,options,correct_option,position) values
      ('academy-duel-notatie-1','Câte spații se află între cele cinci linii ale portativului?','["Trei","Patru","Cinci"]',1,0),
      ('academy-duel-notatie-1','Ce sunet urmează după mi în șirul ascendent al notelor naturale?','["Re","Fa","Sol"]',1,1),
      ('academy-duel-notatie-1','Ce semn readuce o notă alterată la înălțimea naturală?','["Becarul","Diezul","Bemolul"]',0,2),
      ('academy-duel-notatie-1','Pe ce linie se află nota sol indicată de cheia sol?','["Prima","A doua","A treia"]',1,3),
      ('academy-duel-notatie-1','Care dintre aceste perechi formează un semiton natural?','["Do–Re","Fa–Sol","Mi–Fa"]',2,4);
  end if;
  if not exists(select 1 from public.quizzes where id='academy-duel-ritm-1') then
    insert into public.quizzes(id,title,is_published) values ('academy-duel-ritm-1','Duel: ritm și expresie',true);
    insert into public.quiz_questions(quiz_id,prompt,options,correct_option,position) values
      ('academy-duel-ritm-1','Câte optimi au împreună durata unei pătrimi?','["Două","Trei","Patru"]',0,0),
      ('academy-duel-ritm-1','În măsura de 3/4, câți timpi de pătrime are o măsură completă?','["Doi","Trei","Patru"]',1,1),
      ('academy-duel-ritm-1','Ce indică termenul crescendo?','["Sunet din ce în ce mai încet","Sunet din ce în ce mai tare","Oprirea muzicii"]',1,2),
      ('academy-duel-ritm-1','La ce ne ajută metronomul?','["Să păstrăm un puls regulat","Să schimbăm cheia","Să acordăm automat vocea"]',0,3),
      ('academy-duel-ritm-1','Ce reprezintă o pauză în partitură?','["Un sunet mai înalt","Un interval de tăcere cu durată stabilită","O repetare obligatorie"]',1,4);
  end if;
end $$;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_quiz_rooms') then
    alter publication supabase_realtime add table public.live_quiz_rooms;
  end if;
end $$;
commit;


-- Jocuri AI individuale: chei/răspunsuri și bugete numai pe server.
begin;

create table if not exists public.ai_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null check (topic in ('teorie','instrumente','ritm')),
  level text not null check (level in ('incepator','mediu')),
  status text not null default 'generating' check (status in ('generating','ready','completed','failed')),
  quiz jsonb,
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers)='array' and jsonb_array_length(answers)<=5),
  score integer not null default 0 check (score between 0 and 5),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
create index if not exists ai_game_sessions_user_created on public.ai_game_sessions(user_id,created_at desc);
create index if not exists ai_game_sessions_created on public.ai_game_sessions(created_at);
alter table public.ai_game_sessions enable row level security;
-- Solutions stay on the server. Browser mutations and direct reads are forbidden.
revoke all on public.ai_game_sessions from public,anon,authenticated;
grant select,insert,update on public.ai_game_sessions to service_role;

create or replace function public.ai_game_reserve(p_user uuid,p_topic text,p_level text) returns uuid
language plpgsql security definer set search_path='' as $$
declare game_id uuid;
begin
  if not exists(select 1 from public.profiles where id=p_user and is_active and role in ('student','elev','teacher','profesor')) then raise exception 'Contul nu poate genera jocuri.' using errcode='42501'; end if;
  if p_topic is null or p_topic not in ('teorie','instrumente','ritm') or p_level is null or p_level not in ('incepator','mediu') then raise exception 'Tema sau nivelul nu este valid.'; end if;
  -- One transaction-wide budget lock works across Railway instances and restarts.
  perform pg_advisory_xact_lock(hashtext('academy-ai-games-budget'));
  if exists(select 1 from public.ai_game_sessions where user_id=p_user and created_at>clock_timestamp()-interval '60 seconds') then
    raise exception 'Așteaptă un minut între două generări.' using errcode='P0429'; end if;
  if (select count(*) from public.ai_game_sessions where user_id=p_user and created_at>clock_timestamp()-interval '24 hours')>=10 then
    raise exception 'Ai folosit cele 10 generări disponibile în ultimele 24 de ore.' using errcode='P0429'; end if;
  if (select count(*) from public.ai_game_sessions where created_at>clock_timestamp()-interval '24 hours')>=200 then
    raise exception 'Limita zilnică de generare a platformei a fost atinsă. Revino mai târziu.' using errcode='P0429'; end if;
  insert into public.ai_game_sessions(user_id,topic,level) values(p_user,p_topic,p_level) returning id into game_id;
  return game_id;
end $$;

create or replace function public.ai_game_answer(p_user uuid,p_game uuid,p_question integer,p_choice integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare game public.ai_game_sessions; question jsonb; previous jsonb; correct integer; next_score integer;
begin
  if not exists(select 1 from public.profiles where id=p_user and is_active and role in ('student','elev','teacher','profesor')) then raise exception 'Contul nu poate juca.' using errcode='42501'; end if;
  select * into game from public.ai_game_sessions where id=p_game and user_id=p_user for update;
  if not found then raise exception 'Jocul nu a fost găsit.' using errcode='P0404'; end if;
  if game.status not in ('ready','completed') or game.created_at<clock_timestamp()-interval '24 hours' then raise exception 'Jocul a expirat sau nu este disponibil.' using errcode='P0409'; end if;
  if p_question is null or p_question not between 0 and 4 or p_choice is null or p_choice not between 0 and 3 then raise exception 'Răspuns invalid.' using errcode='22023'; end if;
  if p_question<jsonb_array_length(game.answers) then
    previous=game.answers->p_question;
    if (previous->>'choice')::integer<>p_choice then raise exception 'Răspunsul a fost deja confirmat.' using errcode='P0409'; end if;
    return previous || jsonb_build_object('score',game.score,'answered',jsonb_array_length(game.answers),'completed',game.status='completed');
  end if;
  if p_question<>jsonb_array_length(game.answers) or game.status='completed' then raise exception 'Răspunde întâi la întrebarea curentă.' using errcode='P0409'; end if;
  question=game.quiz->'questions'->p_question;
  correct=(question->>'correctIndex')::integer;
  next_score=game.score+case when correct=p_choice then 1 else 0 end;
  previous=jsonb_build_object('questionIndex',p_question,'choice',p_choice,'correctIndex',correct,'correct',correct=p_choice,'explanation',question->>'explanation');
  update public.ai_game_sessions set answers=answers||jsonb_build_array(previous),score=next_score,
    status=case when p_question=4 then 'completed' else 'ready' end,
    completed_at=case when p_question=4 then clock_timestamp() else null end where id=game.id;
  return previous || jsonb_build_object('score',next_score,'answered',p_question+1,'completed',p_question=4);
end $$;
revoke all on function public.ai_game_reserve(uuid,text,text),public.ai_game_answer(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.ai_game_reserve(uuid,text,text),public.ai_game_answer(uuid,uuid,integer,integer) to service_role;
commit;

-- Timed audio homework (20261024000003). Apply security_sessions after this base schema.
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
  using (public.academy_active())
  with check (public.academy_active());
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
  using (public.academy_active())
  with check (public.academy_active());
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
  bucket_id <> 'homework-audio' or (public.academy_active()
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
  bucket_id <> 'homework-audio' or (public.academy_active()
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

-- Five study modules (20261024000004).
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

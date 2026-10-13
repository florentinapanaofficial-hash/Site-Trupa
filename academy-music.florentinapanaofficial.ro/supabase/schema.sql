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
  role        text        not null default 'student' check (role in ('student', 'teacher')),
  disciplines text[]      not null default array['orga', 'canto'],
  grade_level text,
  -- Cale în bucketul privat `avatars`, nu URL public: sunt fotografii de minori.
  avatar_path text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_path text;

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
  level        text not null default 'incepator' check (level in ('incepator', 'mediu', 'avansat')),
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
  using (public.is_teacher() or (is_published and public.can_access_piece(id)));

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
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
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

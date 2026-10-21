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

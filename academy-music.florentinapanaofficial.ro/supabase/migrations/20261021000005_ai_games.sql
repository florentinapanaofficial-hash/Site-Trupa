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

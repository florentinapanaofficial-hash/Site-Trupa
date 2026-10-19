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
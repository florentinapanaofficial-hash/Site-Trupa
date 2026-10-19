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

create table if not exists public.student_homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null,
  events jsonb not null check (public.valid_piano_events(events)),
  created_at timestamptz not null default now(),
  unique (student_id, attempt_id)
);
create index if not exists homework_student_idx on public.student_homework(student_id, created_at desc);
alter table public.student_homework enable row level security;
revoke all on public.student_homework from anon, authenticated;
grant select, insert on public.student_homework to authenticated;
drop policy if exists homework_read on public.student_homework;
create policy homework_read on public.student_homework for select to authenticated using (student_id = auth.uid() or public.is_teacher());
drop policy if exists homework_insert on public.student_homework;
create policy homework_insert on public.student_homework for insert to authenticated with check (
  student_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and is_active)
);

commit;
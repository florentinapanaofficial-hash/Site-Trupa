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
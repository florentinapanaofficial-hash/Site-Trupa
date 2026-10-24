begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

-- Bucketul rămâne privat; URL-urile se acordă numai prin sesiunea Academiei.
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

commit;

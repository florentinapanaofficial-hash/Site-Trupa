begin;

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

commit;

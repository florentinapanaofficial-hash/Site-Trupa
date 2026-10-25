begin;

create or replace function public.game_annual_stars() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  year_start timestamptz := date_trunc('year', timezone('Europe/Bucharest', now())) at time zone 'Europe/Bucharest';
  year_end timestamptz;
  result jsonb;
begin
  perform public.game_require_player();
  year_end := year_start + interval '1 year';

  select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.stars desc, ranked.alias, ranked.user_id), '[]'::jsonb)
    into result
  from (
    select gp.user_id, gp.alias, p.avatar_path,
      (coalesce(quizzes.stars, 0) + coalesce(rhythm.stars, 0) + coalesce(duels.stars, 0))::bigint as stars
    from public.game_profiles gp
    join public.profiles p on p.id = gp.user_id and p.is_active and p.role in ('student', 'elev')
    left join lateral (
      select coalesce(sum(score), 0)::bigint as stars
      from public.quiz_results
      where user_id = gp.user_id and created_at >= year_start and created_at < year_end
    ) quizzes on true
    left join lateral (
      select coalesce(sum(hits), 0)::bigint as stars
      from public.rhythm_attempts
      where user_id = gp.user_id and finished_at is not null and started_at >= year_start and started_at < year_end
    ) rhythm on true
    left join lateral (
      select count(*) filter (where answer.points = 100)::bigint as stars
      from public.live_quiz_rooms room
      join public.live_quiz_answers answer on answer.room_id = room.id and answer.user_id = gp.user_id
      where room.status = 'completed' and room.created_at >= year_start and room.created_at < year_end
    ) duels on true
    where gp.visible
  ) ranked
  where ranked.stars > 0;

  return result;
end;
$$;

revoke all on function public.game_annual_stars() from public, anon, authenticated;
grant execute on function public.game_annual_stars() to authenticated;

commit;

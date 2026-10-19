begin;

alter table public.pieces add column if not exists grupa text not null default '';
alter table public.pieces add column if not exists versuri_text text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pieces_canto_text_limits' and conrelid = 'public.pieces'::regclass) then
    alter table public.pieces add constraint pieces_canto_text_limits
      check (length(grupa) <= 100 and length(versuri_text) <= 100000);
  end if;
end
$$;

create index if not exists pieces_canto_group on public.pieces (grupa, title) where discipline = 'canto';

do $$
begin
  if exists (
    select 1 from pg_class where oid = to_regclass('public.canto_playlist') and relkind in ('r', 'p')
  ) then
    if to_regclass('public.canto_playlist_legacy') is not null then
      raise exception 'public.canto_playlist_legacy already exists; refusing to replace the legacy Canto table';
    end if;

    alter table public.canto_playlist rename to canto_playlist_legacy;
  end if;
end
$$;

create or replace view public.canto_playlist with (security_invoker = true) as
select id, title as titlu_piesa, grupa, positive_url as pozitiv_url,
       negative_url as negativ_url, versuri_text, audio_pozitiv_path,
       audio_negativ_path, is_published
from public.pieces
where discipline = 'canto';

revoke all on public.canto_playlist from public, anon, authenticated;
grant select on public.canto_playlist to authenticated;

commit;
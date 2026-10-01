-- ═════════════════════════════════════════════════════════════════
-- SUPABASE — Contor de vizualizări video (/api/views/)
-- Rulează o singură dată în Supabase → SQL Editor. Idempotent.
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.video_stats (
  video_id TEXT PRIMARY KEY CHECK (video_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS activ fără politici: anon/authenticated nu pot citi sau scrie direct; doar service_role (server).
ALTER TABLE public.video_stats ENABLE ROW LEVEL SECURITY;

-- Increment atomic (UPSERT) — evită race condition-ul read-then-write.
CREATE OR REPLACE FUNCTION public.increment_video_view(p_video_id TEXT)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.video_stats AS vs (video_id, views)
  VALUES (p_video_id, 1)
  ON CONFLICT (video_id)
  DO UPDATE SET views = vs.views + 1, updated_at = now()
  RETURNING vs.views;
$$;

REVOKE ALL ON FUNCTION public.increment_video_view(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_video_view(TEXT) TO service_role;

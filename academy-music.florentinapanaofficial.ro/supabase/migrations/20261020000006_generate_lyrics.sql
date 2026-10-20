-- Service-only, atomic per-teacher cooldown. No audio or transcript is retained here.
CREATE TABLE IF NOT EXISTS public.academy_lyrics_requests (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_lyrics_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_lyrics_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.academy_lyrics_requests TO service_role;

CREATE OR REPLACE FUNCTION public.academy_reserve_lyrics_request(teacher_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE reserved uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = teacher_id
        AND role IN ('teacher', 'profesor') AND is_active = true AND coalesce(is_locked, false) = false) THEN
        RETURN false;
    END IF;
    INSERT INTO public.academy_lyrics_requests(user_id) VALUES (teacher_id)
    ON CONFLICT (user_id) DO UPDATE SET last_requested_at = now()
        WHERE public.academy_lyrics_requests.last_requested_at <= now() - interval '2 minutes'
    RETURNING user_id INTO reserved;
    RETURN reserved IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_reserve_lyrics_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.academy_reserve_lyrics_request(uuid) TO service_role;

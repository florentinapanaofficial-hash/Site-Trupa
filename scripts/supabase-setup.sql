-- ═════════════════════════════════════════════════════════════════
-- SUPABASE SETUP — Tabel pentru interacțiuni Live (Like-uri și Realtime)
-- ═════════════════════════════════════════════════════════════════

-- Creează tabela `interactions` pentru a stoca like-urile și alte interacțiuni live
CREATE TABLE IF NOT EXISTS public.interactions (
  id BIGSERIAL PRIMARY KEY,
  stream_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_session TEXT,
  metadata JSONB
);

-- Indici pentru performanță (search rapid după stream_id și type)
CREATE INDEX IF NOT EXISTS idx_interactions_stream_id ON public.interactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON public.interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON public.interactions(created_at DESC);

-- Activează Row-Level Security (RLS)
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- Politică de Insert — permite oricui să insereze date
CREATE POLICY IF NOT EXISTS interactions_insert_policy 
  ON public.interactions FOR INSERT 
  WITH CHECK (true);

-- Politică de Select — permite oricui să citească date
CREATE POLICY IF NOT EXISTS interactions_select_policy 
  ON public.interactions FOR SELECT 
  USING (true);

-- Replicare în Realtime — necesară pentru listeners
ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;

-- Mesaj de confirmare
SELECT 'Tabela `interactions` și politicile RLS au fost setate cu succes!' as status;

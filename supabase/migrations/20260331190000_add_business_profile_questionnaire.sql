-- Extend business_profiles with questionnaire fields
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS segmento_atuacao TEXT,
  ADD COLUMN IF NOT EXISTS objetivo_principal TEXT,
  ADD COLUMN IF NOT EXISTS marca_descricao TEXT,
  ADD COLUMN IF NOT EXISTS canais TEXT[],
  ADD COLUMN IF NOT EXISTS tipos_conteudo TEXT[],
  ADD COLUMN IF NOT EXISTS nivel_experiencia TEXT,
  ADD COLUMN IF NOT EXISTS maior_desafio TEXT,
  ADD COLUMN IF NOT EXISTS como_ia_ajuda TEXT,
  ADD COLUMN IF NOT EXISTS questionario_completo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Table to store business materials metadata
CREATE TABLE IF NOT EXISTS public.business_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own business materials"
  ON public.business_materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own business materials"
  ON public.business_materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own business materials"
  ON public.business_materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own business materials"
  ON public.business_materials FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for business materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-materials', 'business-materials', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Business materials read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-materials' AND auth.uid() = owner);

CREATE POLICY IF NOT EXISTS "Business materials insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-materials' AND auth.uid() = owner);

CREATE POLICY IF NOT EXISTS "Business materials delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'business-materials' AND auth.uid() = owner);

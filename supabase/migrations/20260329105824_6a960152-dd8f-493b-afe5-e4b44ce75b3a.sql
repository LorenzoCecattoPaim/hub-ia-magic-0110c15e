
-- Create generated_images table
CREATE TABLE public.generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  optimized_prompt text,
  image_url text NOT NULL,
  model text NOT NULL,
  quality text NOT NULL DEFAULT 'fast',
  credits_used integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images" ON public.generated_images
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service can insert images" ON public.generated_images
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

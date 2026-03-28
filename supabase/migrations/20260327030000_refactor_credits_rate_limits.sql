-- Harden credit deduction (atomic + standardized error)
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credits
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id
    AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'usage', p_description);
END;
$$;

-- Rate limiting table (10 req/min per user)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_user_id_created_at_idx
  ON public.rate_limits (user_id, created_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate_limits
CREATE POLICY IF NOT EXISTS "Users can view own rate limits" ON public.rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own rate limits" ON public.rate_limits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Cleanup old rate limit rows (keeps table small)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '2 minutes';
END;
$$;

-- AI usage logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text NOT NULL,
  tokens integer NOT NULL,
  cost integer NOT NULL,
  cost_usd numeric(12, 6) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_created_at_idx
  ON public.ai_usage_logs (user_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_usage_logs
CREATE POLICY IF NOT EXISTS "Users can view own ai usage logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own ai usage logs" ON public.ai_usage_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Payments, subscriptions, and credits system update

-- Subscriptions: align plans/status and add gateway fields
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS gateway_subscription_id text;

-- Map legacy plans to new names
UPDATE public.subscriptions SET plan = 'premium' WHERE plan = 'pro';
UPDATE public.subscriptions SET plan = 'basic' WHERE plan = 'free';

-- Legacy free users should not have active access
UPDATE public.subscriptions
SET status = 'canceled',
    current_period_end = COALESCE(current_period_end, now())
WHERE plan = 'basic' AND status = 'active' AND monthly_credits = 0;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('basic', 'premium'));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'canceled'));

ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS monthly_credits;

-- Credits: add last_reset_at
ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS last_reset_at timestamp with time zone;

-- Credit transactions: add reference_id and tighten types
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS reference_id text;

UPDATE public.credit_transactions
SET type = 'purchase', reference_id = COALESCE(reference_id, 'welcome')
WHERE type = 'bonus';

ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('usage', 'subscription', 'purchase'));

-- Webhook events for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id text PRIMARY KEY,
  gateway text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Update add_credits to include reference_id
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text DEFAULT 'purchase',
  p_reference_id text DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credits
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.credits (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, now());
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, p_amount, p_type, p_reference_id, p_description);
END;
$$;

-- Reset credits on subscription renewal (no accumulation)
CREATE OR REPLACE FUNCTION public.reset_credits_for_subscription(
  p_user_id uuid,
  p_amount integer,
  p_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credits (user_id, balance, updated_at, last_reset_at)
  VALUES (p_user_id, p_amount, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET balance = EXCLUDED.balance,
                updated_at = now(),
                last_reset_at = now();

  INSERT INTO public.credit_transactions (user_id, amount, type, reference_id, description)
  VALUES (p_user_id, p_amount, 'subscription', p_reference_id, 'Creditos mensais da assinatura');
END;
$$;

-- Update signup credits/subscription defaults
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credits (user_id, balance, updated_at)
  VALUES (NEW.id, 0, now());

  INSERT INTO public.subscriptions (user_id, plan, status, current_period_start, current_period_end)
  VALUES (NEW.id, 'basic', 'canceled', now(), now());

  RETURN NEW;
END;
$$;

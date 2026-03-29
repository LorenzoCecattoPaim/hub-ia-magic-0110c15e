
-- Fix 1: Drop the UPDATE policy on subscriptions (privilege escalation)
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- Fix 2: Drop INSERT policy on rate_limits (abuse prevention)
DROP POLICY IF EXISTS "Users can insert own rate limits" ON public.rate_limits;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeGateway(value: string | null): "pagarme" | "infinitepay" | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("pagar")) return "pagarme";
  if (lower.includes("infinite")) return "infinitepay";
  return null;
}

function guessGatewayFromHeaders(headers: Headers): "pagarme" | "infinitepay" | null {
  const headerNames = Array.from(headers.keys()).map((h) => h.toLowerCase());
  if (headerNames.some((h) => h.includes("pagarme"))) return "pagarme";
  if (headerNames.some((h) => h.includes("infinitepay"))) return "infinitepay";
  if (headers.get("x-pagarme-signature") || headers.get("x-hub-signature")) return "pagarme";
  if (headers.get("x-infinitepay-signature") || headers.get("x-infinite-signature")) return "infinitepay";
  return null;
}

function extractMetadata(payload: any): Record<string, any> {
  return (
    payload?.metadata ||
    payload?.data?.metadata ||
    payload?.data?.subscription?.metadata ||
    payload?.subscription?.metadata ||
    {}
  );
}

function extractEventId(payload: any): string | null {
  return (
    payload?.event_id ||
    payload?.id ||
    payload?.event?.id ||
    payload?.data?.id ||
    payload?.data?.event_id ||
    payload?.data?.charge_id ||
    payload?.data?.subscription_id ||
    null
  );
}

function extractStatus(payload: any): string {
  return (
    payload?.status ||
    payload?.data?.status ||
    payload?.current_status ||
    payload?.data?.current_status ||
    payload?.event?.type ||
    payload?.type ||
    ""
  );
}

function extractDescription(payload: any): string {
  return (
    payload?.description ||
    payload?.data?.description ||
    payload?.data?.payment?.description ||
    payload?.data?.charge?.description ||
    ""
  );
}

function normalizePlan(plan: string | null): "basic" | "premium" | null {
  if (!plan) return null;
  const lower = plan.toLowerCase();
  if (lower === "basic" || lower === "basico") return "basic";
  if (lower === "premium" || lower === "pro") return "premium";
  return null;
}

function parseUserIdFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/user_id=([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

function parseCreditsFromText(text: string): number | null {
  if (!text) return null;
  const match = text.match(/credits=([0-9]+)/i) || text.match(/creditos=([0-9]+)/i);
  return match ? Number(match[1]) : null;
}

function isApprovedStatus(status: string): boolean {
  const value = status.toLowerCase();
  return [
    "paid",
    "approved",
    "authorized",
    "succeeded",
    "payment_succeeded",
    "subscription_renewed",
    "subscription_paid",
    "invoice_paid",
    "active",
  ].some((token) => value.includes(token));
}

function isCanceledStatus(status: string): boolean {
  const value = status.toLowerCase();
  return ["canceled", "cancelled", "subscription_canceled", "subscription_cancelled", "failed", "refused"].some((token) =>
    value.includes(token)
  );
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(gateway: string, headers: Headers, rawBody: string): Promise<boolean> {
  const secret =
    gateway === "pagarme"
      ? Deno.env.get("PAGARME_WEBHOOK_SECRET")
      : Deno.env.get("INFINITEPAY_WEBHOOK_SECRET");

  if (!secret) return true;

  const headerCandidates = [
    "x-webhook-signature",
    "x-signature",
    "x-hub-signature",
    "x-pagarme-signature",
    "x-infinitepay-signature",
    "x-infinite-signature",
  ];

  const signatureHeader = headerCandidates
    .map((name) => headers.get(name))
    .find((value) => value && value.length > 0);

  if (!signatureHeader) {
    return false;
  }

  const cleaned = signatureHeader
    .replace(/^sha256=/i, "")
    .replace(/^sha1=/i, "")
    .trim()
    .toLowerCase();

  const expected = await hmacSha256(secret, rawBody);
  return cleaned === expected.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const rawBody = await req.text();
  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const url = new URL(req.url);
  const gateway =
    normalizeGateway(url.searchParams.get("gateway")) ||
    normalizeGateway(req.headers.get("x-gateway")) ||
    normalizeGateway(payload?.gateway) ||
    guessGatewayFromHeaders(req.headers);

  if (!gateway) {
    return jsonResponse({ error: "gateway_not_identified" }, 400);
  }

  const signatureOk = await verifySignature(gateway, req.headers, rawBody);
  if (!signatureOk) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  const eventIdRaw = extractEventId(payload);
  const eventId = eventIdRaw ? String(eventIdRaw) : null;
  if (!eventId) {
    return jsonResponse({ error: "missing_event_id" }, 400);
  }

  const metadata = extractMetadata(payload);
  const status = extractStatus(payload);
  const description = extractDescription(payload);

  const userId = metadata?.user_id ? String(metadata.user_id) : parseUserIdFromText(description);
  if (!userId) {
    return jsonResponse({ error: "missing_user_id" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: existingEvent } = await supabaseAdmin
    .from("webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent?.event_id) {
    return jsonResponse({ ok: true, status: "ignored", reason: "duplicate" });
  }

  const { error: insertError } = await supabaseAdmin
    .from("webhook_events")
    .insert({ event_id: eventId, gateway, processed_at: new Date().toISOString() });

  if (insertError) {
    console.error("Webhook insert error:", insertError);
    return jsonResponse({ error: "idempotency_failed" }, 500);
  }

  const tipo = (metadata?.tipo || metadata?.type || "").toLowerCase();
  const isSubscriptionEvent = tipo === "subscription" || gateway === "pagarme";
  const isCreditPurchaseEvent = tipo === "credits" || gateway === "infinitepay";

  if (isSubscriptionEvent) {
    const plan = normalizePlan(metadata?.plano || metadata?.plan);
    if (!plan) {
      return jsonResponse({ error: "invalid_plan" }, 400);
    }

    const subscriptionId =
      payload?.data?.subscription_id ||
      payload?.data?.id ||
      payload?.subscription?.id ||
      payload?.id ||
      null;

    if (isApprovedStatus(status)) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { error: upsertError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            gateway,
            gateway_subscription_id: subscriptionId,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("Subscription upsert error:", upsertError);
        return jsonResponse({ error: "subscription_update_failed" }, 500);
      }

      const creditsAmount = plan === "premium" ? 1200 : 500;
      const { error: resetError } = await supabaseAdmin.rpc("reset_credits_for_subscription", {
        p_user_id: userId,
        p_amount: creditsAmount,
        p_reference_id: eventId,
      });

      if (resetError) {
        console.error("Credit reset error:", resetError);
        return jsonResponse({ error: "credit_reset_failed" }, 500);
      }

      return jsonResponse({ ok: true, status: "processed", type: "subscription", plan });
    }

    if (isCanceledStatus(status)) {
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, plan")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingSub) {
        const { error: updateError } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled", gateway, gateway_subscription_id: subscriptionId })
          .eq("id", existingSub.id);

        if (updateError) {
          console.error("Subscription cancel error:", updateError);
          return jsonResponse({ error: "subscription_cancel_failed" }, 500);
        }
      } else {
        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan,
          status: "canceled",
          gateway,
          gateway_subscription_id: subscriptionId,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString(),
        });
      }

      return jsonResponse({ ok: true, status: "processed", type: "subscription_canceled" });
    }

    return jsonResponse({ ok: true, status: "ignored", reason: "unhandled_status" });
  }

  if (isCreditPurchaseEvent) {
    const creditsFromMetadata = Number(metadata?.credits || metadata?.creditos || 0);
    const creditsFromDescription = parseCreditsFromText(description) || 0;
    const creditsToAdd = creditsFromMetadata || creditsFromDescription;

    if (!creditsToAdd || creditsToAdd <= 0) {
      return jsonResponse({ error: "missing_credits_amount" }, 400);
    }

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    const isPremium = subscription?.plan === "premium";
    const hasAccess =
      subscription?.current_period_end &&
      new Date(subscription.current_period_end).getTime() > Date.now();

    if (!isPremium || !hasAccess) {
      return jsonResponse({ ok: true, status: "ignored", reason: "not_premium" });
    }

    if (!isApprovedStatus(status)) {
      return jsonResponse({ ok: true, status: "ignored", reason: "payment_not_approved" });
    }

    const { error: addError } = await supabaseAdmin.rpc("add_credits", {
      p_user_id: userId,
      p_amount: creditsToAdd,
      p_type: "purchase",
      p_reference_id: eventId,
      p_description: "Compra de creditos avulsos",
    });

    if (addError) {
      console.error("Add credits error:", addError);
      return jsonResponse({ error: "credit_add_failed" }, 500);
    }

    return jsonResponse({ ok: true, status: "processed", type: "credits", credits: creditsToAdd });
  }

  return jsonResponse({ ok: true, status: "ignored", reason: "unknown_event" });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { monthly_credits: number; price: number }> = {
  basic: { monthly_credits: 500, price: 199.0 },
  premium: { monthly_credits: 1200, price: 424.0 },
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildAuthHeader(apiKey: string, scheme: string | null) {
  const normalized = (scheme || "Bearer").toLowerCase();
  if (normalized === "basic") {
    const encoded = btoa(`${apiKey}:`);
    return `Basic ${encoded}`;
  }
  return `${scheme || "Bearer"} ${apiKey}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "nao_autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "token_invalido" }, 401);
    }

    const { plan } = await req.json();
    const selected = PLANS[plan];
    if (!selected) {
      return jsonResponse({ error: "plano_invalido" }, 400);
    }

    const apiUrl =
      Deno.env.get("PAGARME_SUBSCRIPTION_API_URL") ||
      Deno.env.get("PAGARME_API_URL");
    const apiKey = Deno.env.get("PAGARME_API_KEY");

    if (!apiUrl || !apiKey) {
      return jsonResponse({ error: "gateway_nao_configurado" }, 500);
    }

    const metadata = {
      user_id: user.id,
      tipo: "subscription",
      plano: plan,
      origem: "app",
    };

    const payload = {
      plan,
      amount: Math.round(selected.price * 100),
      currency: "BRL",
      interval: "month",
      interval_count: 1,
      customer: {
        external_id: user.id,
        email: user.email,
      },
      metadata,
      description: `Assinatura ${plan} - ${selected.monthly_credits} creditos`,
      return_url: Deno.env.get("PAYMENT_RETURN_URL") || undefined,
    };

    const authScheme = Deno.env.get("PAGARME_AUTH_SCHEME");
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(apiKey, authScheme),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Pagar.me error:", response.status, data);
      return jsonResponse({ error: "erro_gateway", details: data }, 502);
    }

    const paymentUrl = data?.payment_url || data?.checkout_url || data?.url || null;
    const subscriptionId = data?.id || data?.subscription_id || null;

    return jsonResponse({
      success: true,
      plan,
      payment_url: paymentUrl,
      gateway_subscription_id: subscriptionId,
      metadata,
    });
  } catch (error) {
    console.error("Upgrade error:", error);
    return jsonResponse({ error: "erro_ao_processar" }, 500);
  }
});

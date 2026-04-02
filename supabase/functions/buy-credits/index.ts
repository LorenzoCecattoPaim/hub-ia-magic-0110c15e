import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PACKAGES: Record<string, { credits: number; price: number }> = {
  small: { credits: 100, price: 9.9 },
  medium: { credits: 300, price: 24.9 },
  large: { credits: 1000, price: 69.9 },
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

    const { package: pkg } = await req.json();
    const selected = PACKAGES[pkg];
    if (!selected) {
      return jsonResponse({ error: "pacote_invalido" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const hasAccess =
      subscription?.current_period_end &&
      new Date(subscription.current_period_end).getTime() > Date.now();

    if (!subscription || subscription.plan !== "premium" || !hasAccess) {
      return jsonResponse({ error: "somente_premium" }, 403);
    }

    const apiUrl =
      Deno.env.get("INFINITEPAY_PAYMENT_API_URL") ||
      Deno.env.get("INFINITEPAY_API_URL");
    const apiKey = Deno.env.get("INFINITEPAY_API_KEY");

    if (!apiUrl || !apiKey) {
      return jsonResponse({ error: "gateway_nao_configurado" }, 500);
    }

    const metadata = {
      user_id: user.id,
      tipo: "credits",
      credits: selected.credits,
      package: pkg,
    };

    const description = `user_id=${user.id} | tipo=credits | credits=${selected.credits} | package=${pkg}`;

    const payload = {
      amount: Math.round(selected.price * 100),
      currency: "BRL",
      description,
      metadata,
      return_url: Deno.env.get("PAYMENT_RETURN_URL") || undefined,
    };

    const authScheme = Deno.env.get("INFINITEPAY_AUTH_SCHEME");
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
      console.error("InfinitePay error:", response.status, data);
      return jsonResponse({ error: "erro_gateway", details: data }, 502);
    }

    const paymentUrl = data?.payment_url || data?.checkout_url || data?.url || null;

    return jsonResponse({
      success: true,
      package: pkg,
      credits: selected.credits,
      payment_url: paymentUrl,
      metadata,
    });
  } catch (error) {
    console.error("Buy credits error:", error);
    return jsonResponse({ error: "erro_ao_processar" }, 500);
  }
});

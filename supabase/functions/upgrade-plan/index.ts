import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { monthly_credits: number; price: number }> = {
  free: { monthly_credits: 0, price: 0 },
  basic: { monthly_credits: 500, price: 29.90 },
  pro: { monthly_credits: 2000, price: 79.90 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan } = await req.json();
    const selected = PLANS[plan];
    if (!selected) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update subscription
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan,
        status: "active",
        monthly_credits: selected.monthly_credits,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("user_id", user.id);

    if (subError) {
      console.error("Subscription update error:", subError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar plano" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add monthly credits immediately on upgrade
    if (selected.monthly_credits > 0) {
      await supabaseAdmin.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: selected.monthly_credits,
        p_type: "subscription",
        p_description: `Créditos do plano ${plan} (${selected.monthly_credits}/mês)`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, plan, monthly_credits: selected.monthly_credits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upgrade error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar upgrade" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find subscriptions where period has ended and plan is not free
    const now = new Date().toISOString();
    const { data: expiredSubs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .neq("plan", "free")
      .eq("status", "active")
      .lt("current_period_end", now);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: "Erro ao buscar assinaturas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recharged = 0;
    for (const sub of expiredSubs || []) {
      // Add monthly credits
      await supabaseAdmin.rpc("add_credits", {
        p_user_id: sub.user_id,
        p_amount: sub.monthly_credits,
        p_type: "subscription",
        p_description: `Recarga mensal: plano ${sub.plan}`,
      });

      // Update period
      const newStart = new Date();
      const newEnd = new Date(newStart.getTime() + 30 * 24 * 60 * 60 * 1000);
      await supabaseAdmin
        .from("subscriptions")
        .update({
          current_period_start: newStart.toISOString(),
          current_period_end: newEnd.toISOString(),
        })
        .eq("id", sub.id);

      recharged++;
    }

    return new Response(
      JSON.stringify({ success: true, recharged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recharge error:", error);
    return new Response(
      JSON.stringify({ error: "Erro na recarga" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

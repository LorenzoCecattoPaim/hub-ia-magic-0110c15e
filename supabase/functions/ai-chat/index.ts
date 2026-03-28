import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chooseModel(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("analise") || lower.includes("análise") || prompt.length > 500) {
    return "anthropic/claude-3.5-sonnet";
  }
  if (lower.includes("imagem") || lower.includes("foto") || lower.includes("visual")) {
    return "google/gemini-pro-vision";
  }
  if (lower.includes("criativo") || lower.includes("inovador") || lower.includes("ousado")) {
    return "x-ai/grok-3-mini-beta";
  }
  return "openai/gpt-4o-mini";
}

function estimateCostInUSD(tokens: number): number {
  return tokens * 0.000002;
}

function calculateCostFromTokens(tokens: number): number {
  return Math.max(1, Math.ceil(tokens / 500));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Rate limit: 10 requests per minute per user
    const { error: rateInsertError } = await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: userId });

    if (rateInsertError) {
      console.error("Rate limit insert error:", rateInsertError);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: rateCount, error: rateCountError } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (rateCountError) {
      console.error("Rate limit count error:", rateCountError);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((rateCount ?? 0) > 10) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credit balance (minimum 1 to proceed)
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!credits || credits.balance < 1) {
      return new Response(JSON.stringify({ error: "insufficient_credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get business profile
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!businessProfile) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = chooseModel(message);

    const systemPrompt = `Você é um especialista em marketing digital para pequenas empresas brasileiras.

Contexto:
Empresa: ${businessProfile.nome_empresa}
Nicho: ${businessProfile.nicho || "Não informado"}
Tom: ${businessProfile.tom_comunicacao || "informal"}
Público: ${businessProfile.publico_alvo || "Não informado"}

Objetivo:
Gerar conteúdo que aumente vendas.

Regras:
- Sempre que possível, incluir CTA (chamada para ação)
- Ser direto e estratégico
- Adaptar linguagem ao nicho e tom do negócio
- Usar emojis quando apropriado para o tom
- Formatar respostas em markdown para melhor legibilidade`;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
        "X-Title": "AI Marketing Hub",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter error:", errorText);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const responseText =
      aiData.choices?.[0]?.message?.content ||
      "Não consegui gerar uma resposta. Tente reformular seu pedido.";

    const tokens = Number(aiData?.usage?.total_tokens ?? 0);
    const cost = calculateCostFromTokens(tokens);
    const costUsd = estimateCostInUSD(tokens);

    // Deduct credits using admin client (atomic)
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: cost,
      p_description: `Chat IA: ${message.substring(0, 80)}... (modelo: ${model})`,
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
      const errorMessage = String(deductError.message || "").toLowerCase();
      if (errorMessage.includes("insufficient_credits")) {
        return new Response(JSON.stringify({ error: "insufficient_credits" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const newBalance = updatedCredits?.balance ?? (credits.balance ?? 0) - cost;

    const { error: logError } = await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      model,
      tokens,
      cost,
      cost_usd: costUsd,
    });

    if (logError) {
      console.error("AI usage log error:", logError);
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        model_used: model,
        credits_used: cost,
        credits_remaining: newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

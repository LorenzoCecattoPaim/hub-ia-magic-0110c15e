import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { captureSentry } from "../_shared/monitoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");

function chooseModel(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("analise") || lower.includes("análise") || prompt.length > 500) {
    return "openai/gpt-5-mini";
  }
  return "openai/gpt-4o-mini";
}

function estimateCostInUSD(tokens: number): number {
  return tokens * 0.000002;
}

function calculateCostFromTokens(tokens: number): number {
  return Math.max(1, Math.ceil(tokens / 500));
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestCompletion(
  model: string,
  systemPrompt: string,
  message: string,
  requestId: string
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { ok: false, error: "missing_api_key" } as const;
  }

  const aiResponse = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
    },
    60_000
  );

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error(`[${requestId}] Lovable AI error (${model}):`, aiResponse.status, errorText);
    return { ok: false, error: "request_failed", status: aiResponse.status } as const;
  }

  const aiData = await aiResponse.json();
  return { ok: true, data: aiData } as const;
}

export async function handleAiChat(req: Request, deps: { createClientFn?: typeof createClient } = {}) {
  const createClientFn = deps.createClientFn ?? createClient;
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn(`[${requestId}] Missing or invalid Authorization header`);
      return jsonResponse({ error: "not_authenticated" }, 401);
    }

    const supabaseAdmin = createClientFn(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClientFn(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn(`[${requestId}] Auth error:`, userError?.message);
      return jsonResponse({ error: "not_authenticated" }, 401);
    }

    const userId = user.id;

    // Rate limit: 10 requests per minute per user
    const { error: rateInsertError } = await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: userId });

    if (rateInsertError) {
      console.error(`[${requestId}] Rate limit insert error:`, rateInsertError);
      return jsonResponse({ error: "internal_error" }, 500);
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: rateCount, error: rateCountError } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (rateCountError) {
      console.error(`[${requestId}] Rate limit count error:`, rateCountError);
      return jsonResponse({ error: "internal_error" }, 500);
    }

    if ((rateCount ?? 0) > 10) {
      console.warn(`[${requestId}] Rate limited user:`, userId);
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    let payload: any;
    try {
      payload = await req.json();
    } catch {
      console.warn(`[${requestId}] Invalid JSON payload`);
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message) {
      console.warn(`[${requestId}] Missing message field`);
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    console.log(`[${requestId}] AI chat request`, {
      user_id: userId,
      message_length: message.length,
      preview: message.substring(0, 120),
    });

    // Check credit balance (minimum 1 to proceed)
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!credits || credits.balance < 1) {
      return jsonResponse(
        { error: "insufficient_credits", required: 1, balance: credits?.balance ?? 0 },
        402
      );
    }

    // Get business profile
    const { data: businessProfile, error: profileError } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn(`[${requestId}] Business profile fetch error:`, profileError.message);
    }

    const profile = businessProfile ?? {
      nome_empresa: "Sua empresa",
      nicho: "Não informado",
      tom_comunicacao: "informal",
      publico_alvo: "Não informado",
    };

    const model = chooseModel(message);

    const systemPrompt = `Você é um especialista em marketing digital para pequenas empresas brasileiras.

Contexto:
Empresa: ${profile.nome_empresa}
Nicho: ${profile.nicho || "Não informado"}
Tom: ${profile.tom_comunicacao || "informal"}
Público: ${profile.publico_alvo || "Não informado"}

Objetivo:
Gerar conteúdo que aumente vendas.

Regras:
- Sempre que possível, incluir CTA (chamada para ação)
- Ser direto e estratégico
- Adaptar linguagem ao nicho e tom do negócio
- Usar emojis quando apropriado para o tom
- Formatar respostas em markdown para melhor legibilidade`;

    const fallbackModel = model === "openai/gpt-5-mini"
      ? "openai/gpt-4o-mini"
      : "openai/gpt-5-mini";
    let aiResult = await requestCompletion(model, systemPrompt, message, requestId);
    let modelUsed = model;

    if (!aiResult.ok && aiResult.error === "missing_api_key") {
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_missing_api_key",
        level: "error",
        tags: { request_id: requestId },
      });
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_missing_api_key",
        level: "error",
        tags: { request_id: requestId },
      });
      return jsonResponse({ error: "missing_api_key" }, 500);
    }

    if (!aiResult.ok) {
      console.warn(`[${requestId}] Primary model failed, trying fallback`, model);
      aiResult = await requestCompletion(fallbackModel, systemPrompt, message, requestId);
      modelUsed = fallbackModel;
    }

    if (!aiResult.ok) {
      if (aiResult.error === "missing_api_key") {
        await captureSentry(SENTRY_DSN, {
          message: "ai_chat_missing_api_key",
          level: "error",
          tags: { request_id: requestId },
        });
        return jsonResponse({ error: "missing_api_key" }, 500);
      }
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_request_failed",
        level: "error",
        tags: { request_id: requestId, model: modelUsed },
        extra: { error: aiResult.error },
      });
      return jsonResponse({ error: aiResult.error || "request_failed" }, 502);
    }

    const aiData = aiResult.data;
    const responseText =
      aiData.choices?.[0]?.message?.content ||
      "Não consegui gerar uma resposta. Tente reformular seu pedido.";

    if (!responseText || !responseText.trim()) {
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_empty_response",
        level: "error",
        tags: { request_id: requestId, model: modelUsed },
      });
      return jsonResponse({ error: "empty_response" }, 502);
    }

    if (!responseText || !responseText.trim()) {
      return jsonResponse({ error: "empty_response" }, 502);
    }

    const tokens = Number(aiData?.usage?.total_tokens ?? 0);
    const cost = calculateCostFromTokens(tokens);
    const costUsd = estimateCostInUSD(tokens);

    // Deduct credits using admin client (atomic)
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: cost,
      p_description: `Chat IA: ${message.substring(0, 80)}... (modelo: ${modelUsed})`,
    });

    if (deductError) {
      console.error(`[${requestId}] Credit deduction error:`, deductError);
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_credit_deduction_failed",
        level: "error",
        tags: { request_id: requestId, model: modelUsed },
        extra: { error: deductError.message || String(deductError) },
      });
      const errorMessage = String(deductError.message || "").toLowerCase();
      if (errorMessage.includes("insufficient_credits")) {
        return jsonResponse({ error: "insufficient_credits" }, 402);
      }
      return jsonResponse({ error: "credit_deduction_failed" }, 500);
    }

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const newBalance = updatedCredits?.balance ?? (credits.balance ?? 0) - cost;
    const expectedBalance = (credits.balance ?? 0) - cost;
    if (updatedCredits?.balance != null && updatedCredits.balance !== expectedBalance) {
      console.error(`[${requestId}] Credits mismatch`, {
        expected: expectedBalance,
        actual: updatedCredits.balance,
      });
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_credits_mismatch",
        level: "error",
        tags: { request_id: requestId, model: modelUsed },
        extra: { expected: expectedBalance, actual: updatedCredits.balance },
      });
    }
    const expectedBalance = (credits.balance ?? 0) - cost;
    if (updatedCredits?.balance != null && updatedCredits.balance !== expectedBalance) {
      console.error(`[${requestId}] Credits mismatch`, {
        expected: expectedBalance,
        actual: updatedCredits.balance,
      });
    }

    const { error: logError } = await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      model: modelUsed,
      tokens,
      cost,
      cost_usd: costUsd,
    });

    if (logError) {
      console.error(`[${requestId}] AI usage log error:`, logError);
      await captureSentry(SENTRY_DSN, {
        message: "ai_chat_usage_log_failed",
        level: "error",
        tags: { request_id: requestId, model: modelUsed },
        extra: { error: logError.message || String(logError) },
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[${requestId}] AI chat success`, {
      user_id: userId,
      model: modelUsed,
      tokens,
      cost,
      duration_ms: durationMs,
    });

    return jsonResponse({
      response: responseText,
      model_used: modelUsed,
      credits_used: cost,
      credits_remaining: newBalance,
    });
  } catch (error) {
    console.error(`[${requestId}] Edge function error:`, error);
    await captureSentry(SENTRY_DSN, {
      message: "ai_chat_unhandled_error",
      level: "error",
      tags: { request_id: requestId },
      extra: { error: String(error) },
    });
    return jsonResponse({ error: "internal_error" }, 500);
  }
}

Deno.serve((req) => handleAiChat(req));

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

function truncateText(text: string, max = 240) {
  if (text.length <= max) return text;
  return `${text.substring(0, max).trim()}...`;
}

function buildMaterialsContext(materials: Array<{ file_name: string; mime_type: string | null; status: string; extracted_text?: string | null }>) {
  if (!materials?.length) return "";
  return materials.map((item) => {
    const base = `- ${item.file_name} (${item.mime_type || "arquivo"}, ${item.status})`;
    if (item.extracted_text && item.status === "processed") {
      return `${base}: ${truncateText(item.extracted_text)}`;
    }
    return base;
  }).join("\n");
}

function estimateCostInUSD(tokens: number): number {
  return tokens * 0.000002;
}

function calculateCostFromTokens(tokens: number): number {
  return Math.max(1, Math.ceil(tokens / 500));
}

const SYSTEM_PROMPT_TEMPLATE = `Você é um Consultor de Marketing especializado em atender Pequenas e Médias Empresas brasileiras.

CONTEXTO DO NEGÓCIO:
{{business_context}}

OBJETIVO:
Ajudar empresas a ORGANIZAR e EXECUTAR estratégias de marketing com foco em crescimento, posicionamento e aumento de vendas.

ATUAÇÃO:

1. ORGANIZAÇÃO DO MARKETING:
- Planejamento de conteúdo
- Sugestões de campanhas
- Datas comemorativas relevantes
- Análise de concorrência
- Insights de marketing e vendas
- Tendências futuras
- Relatórios estratégicos

2. EXECUÇÃO PRÁTICA:
- Posts para Instagram
- Stories
- Roteiros de Reels
- Campanhas completas
- Cronogramas de marketing
- Estratégias de lançamento
- Ideias de identidade visual (não gerar imagem diretamente)
- Sugestões de métricas

FLUXO OBRIGATÓRIO:
1. SEMPRE começar fazendo perguntas
2. Coletar o máximo de contexto possível
3. Usar [ESTIMADO] quando necessário
4. Só gerar estratégia após entender o negócio

ESTILO:
- Linguagem simples e direta
- Explicar o PORQUÊ de tudo
- Evitar termos técnicos complexos
- Estruturar respostas em listas e markdown
- Usar emojis quando apropriado

REFERÊNCIAS:
- McKinsey
- Landor
- Red Antler

ENTREGA FINAL:
- Diagnóstico
- Pontos fortes
- Pontos de melhoria
- Oportunidades
- Estratégias
- Conteúdo
- Campanhas
- Cronograma
- Plano prático

FINAL:
Sempre terminar com:
"Se quiser, posso aprofundar e montar um plano prático passo a passo pra você executar."`;

function buildSystemPrompt(profile: any, materialsContext: string): string {
  const businessContext = `Empresa: ${profile.nome_empresa}
Nicho: ${profile.nicho || "Não informado"}
Segmento: ${profile.segmento_atuacao || "Não informado"}
Tom: ${profile.tom_comunicacao || "informal"}
Público: ${profile.publico_alvo || "Não informado"}
Personalidade da marca: ${profile.marca_descricao || "Não informado"}
Objetivo principal: ${profile.objetivo_principal || "Vender mais"}
Nível de marketing digital: ${profile.nivel_experiencia || "Não informado"}
Maior desafio: ${profile.maior_desafio || "Não informado"}
Como a IA deve ajudar: ${profile.como_ia_ajuda || "Gerar conteúdo"}
Canais prioritários: ${profile.canais?.length ? profile.canais.join(", ") : "Não informado"}
Tipos de conteúdo: ${profile.tipos_conteudo?.length ? profile.tipos_conteudo.join(", ") : "Não informado"}
${materialsContext ? `\nMateriais do negócio:\n${materialsContext}` : ""}`;

  return SYSTEM_PROMPT_TEMPLATE.replace("{{business_context}}", businessContext);
}

export async function handleAiChat(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "not_authenticated" }, 401);
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
      return jsonResponse({ error: "not_authenticated" }, 401);
    }
    const userId = user.id;

    // Rate limiting
    await supabaseAdmin.from("rate_limits").insert({ user_id: userId });
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: rateCount } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if ((rateCount ?? 0) > 10) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    // Parse body
    let payload: any;
    try { payload = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

    const isStreaming = payload?.stream === true;
    const incomingMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    const legacyMessage = typeof payload?.message === "string" ? payload.message.trim() : "";

    if (!incomingMessages.length && !legacyMessage) {
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    // Credits check
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!credits || credits.balance < 1) {
      return jsonResponse({ error: "insufficient_credits", required: 1, balance: credits?.balance ?? 0 }, 402);
    }

    // Business profile
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const profile = businessProfile ?? {
      nome_empresa: "Sua empresa",
      nicho: "Não informado",
      tom_comunicacao: "informal",
      publico_alvo: "Não informado",
      segmento_atuacao: "Não informado",
      objetivo_principal: "Vender mais",
      marca_descricao: "Não informado",
      canais: [],
      tipos_conteudo: [],
      nivel_experiencia: "Não informado",
      maior_desafio: "Não informado",
      como_ia_ajuda: "Gerar conteúdo",
    };

    // Materials
    const { data: materials } = await supabase
      .from("business_materials")
      .select("file_name, mime_type, status, extracted_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const materialsContext = buildMaterialsContext(materials ?? []);
    const systemPrompt = buildSystemPrompt(profile, materialsContext);

    // Build messages array
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (incomingMessages.length) {
      // Full conversation history from client
      for (const m of incomingMessages) {
        if (m.role && m.content) {
          aiMessages.push({ role: m.role, content: m.content });
        }
      }
    } else {
      aiMessages.push({ role: "user", content: legacyMessage });
    }

    const lastUserMsg = aiMessages.filter((m) => m.role === "user").pop()?.content || "";
    console.log(`[${requestId}] AI chat request`, {
      user_id: userId,
      message_count: aiMessages.length - 1,
      preview: lastUserMsg.substring(0, 120),
      streaming: isStreaming,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "missing_api_key" }, 500);
    }

    const model = "google/gemini-3-flash-preview";

    // Call AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        stream: isStreaming,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[${requestId}] AI gateway error:`, aiResponse.status, errText);
      if (aiResponse.status === 429) return jsonResponse({ error: "rate_limited" }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "insufficient_credits" }, 402);
      return jsonResponse({ error: "ai_gateway_error" }, 502);
    }

    // Deduct credits (estimate 1 credit for streaming, adjust later if needed)
    const estimatedCost = 1;
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: estimatedCost,
      p_description: `Chat IA: ${lastUserMsg.substring(0, 80)}...`,
    });

    if (deductError) {
      console.error(`[${requestId}] Credit deduction error:`, deductError);
      const msg = String(deductError.message || "").toLowerCase();
      if (msg.includes("insufficient_credits")) {
        return jsonResponse({ error: "insufficient_credits" }, 402);
      }
    }

    // Log usage
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      model,
      tokens: 0,
      cost: estimatedCost,
      cost_usd: 0,
    });

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (isStreaming) {
      // Stream SSE response through to client
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const reader = aiResponse.body!.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            // Send metadata event
            const meta = JSON.stringify({
              credits_used: estimatedCost,
              credits_remaining: updatedCredits?.balance ?? 0,
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error(`[${requestId}] Stream error:`, e);
            controller.close();
          }
        },
      });

      const durationMs = Date.now() - startedAt;
      console.log(`[${requestId}] AI chat streaming started`, { user_id: userId, model, duration_ms: durationMs });

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming response
    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";

    const durationMs = Date.now() - startedAt;
    console.log(`[${requestId}] AI chat success`, { user_id: userId, model, duration_ms: durationMs });

    return jsonResponse({
      response: responseText,
      model_used: model,
      credits_used: estimatedCost,
      credits_remaining: updatedCredits?.balance ?? 0,
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

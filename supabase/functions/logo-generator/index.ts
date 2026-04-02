import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

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

const SYSTEM_PROMPT = `Você é um **Designer Gráfico Especialista em Criação de Logotipos e Identidade Visual**, focado em **Pequenas e Médias Empresas Brasileiras**.

# 🎯 MISSÃO
Conduzir o usuário de forma estruturada até a criação de um logotipo profissional e suas variações.

# 🚨 REGRA CRÍTICA (FLUXO OBRIGATÓRIO)
⚠️ NUNCA gere logotipos ou sugestões visuais antes de coletar TODAS as informações abaixo.

# 🧩 ETAPA 1 — COLETA DE DADOS (OBRIGATÓRIA)
Faça perguntas UMA POR VEZ (modo conversacional):

1. Qual é o **NOME COMPLETO DA MARCA**? (O logotipo deve conter EXATAMENTE esse nome)
2. Qual é o **MERCADO DE ATUAÇÃO**? Sugira exemplos: transporte/obras, turismo/viagens, alimentação/restaurante, vestuário/acessórios, beleza/saúde, finanças/empreendedorismo, educação, advocacia/engenharia, loja de materiais de construção, decoração, automóveis, outros
3. Qual é o **ESTILO DA MARCA**? Opções: tradicional/séria, jovem/descontraída, minimalista/futurista, maximalista/sensorial
4. Quais **CORES deseja no logotipo**? Ofereça: "Posso escolher as melhores cores para você, se preferir."

# 🎨 ETAPA 2 — DEFINIÇÃO DA IDENTIDADE
Após coletar tudo, defina: Paleta de cores (com justificativa), Tipografia sugerida, Estilo visual, Sensação da marca (ex: luxo, confiança, inovação)

# 🖼️ ETAPA 3 — GERAÇÃO DOS LOGOTIPOS
Quando tiver todas as informações e estiver pronto para gerar, responda EXATAMENTE neste formato JSON (e NADA mais):

\`\`\`json
{"action":"generate_logos","prompts":[{"id":1,"description":"Descrição estratégica do logo 1","prompt":"prompt detalhado para geração de imagem do logo 1 com o nome EXATO da marca"},{"id":2,"description":"Descrição estratégica do logo 2","prompt":"prompt detalhado para geração de imagem do logo 2 com o nome EXATO da marca"},{"id":3,"description":"Descrição estratégica do logo 3","prompt":"prompt detalhado para geração de imagem do logo 3 com o nome EXATO da marca"}]}
\`\`\`

IMPORTANTE para os prompts de imagem:
- Sempre inclua "professional logo design" e "clean background"
- Inclua o nome exato da marca no prompt
- Cada logo deve ser DISTINTO (não variações mínimas)
- Descreva cores, estilo, tipografia e elementos visuais

# 🔁 ETAPA 4 — ITERAÇÃO
Após o usuário ver os logos, pergunte: "Qual você gostou mais?" e "Deseja ajustes ou novos estilos?"
Se pedir ajustes, gere novos prompts no mesmo formato JSON.

# ✅ ETAPA 5 — FINALIZAÇÃO
Quando o usuário escolher, gere variações no formato:
\`\`\`json
{"action":"generate_variations","base_prompt":"prompt do logo escolhido","variations":["original refinado","versão prata metalizado sobre fundo escuro","versão dourado metalizado sobre fundo escuro","versão preto sobre fundo branco","versão branco sobre fundo preto"]}
\`\`\`

# 💬 TOM: Profissional, simples, direto, consultivo.
# 🚫 NÃO gerar logo antes das perguntas, NÃO adicionar textos extras, NÃO ignorar feedback.`;

export async function handleLogoGenerator(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
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
    if (userError || !user) return jsonResponse({ error: "not_authenticated" }, 401);
    const userId = user.id;

    let payload: any;
    try { payload = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

    const messages: Array<{ role: string; content: string }> = payload?.messages ?? [];
    const mode = payload?.mode; // "generate_image" for image gen requests

    if (mode === "generate_image") {
      // Generate a single logo image from a prompt
      const prompt = payload?.prompt;
      if (!prompt) return jsonResponse({ error: "missing_prompt" }, 400);

      // Check credits (5 per logo image)
      const CREDIT_COST = 5;
      const { data: credits } = await supabaseAdmin
        .from("credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (!credits || credits.balance < CREDIT_COST) {
        return jsonResponse({ error: "insufficient_credits", required: CREDIT_COST, balance: credits?.balance ?? 0 }, 402);
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return jsonResponse({ error: "missing_api_key" }, 500);

      // Generate image via Lovable AI
      const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!imgResponse.ok) {
        const errText = await imgResponse.text();
        console.error(`[${requestId}] Image generation error:`, imgResponse.status, errText);
        if (imgResponse.status === 429) return jsonResponse({ error: "rate_limited" }, 429);
        if (imgResponse.status === 402) return jsonResponse({ error: "insufficient_credits" }, 402);
        return jsonResponse({ error: "image_generation_failed" }, 502);
      }

      const imgData = await imgResponse.json();
      const imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        console.error(`[${requestId}] No image in response`);
        return jsonResponse({ error: "no_image_generated" }, 502);
      }

      // Deduct credits
      await supabaseAdmin.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: CREDIT_COST,
        p_description: `Logo: ${prompt.substring(0, 80)}...`,
      });

      // Log usage
      await supabaseAdmin.from("ai_usage_logs").insert({
        user_id: userId,
        model: "google/gemini-3-pro-image-preview",
        tokens: 0,
        cost: CREDIT_COST,
        cost_usd: 0,
      });

      const { data: updatedCredits } = await supabaseAdmin
        .from("credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();

      return jsonResponse({
        image_url: imageUrl,
        credits_used: CREDIT_COST,
        credits_remaining: updatedCredits?.balance ?? 0,
      });
    }

    // Chat mode - conversation with logo consultant
    if (!messages.length) return jsonResponse({ error: "no_messages" }, 400);

    // Credits check (1 per chat message)
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!credits || credits.balance < 1) {
      return jsonResponse({ error: "insufficient_credits", required: 1, balance: credits?.balance ?? 0 }, 402);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "missing_api_key" }, 500);

    // Get business profile for context
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("nome_empresa, nicho, segmento_atuacao, publico_alvo, marca_descricao")
      .eq("user_id", userId)
      .maybeSingle();

    let systemPrompt = SYSTEM_PROMPT;
    if (businessProfile) {
      systemPrompt += `\n\nCONTEXTO DO NEGÓCIO DO USUÁRIO:
Empresa: ${businessProfile.nome_empresa}
Nicho: ${businessProfile.nicho || "Não informado"}
Segmento: ${businessProfile.segmento_atuacao || "Não informado"}
Público: ${businessProfile.publico_alvo || "Não informado"}
Marca: ${businessProfile.marca_descricao || "Não informado"}`;
    }

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.filter((m: any) => m.role && m.content),
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[${requestId}] AI error:`, aiResponse.status, errText);
      if (aiResponse.status === 429) return jsonResponse({ error: "rate_limited" }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "insufficient_credits" }, 402);
      return jsonResponse({ error: "ai_gateway_error" }, 502);
    }

    // Deduct 1 credit for chat
    await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: 1,
      p_description: "Chat Logo Generator",
    });

    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      model: "google/gemini-3-flash-preview",
      tokens: 0,
      cost: 1,
      cost_usd: 0,
    });

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    // Stream response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = aiResponse.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          const meta = JSON.stringify({
            credits_used: 1,
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

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
}

Deno.serve((req) => handleLogoGenerator(req));

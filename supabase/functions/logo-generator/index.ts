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

const DEFAULT_NEGATIVE = "blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text, ugly, duplicate, morbid, mutilated, poorly drawn";
const CHAT_CREDIT_COST = 1;
const LOGO_BATCH_CREDIT_COST = 5;
const VARIATIONS_CREDIT_COST = 5;

type LogoState =
  | "coleta_nome"
  | "coleta_mercado"
  | "coleta_estilo"
  | "coleta_cores"
  | "definicao_identidade"
  | "geracao_logos"
  | "iteracao"
  | "finalizacao";

type LogoProject = {
  state: LogoState;
  name?: string;
  market?: string;
  style?: string;
  colors?: string;
  identity?: string;
  history?: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
  last_action_id?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined) {
  return (value || "").trim();
}

function ensurePromptHasLogoTags(prompt: string) {
  let next = prompt;
  if (!/professional logo design/i.test(next)) next += ", professional logo design";
  if (!/clean background/i.test(next)) next += ", clean background";
  return next.trim();
}

function extractJsonAction(text: string): any | null {
  const fenced = text.match(/```json\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1]); } catch { return null; }
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try { return JSON.parse(trimmed); } catch { return null; }
  }
  return null;
}

function applyUserInputToProject(project: LogoProject, message: string): LogoProject {
  const next = { ...project };
  const value = normalizeText(message);
  if (!value) return next;

  switch (next.state) {
    case "coleta_nome":
      next.name = value;
      next.state = "coleta_mercado";
      break;
    case "coleta_mercado":
      next.market = value;
      next.state = "coleta_estilo";
      break;
    case "coleta_estilo":
      next.style = value;
      next.state = "coleta_cores";
      break;
    case "coleta_cores":
      next.colors = value;
      next.state = "definicao_identidade";
      break;
    default:
      break;
  }

  return next;
}

function missingFieldState(project: LogoProject): LogoState | null {
  if (!project.name) return "coleta_nome";
  if (!project.market) return "coleta_mercado";
  if (!project.style) return "coleta_estilo";
  if (!project.colors) return "coleta_cores";
  return null;
}

function missingFieldPrompt(state: LogoState) {
  switch (state) {
    case "coleta_nome":
      return "Qual é o nome completo da sua marca?";
    case "coleta_mercado":
      return "Em qual mercado você atua? (ex: alimentação, beleza, educação, etc.)";
    case "coleta_estilo":
      return "Qual estilo representa sua marca? (tradicional, jovem, minimalista, maximalista, etc.)";
    case "coleta_cores":
      return "Quais cores você deseja no logotipo? Posso escolher por você se preferir.";
    default:
      return "Vamos seguir com as informações do seu logotipo.";
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 90_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runLogoAgent(params: {
  messages: Array<{ role: string; content: string }>;
  requestId: string;
}) {
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
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...params.messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    },
    60_000
  );

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error(`[${params.requestId}] Logo agent error:`, aiResponse.status, errText);
    return { ok: false, error: "request_failed", status: aiResponse.status } as const;
  }

  const data = await aiResponse.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { ok: true, data: content } as const;
}

async function generateLogoImage(
  prompt: string,
  leonardoKey: string,
  requestId: string
): Promise<string> {
  const finalPrompt = ensurePromptHasLogoTags(prompt);

  const createRes = await fetchWithTimeout(
    "https://cloud.leonardo.ai/api/rest/v1/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${leonardoKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt: DEFAULT_NEGATIVE,
        width: 1024,
        height: 1024,
        num_images: 1,
        modelId: "b24e16ff-06e3-43eb-8d33-4416c2d75876",
        presetStyle: "DYNAMIC",
      }),
    },
    60_000
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`[${requestId}] [Leonardo] Create error:`, createRes.status, errText);
    if (createRes.status === 429) throw new Error("rate_limited");
    throw new Error("leonardo_generation_failed");
  }

  const createData = await createRes.json();
  const generationId = createData?.sdGenerationJob?.generationId;
  if (!generationId) {
    throw new Error("leonardo_generation_failed");
  }

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetchWithTimeout(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
      { headers: { Authorization: `Bearer ${leonardoKey}`, Accept: "application/json" } },
      30_000
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const gen = pollData?.generations_by_pk;

    if (gen?.status === "COMPLETE") {
      const imageUrl = gen.generated_images?.[0]?.url;
      if (imageUrl) return imageUrl;
      throw new Error("leonardo_no_image_url");
    }

    if (gen?.status === "FAILED") {
      throw new Error("leonardo_generation_failed");
    }
  }

  throw new Error("leonardo_timeout");
}

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

    const message = normalizeText(payload?.message);
    const incomingMessages: Array<{ role: string; content: string }> = Array.isArray(payload?.messages)
      ? payload.messages.filter((m: any) => m?.role && m?.content)
      : [];
    const actionId: string | undefined = payload?.action_id;

    if (!message) {
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    let project: LogoProject = payload?.logo_project || { state: "coleta_nome" };
    project = {
      state: project.state || "coleta_nome",
      name: project.name,
      market: project.market,
      style: project.style,
      colors: project.colors,
      identity: project.identity,
      history: project.history || [],
      last_action_id: project.last_action_id,
    };

    if (actionId && project.last_action_id === actionId) {
      return jsonResponse({ error: "duplicate_action" }, 409);
    }

    project = applyUserInputToProject(project, message);
    project.history = [...(project.history || []), { role: "user", content: message, timestamp: nowIso() }];

    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const currentBalance = credits?.balance ?? 0;
    if (currentBalance < CHAT_CREDIT_COST) {
      return jsonResponse({ error: "insufficient_credits", required: CHAT_CREDIT_COST, balance: currentBalance }, 402);
    }

    const agentMessages = incomingMessages.length
      ? incomingMessages
      : project.history?.map((m) => ({ role: m.role, content: m.content })) || [];

    const agentResult = await runLogoAgent({ messages: agentMessages, requestId });
    if (!agentResult.ok) {
      if (agentResult.error === "missing_api_key") {
        return jsonResponse({ error: "missing_api_key" }, 500);
      }
      return jsonResponse({ error: "ai_gateway_error" }, 502);
    }

    let responseText = agentResult.data?.trim() || "";
    let action = extractJsonAction(responseText);

    let logos: Array<{ id: number; title: string; description: string; prompt: string; image_url: string }> = [];
    let creditsUsedImages = 0;

    if (action?.action === "generate_logos") {
      const missing = missingFieldState(project);
      if (missing) {
        project.state = missing;
        responseText = missingFieldPrompt(missing);
        action = null;
      } else {
        project.state = "geracao_logos";
        const prompts = Array.isArray(action.prompts) ? action.prompts : [];
        if (prompts.length !== 3) {
          return jsonResponse({ error: "invalid_action_payload" }, 500);
        }

        const totalRequired = CHAT_CREDIT_COST + LOGO_BATCH_CREDIT_COST;
        if (currentBalance < totalRequired) {
          return jsonResponse({
            error: "insufficient_credits",
            required: totalRequired,
            balance: currentBalance,
          }, 402);
        }

        const deductImage = await supabaseAdmin.rpc("deduct_credits", {
          p_user_id: userId,
          p_amount: LOGO_BATCH_CREDIT_COST,
          p_description: "Geração de 3 logos",
        });

        if (deductImage.error) {
          const errMessage = String(deductImage.error.message || "");
          if (errMessage.toLowerCase().includes("insufficient_credits")) {
            return jsonResponse({ error: "insufficient_credits", required: LOGO_BATCH_CREDIT_COST, balance: currentBalance }, 402);
          }
          return jsonResponse({ error: "credit_deduction_failed" }, 500);
        }

        const LEONARDO_API_KEY = Deno.env.get("LEONARDO_API_KEY");
        if (!LEONARDO_API_KEY) return jsonResponse({ error: "missing_api_key" }, 500);

        const results = await Promise.allSettled(
          prompts.map(async (p: any) => {
            const promptText = ensurePromptHasLogoTags(String(p.prompt || ""));
            const imageUrl = await generateLogoImage(promptText, LEONARDO_API_KEY, requestId);
            return {
              id: Number(p.id) || 0,
              title: `Logo ${p.id}`,
              description: String(p.description || "").trim(),
              prompt: promptText,
              image_url: imageUrl,
            };
          })
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length) {
          return jsonResponse({ error: "image_generation_failed" }, 502);
        }

        logos = results.map((r) => (r as PromiseFulfilledResult<any>).value);
        creditsUsedImages = LOGO_BATCH_CREDIT_COST;
        responseText = "Aqui estão 3 opções de logotipo. Qual você gostou mais?";
        project.state = "iteracao";
      }
    }

    if (action?.action === "generate_variations") {
      const basePrompt = String(action.base_prompt || "").trim();
      const variations = Array.isArray(action.variations) ? action.variations : [];
      if (!basePrompt || variations.length === 0) {
        return jsonResponse({ error: "invalid_action_payload" }, 500);
      }

      const totalRequired = CHAT_CREDIT_COST + VARIATIONS_CREDIT_COST;
      if (currentBalance < totalRequired) {
        return jsonResponse({
          error: "insufficient_credits",
          required: totalRequired,
          balance: currentBalance,
        }, 402);
      }

      const deductImage = await supabaseAdmin.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: VARIATIONS_CREDIT_COST,
        p_description: "Variações finais de logotipo",
      });

      if (deductImage.error) {
        const errMessage = String(deductImage.error.message || "");
        if (errMessage.toLowerCase().includes("insufficient_credits")) {
          return jsonResponse({ error: "insufficient_credits", required: VARIATIONS_CREDIT_COST, balance: currentBalance }, 402);
        }
        return jsonResponse({ error: "credit_deduction_failed" }, 500);
      }

      const LEONARDO_API_KEY = Deno.env.get("LEONARDO_API_KEY");
      if (!LEONARDO_API_KEY) return jsonResponse({ error: "missing_api_key" }, 500);

      const results = await Promise.allSettled(
        variations.map(async (desc: string, idx: number) => {
          const promptText = ensurePromptHasLogoTags(`${basePrompt}, ${desc}`);
          const imageUrl = await generateLogoImage(promptText, LEONARDO_API_KEY, requestId);
          return {
            id: idx + 1,
            title: `Variação ${idx + 1}`,
            description: desc,
            prompt: promptText,
            image_url: imageUrl,
          };
        })
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length) {
        return jsonResponse({ error: "image_generation_failed" }, 502);
      }

      logos = results.map((r) => (r as PromiseFulfilledResult<any>).value);
      creditsUsedImages = VARIATIONS_CREDIT_COST;
      responseText = "Aqui estão as variações finais do logotipo.";
      project.state = "finalizacao";
    }

    project.history = [...(project.history || []), { role: "assistant", content: responseText, timestamp: nowIso() }];
    project.last_action_id = actionId || project.last_action_id;

    const deductChat = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: CHAT_CREDIT_COST,
      p_description: "Chat Logo Generator",
    });

    if (deductChat.error) {
      const errMessage = String(deductChat.error.message || "");
      if (errMessage.toLowerCase().includes("insufficient_credits")) {
        return jsonResponse({ error: "insufficient_credits", required: CHAT_CREDIT_COST, balance: currentBalance }, 402);
      }
      return jsonResponse({ error: "credit_deduction_failed" }, 500);
    }

    if (creditsUsedImages > 0) {
      await supabaseAdmin.from("ai_usage_logs").insert({
        user_id: userId,
        model: "leonardo-ai",
        tokens: 0,
        cost: creditsUsedImages,
        cost_usd: 0,
      });
    }

    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: userId,
      model: "openai/gpt-5-mini",
      tokens: 0,
      cost: CHAT_CREDIT_COST,
      cost_usd: 0,
    });

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    return jsonResponse({
      reply: responseText,
      state: project.state,
      logo_project: project,
      logos,
      credits_used: CHAT_CREDIT_COST + creditsUsedImages,
      credits_remaining: updatedCredits?.balance ?? 0,
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
}

Deno.serve((req) => handleLogoGenerator(req));

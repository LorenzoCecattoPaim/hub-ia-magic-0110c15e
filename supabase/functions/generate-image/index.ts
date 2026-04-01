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

const GPT_SYSTEM_PROMPT = `You are a world-class prompt engineer for AI image generation (Leonardo AI).

Your job: transform ANY user idea into TWO distinct, high-quality image prompts.

Each prompt MUST follow this structure:
[MAIN SUBJECT], [VISUAL STYLE], [DETAILS & TEXTURES], [LIGHTING], [CAMERA/COMPOSITION], [QUALITY TAGS]

RULES:
- Generate exactly 2 prompts with DIFFERENT creative angles (different composition, style, or perspective)
- Each prompt MUST be under 1000 characters
- Always include: "4k, ultra detailed, sharp focus, professional composition, high quality"
- For marketing/advertising: add "commercial photography, high conversion design, visually appealing"
- For logos: add "minimalist, vector style, clean design, scalable, brand identity"
- For products: add "studio lighting, e-commerce ready, clean background, product photography"
- For Instagram: add "social media optimized, engaging, scroll-stopping, vibrant"
- Lighting keywords: soft lighting, dramatic lighting, golden hour, studio lighting, neon glow
- Camera keywords: 50mm lens, wide angle, close-up, bird's eye view, depth of field

NEGATIVE PROMPT (same for both):
Always include: blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text, ugly, duplicate, morbid, mutilated, poorly drawn

OUTPUT FORMAT (STRICT JSON ONLY — no explanations):
{
  "prompt_1": "...",
  "prompt_2": "...",
  "negative_prompt": "..."
}`;

const DEFAULT_NEGATIVE = "blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text, ugly, duplicate, morbid, mutilated, poorly drawn";
const MAX_PROMPT_LENGTH = 1000;

interface OptimizedPrompts {
  prompt_1: string;
  prompt_2: string;
  negative_prompt: string;
}

function truncateText(text: string, max = 160) {
  if (text.length <= max) return text;
  return `${text.substring(0, max).trim()}...`;
}

function buildBusinessContext(
  profile: Record<string, any> | null,
  materials: Array<{ file_name: string; extracted_text?: string | null; status: string }> | null
) {
  if (!profile) return "";
  const parts = [
    profile.segmento_atuacao ? `Segmento: ${profile.segmento_atuacao}` : null,
    profile.nicho ? `Nicho: ${profile.nicho}` : null,
    profile.tom_comunicacao ? `Tom: ${profile.tom_comunicacao}` : null,
    profile.publico_alvo ? `Público: ${profile.publico_alvo}` : null,
    profile.marca_descricao ? `Marca: ${profile.marca_descricao}` : null,
    profile.objetivo_principal ? `Objetivo: ${profile.objetivo_principal}` : null,
    profile.canais?.length ? `Canais: ${profile.canais.join(", ")}` : null,
  ].filter(Boolean);

  if (materials?.length) {
    const snippets = materials.slice(0, 2).map((mat) => {
      if (mat.extracted_text && mat.status === "processed") {
        return `Material: ${truncateText(mat.extracted_text)}`;
      }
      return `Material: ${mat.file_name}`;
    });
    parts.push(...snippets);
  }

  return parts.join(" | ");
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

async function optimizePrompts(
  userInput: string,
  templateContext: string,
  apiKey: string,
  requestId: string
): Promise<OptimizedPrompts> {
  const content = templateContext
    ? `${userInput}\n\nContext/Style: ${templateContext}`
    : userInput;

  console.log(`[${requestId}] [GPT] Sending optimization request...`);

  const response = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: GPT_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 800,
      }),
    },
    60_000
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[${requestId}] [GPT] API error:`, response.status, errText);
    throw new Error(`GPT API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty GPT response");

  console.log(`[${requestId}] [GPT] Response received, length:`, text.length);

  const parsed = JSON.parse(text);

  if (!parsed.prompt_1 || !parsed.prompt_2) {
    throw new Error("Invalid GPT JSON structure — missing prompt_1 or prompt_2");
  }

  // Truncate if needed
  const truncate = (s: string) => s.length > MAX_PROMPT_LENGTH ? s.substring(0, MAX_PROMPT_LENGTH) : s;

  return {
    prompt_1: truncate(parsed.prompt_1),
    prompt_2: truncate(parsed.prompt_2),
    negative_prompt: truncate(parsed.negative_prompt || DEFAULT_NEGATIVE),
  };
}

async function generateImageLeonardo(
  prompt: string,
  negativePrompt: string,
  leonardoKey: string,
  width: number,
  height: number,
  requestId: string
): Promise<string> {
  console.log(`[${requestId}] [Leonardo] Creating generation - prompt length:`, prompt.length, "size:", width, "x", height);

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
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
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
    console.error(`[${requestId}] [Leonardo] No generationId:`, JSON.stringify(createData).substring(0, 500));
    throw new Error("leonardo_generation_failed");
  }

  console.log(`[${requestId}] [Leonardo] generationId:`, generationId);

  // Poll for completion (max ~90s)
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetchWithTimeout(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
      { headers: { Authorization: `Bearer ${leonardoKey}`, Accept: "application/json" } },
      30_000
    );

    if (!pollRes.ok) {
      console.warn(`[${requestId}] [Leonardo] Poll failed, attempt`, i, pollRes.status);
      continue;
    }

    const pollData = await pollRes.json();
    const gen = pollData?.generations_by_pk;

    if (gen?.status === "COMPLETE") {
      const imageUrl = gen.generated_images?.[0]?.url;
      if (imageUrl) {
        console.log(`[${requestId}] [Leonardo] Image ready:`, imageUrl.substring(0, 80));
        return imageUrl;
      }
      throw new Error("leonardo_no_image_url");
    }

    if (gen?.status === "FAILED") {
      console.error(`[${requestId}] [Leonardo] Generation failed`);
      throw new Error("leonardo_generation_failed");
    }
  }

  throw new Error("leonardo_timeout");
}
export async function handleGenerateImage(req: Request, deps: { createClientFn?: typeof createClient } = {}) {
  const createClientFn = deps.createClientFn ?? createClient;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    let body: any;
    try {
      body = await req.json();
    } catch {
      console.warn(`[${requestId}] Invalid JSON payload`);
      return jsonResponse({ error: "invalid_json" }, 400);
    }
    const userInput = body?.prompt?.trim();
    const quality: string = body?.quality === "pro" ? "pro" : "fast";
    const template: string = body?.template || "";
    const format: string = body?.format || "square"; // square | vertical

    if (!userInput || userInput.length < 3 || userInput.length > 2000) {
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: materials } = await supabase
      .from("business_materials")
      .select("file_name, extracted_text, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2);

    console.log(`[${requestId}] === Generate Image Request ===`);
    console.log(`[${requestId}] User:`, user.id, "| Quality:", quality, "| Template:", template, "| Format:", format);
    console.log(`[${requestId}] Input:`, userInput.substring(0, 120));

    // Credit cost — covers both images
    const creditCost = quality === "pro" ? 15 : 5;

    // Check credits
    const { data: credits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();


    if (!credits || credits.balance < creditCost) {
      return jsonResponse({
        error: "insufficient_credits",
        code: "insufficient_credits",
        required: creditCost,
        balance: credits?.balance ?? 0,
      }, 402);
    }

    // Rate limit: 5 per minute
    const { error: rateInsertError } = await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: user.id });
    if (rateInsertError) {
      console.error(`[${requestId}] [RateLimit] Insert error:`, rateInsertError);
      return jsonResponse({ error: "internal_error" }, 500);
    }

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: rateCount } = await supabaseAdmin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneMinuteAgo);

    if ((rateCount ?? 0) > 5) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const LEONARDO_API_KEY = Deno.env.get("LEONARDO_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error(`[${requestId}] LOVABLE_API_KEY not configured`);
      await captureSentry(SENTRY_DSN, {
        message: "lovable_api_key_missing",
        level: "error",
        tags: { request_id: requestId },
      });
      return jsonResponse({ error: "missing_api_key" }, 500);
    }
    if (!LEONARDO_API_KEY) {
      console.error(`[${requestId}] LEONARDO_API_KEY not configured`);
      await captureSentry(SENTRY_DSN, {
        message: "leonardo_api_key_missing",
        level: "error",
        tags: { request_id: requestId },
      });
      return jsonResponse({ error: "missing_api_key" }, 500);
    }

    // Dimensions based on format
    let width = 1024;
    let height = 1024;
    if (format === "vertical") {
      width = 832;
      height = 1216;
    }

    // Template context
    let templateContext = "";
    switch (template) {
      case "instagram-square":
        templateContext = "Instagram post, square 1:1 format, vibrant colors, social media optimized, scroll-stopping, engaging";
        break;
      case "instagram-vertical":
        templateContext = "Instagram post, vertical 2:3 format, vibrant colors, social media optimized, scroll-stopping, engaging";
        width = 832;
        height = 1216;
        break;
      case "logo":
        templateContext = "Logo design, minimalist, vector style, clean, scalable, brand identity, white background";
        break;
      case "product":
        templateContext = "Product photography, studio lighting, clean background, e-commerce ready, commercial";
        break;
    }

    const businessContext = buildBusinessContext(businessProfile, materials ?? []);
    const contextBundle = [templateContext, businessContext].filter(Boolean).join(" | ");

    // STEP 1: GPT prompt optimization (with 1 retry)
    let optimized: OptimizedPrompts;

    try {
        optimized = await optimizePrompts(userInput, contextBundle, LOVABLE_API_KEY, requestId);
      } catch (firstError) {
      console.error(`[${requestId}] [GPT] First attempt failed, retrying:`, firstError);
      try {
        optimized = await optimizePrompts(userInput, contextBundle, LOVABLE_API_KEY, requestId);
      } catch (retryError) {
        console.error(`[${requestId}] [GPT] Retry also failed, using fallback:`, retryError);
        const fallback = `${userInput}, 4k, ultra detailed, sharp focus, professional composition, high quality`.substring(0, MAX_PROMPT_LENGTH);
        optimized = {
          prompt_1: fallback,
          prompt_2: `${userInput}, alternative creative angle, professional, high quality, 4k`.substring(0, MAX_PROMPT_LENGTH),
          negative_prompt: DEFAULT_NEGATIVE,
        };
      }
    }

    console.log(`[${requestId}] [Pipeline] Prompt 1 length:`, optimized.prompt_1.length);
    console.log(`[${requestId}] [Pipeline] Prompt 2 length:`, optimized.prompt_2.length);

    // STEP 2: Generate BOTH images in parallel via Leonardo AI
    let image1Url: string;
    let image2Url: string;

    try {
      const [img1, img2] = await Promise.all([
        generateImageLeonardo(optimized.prompt_1, optimized.negative_prompt, LEONARDO_API_KEY, width, height, requestId),
        generateImageLeonardo(optimized.prompt_2, optimized.negative_prompt, LEONARDO_API_KEY, width, height, requestId),
      ]);
      image1Url = img1;
      image2Url = img2;
    } catch (err: any) {
      console.error(`[${requestId}] [Leonardo] Error:`, err.message);
      await captureSentry(SENTRY_DSN, {
        message: "leonardo_generation_failed",
        level: "error",
        tags: { request_id: requestId },
        extra: { error: err.message },
      });
      if (err.message === "rate_limited") return jsonResponse({ error: "rate_limited" }, 429);
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    if (!image1Url || !image2Url) {
      await captureSentry(SENTRY_DSN, {
        message: "generate_image_empty_response",
        level: "error",
        tags: { request_id: requestId },
      });
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    // STEP 3: Deduct credits (once for both images)
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_description: `Geração de imagem (${quality === "pro" ? "Alta qualidade" : "Rápido"})`,
    });
    if (deductError) {
      console.error(`[${requestId}] [Credits] Deduction error:`, deductError);
      await captureSentry(SENTRY_DSN, {
        message: "generate_image_credit_deduction_failed",
        level: "error",
        tags: { request_id: requestId },
        extra: { error: deductError.message || String(deductError) },
      });
      return jsonResponse({ error: "credit_deduction_failed" }, 500);
    }

    // STEP 4: Log usage
    const { error: logError } = await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: user.id,
      model: "leonardo-ai",
      tokens: 0,
      cost: creditCost,
      cost_usd: quality === "pro" ? 0.03 : 0.01,
    });
    if (logError) {
      console.error(`[${requestId}] AI usage log error:`, logError);
      await captureSentry(SENTRY_DSN, {
        message: "generate_image_usage_log_failed",
        level: "error",
        tags: { request_id: requestId },
        extra: { error: logError.message || String(logError) },
      });
    }

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const expectedBalance = (credits.balance ?? 0) - creditCost;
    if (updatedCredits?.balance != null && updatedCredits.balance !== expectedBalance) {
      console.error(`[${requestId}] Credits mismatch`, {
        expected: expectedBalance,
        actual: updatedCredits.balance,
      });
      await captureSentry(SENTRY_DSN, {
        message: "generate_image_credits_mismatch",
        level: "error",
        tags: { request_id: requestId },
        extra: { expected: expectedBalance, actual: updatedCredits.balance },
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[${requestId}] === Generation Complete — 2 images ===`, {
      user_id: user.id,
      credits_used: creditCost,
      duration_ms: durationMs,
    });

    return jsonResponse({
      images: [
        {
          image_url: image1Url,
          optimized_prompt: optimized.prompt_1,
        },
        {
          image_url: image2Url,
          optimized_prompt: optimized.prompt_2,
        },
      ],
      prompt: userInput,
      negative_prompt: optimized.negative_prompt,
      model: "leonardo-ai",
      credits_used: creditCost,
      credits_remaining: updatedCredits?.balance ?? 0,
    });
  } catch (error) {
    console.error(`[${requestId}] [Fatal] Edge function error:`, error);
    await captureSentry(SENTRY_DSN, {
      message: "generate_image_unhandled_error",
      level: "error",
      tags: { request_id: requestId },
      extra: { error: String(error) },
    });
    return jsonResponse({ error: "internal_error" }, 500);
  }
}

Deno.serve((req) => handleGenerateImage(req));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function optimizePrompts(
  userInput: string,
  templateContext: string,
  apiKey: string
): Promise<OptimizedPrompts> {
  const content = templateContext
    ? `${userInput}\n\nContext/Style: ${templateContext}`
    : userInput;

  console.log("[GPT] Sending optimization request...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: GPT_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[GPT] API error:", response.status, errText);
    throw new Error(`GPT API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty GPT response");

  console.log("[GPT] Response received, length:", text.length);

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
  height: number
): Promise<string> {
  console.log("[Leonardo] Creating generation — prompt length:", prompt.length, "size:", width, "x", height);

  const createRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${leonardoKey}`,
      "Content-Type": "application/json",
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
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("[Leonardo] Create error:", createRes.status, errText);
    if (createRes.status === 429) throw new Error("rate_limited");
    throw new Error("leonardo_generation_failed");
  }

  const createData = await createRes.json();
  const generationId = createData?.sdGenerationJob?.generationId;
  if (!generationId) {
    console.error("[Leonardo] No generationId:", JSON.stringify(createData).substring(0, 500));
    throw new Error("leonardo_generation_failed");
  }

  console.log("[Leonardo] generationId:", generationId);

  // Poll for completion (max ~90s)
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
      { headers: { Authorization: `Bearer ${leonardoKey}` } }
    );

    if (!pollRes.ok) {
      console.warn("[Leonardo] Poll failed, attempt", i, pollRes.status);
      continue;
    }

    const pollData = await pollRes.json();
    const gen = pollData?.generations_by_pk;

    if (gen?.status === "COMPLETE") {
      const imageUrl = gen.generated_images?.[0]?.url;
      if (imageUrl) {
        console.log("[Leonardo] Image ready:", imageUrl.substring(0, 80));
        return imageUrl;
      }
      throw new Error("leonardo_no_image_url");
    }

    if (gen?.status === "FAILED") {
      console.error("[Leonardo] Generation failed");
      throw new Error("leonardo_generation_failed");
    }
  }

  throw new Error("leonardo_timeout");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const body = await req.json();
    const userInput = body?.prompt?.trim();
    const quality: string = body?.quality === "pro" ? "pro" : "fast";
    const template: string = body?.template || "";
    const format: string = body?.format || "square"; // square | vertical

    if (!userInput || userInput.length < 3 || userInput.length > 2000) {
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    console.log("=== Generate Image Request ===");
    console.log("User:", user.id, "| Quality:", quality, "| Template:", template, "| Format:", format);
    console.log("Input:", userInput.substring(0, 100));

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
    if (rateInsertError) console.error("[RateLimit] Insert error:", rateInsertError);

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
      console.error("LOVABLE_API_KEY not configured");
      return jsonResponse({ error: "internal_error" }, 500);
    }
    if (!LEONARDO_API_KEY) {
      console.error("LEONARDO_API_KEY not configured");
      return jsonResponse({ error: "internal_error" }, 500);
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

    // STEP 1: GPT prompt optimization (with 1 retry)
    let optimized: OptimizedPrompts;

    try {
      optimized = await optimizePrompts(userInput, templateContext, LOVABLE_API_KEY);
    } catch (firstError) {
      console.error("[GPT] First attempt failed, retrying:", firstError);
      try {
        optimized = await optimizePrompts(userInput, templateContext, LOVABLE_API_KEY);
      } catch (retryError) {
        console.error("[GPT] Retry also failed, using fallback:", retryError);
        const fallback = `${userInput}, 4k, ultra detailed, sharp focus, professional composition, high quality`.substring(0, MAX_PROMPT_LENGTH);
        optimized = {
          prompt_1: fallback,
          prompt_2: `${userInput}, alternative creative angle, professional, high quality, 4k`.substring(0, MAX_PROMPT_LENGTH),
          negative_prompt: DEFAULT_NEGATIVE,
        };
      }
    }

    console.log("[Pipeline] Prompt 1 length:", optimized.prompt_1.length);
    console.log("[Pipeline] Prompt 2 length:", optimized.prompt_2.length);

    // STEP 2: Generate BOTH images in parallel via Leonardo AI
    let image1Url: string;
    let image2Url: string;

    try {
      const [img1, img2] = await Promise.all([
        generateImageLeonardo(optimized.prompt_1, optimized.negative_prompt, LEONARDO_API_KEY, width, height),
        generateImageLeonardo(optimized.prompt_2, optimized.negative_prompt, LEONARDO_API_KEY, width, height),
      ]);
      image1Url = img1;
      image2Url = img2;
    } catch (err: any) {
      console.error("[Leonardo] Error:", err.message);
      if (err.message === "rate_limited") return jsonResponse({ error: "rate_limited" }, 429);
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    // STEP 3: Deduct credits (once for both images)
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_description: `Geração de imagem (${quality === "pro" ? "Alta qualidade" : "Rápido"})`,
    });
    if (deductError) console.error("[Credits] Deduction error:", deductError);

    // STEP 4: Log usage
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: user.id,
      model: "leonardo-ai",
      tokens: 0,
      cost: creditCost,
      cost_usd: quality === "pro" ? 0.03 : 0.01,
    });

    const { data: updatedCredits } = await supabaseAdmin
      .from("credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("=== Generation Complete — 2 images ===");

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
    console.error("[Fatal] Edge function error:", error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});

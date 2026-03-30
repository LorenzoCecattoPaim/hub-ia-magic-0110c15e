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

const GPT_SYSTEM_PROMPT = `You are a prompt engineering expert specialized in AI image generation.

Transform any user input into a highly detailed and optimized prompt for Leonardo AI.

STRUCTURE:
[MAIN SUBJECT], [STYLE], [DETAILS], [LIGHTING], [CAMERA], [QUALITY TAGS]

RULES:
- Expand the idea with rich visual details, environment, textures, and mood.
- Add style automatically:
  Realistic → photorealistic, ultra detailed
  Fantasy → cinematic, epic, fantasy art
  Logo → minimalist, vector, clean design
  Anime → anime style, vibrant colors
- Add lighting: soft lighting, dramatic lighting, neon lighting, golden hour
- Add camera (if applicable): 50mm lens, depth of field, wide angle, close-up
- Always add quality tags: 8k, highly detailed, sharp focus, professional composition

CRITICAL LENGTH RULE:
- The "prompt" field MUST be under 1400 characters. Be concise but descriptive.
- Do NOT repeat tags or add redundant descriptions.

NEGATIVE PROMPT (MANDATORY):
Always include: blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "prompt": "...",
  "negative_prompt": "..."
}

DO NOT add explanations.`;

const DEFAULT_NEGATIVE = "blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text";
const MAX_PROMPT_LENGTH = 1450;

async function optimizePrompt(
  userInput: string,
  templateContext: string,
  apiKey: string
): Promise<{ prompt: string; negative_prompt: string }> {
  const content = templateContext
    ? `${userInput}\n\nContext/Style: ${templateContext}`
    : userInput;

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
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("GPT API error:", response.status, errText);
    throw new Error(`GPT API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty GPT response");

  console.log("GPT raw response length:", text.length);

  const parsed = JSON.parse(text);
  if (!parsed.prompt || typeof parsed.prompt !== "string") {
    throw new Error("Invalid GPT JSON structure");
  }

  // Truncate prompt if it exceeds Leonardo's limit
  let finalPrompt = parsed.prompt;
  if (finalPrompt.length > MAX_PROMPT_LENGTH) {
    console.warn(`Prompt too long (${finalPrompt.length}), truncating to ${MAX_PROMPT_LENGTH}`);
    finalPrompt = finalPrompt.substring(0, MAX_PROMPT_LENGTH);
  }

  let negPrompt = parsed.negative_prompt || DEFAULT_NEGATIVE;
  if (negPrompt.length > MAX_PROMPT_LENGTH) {
    negPrompt = negPrompt.substring(0, MAX_PROMPT_LENGTH);
  }

  return { prompt: finalPrompt, negative_prompt: negPrompt };
}

async function generateImageLeonardo(
  prompt: string,
  negativePrompt: string,
  leonardoKey: string
): Promise<string> {
  console.log("Leonardo request - prompt length:", prompt.length, "neg length:", negativePrompt.length);

  const createRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${leonardoKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      width: 1024,
      height: 1024,
      num_images: 1,
      modelId: "b24e16ff-06e3-43eb-8d33-4416c2d75876",
      presetStyle: "DYNAMIC",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("Leonardo create error:", createRes.status, errText);
    if (createRes.status === 429) throw new Error("rate_limited");
    throw new Error("leonardo_generation_failed");
  }

  const createData = await createRes.json();
  const generationId = createData?.sdGenerationJob?.generationId;
  if (!generationId) {
    console.error("No generationId:", JSON.stringify(createData).substring(0, 500));
    throw new Error("leonardo_generation_failed");
  }

  console.log("Leonardo generationId:", generationId);

  // Poll for completion (max ~90s)
  const maxAttempts = 45;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
      { headers: { Authorization: `Bearer ${leonardoKey}` } }
    );

    if (!pollRes.ok) {
      console.warn("Poll failed, attempt", i, pollRes.status);
      continue;
    }

    const pollData = await pollRes.json();
    const gen = pollData?.generations_by_pk;

    if (gen?.status === "COMPLETE") {
      const imageUrl = gen.generated_images?.[0]?.url;
      if (imageUrl) {
        console.log("Image generated successfully:", imageUrl.substring(0, 80));
        return imageUrl;
      }
      throw new Error("leonardo_no_image_url");
    }

    if (gen?.status === "FAILED") {
      console.error("Leonardo generation failed");
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

    if (!userInput || userInput.length < 3 || userInput.length > 2000) {
      return jsonResponse({ error: "invalid_prompt" }, 400);
    }

    console.log("=== Generate Image Request ===");
    console.log("User:", user.id, "| Quality:", quality, "| Template:", template);
    console.log("Input:", userInput.substring(0, 100));

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
    if (rateInsertError) console.error("Rate limit insert error:", rateInsertError);

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

    // Build template context
    let templateContext = "";
    switch (template) {
      case "instagram":
        templateContext = "Instagram post, square 1:1, vibrant, social media ready";
        break;
      case "logo":
        templateContext = "Logo, clean, minimalist, vector style, white background";
        break;
      case "ad":
        templateContext = "Ad banner, eye-catching, commercial, bold, marketing";
        break;
      case "product":
        templateContext = "Product photo, studio lighting, clean background, e-commerce";
        break;
    }

    // STEP 1: GPT prompt optimization (with 1 retry)
    let optimizedPrompt: string;
    let negativePrompt: string;

    try {
      const result = await optimizePrompt(userInput, templateContext, LOVABLE_API_KEY);
      optimizedPrompt = result.prompt;
      negativePrompt = result.negative_prompt;
    } catch (firstError) {
      console.error("GPT first attempt failed, retrying:", firstError);
      try {
        const result = await optimizePrompt(userInput, templateContext, LOVABLE_API_KEY);
        optimizedPrompt = result.prompt;
        negativePrompt = result.negative_prompt;
      } catch (retryError) {
        console.error("GPT retry also failed:", retryError);
        optimizedPrompt = userInput.substring(0, MAX_PROMPT_LENGTH);
        negativePrompt = DEFAULT_NEGATIVE;
      }
    }

    console.log("Optimized prompt length:", optimizedPrompt.length);

    // STEP 2: Leonardo AI image generation
    let imageUrl: string;
    try {
      imageUrl = await generateImageLeonardo(optimizedPrompt, negativePrompt, LEONARDO_API_KEY);
    } catch (err: any) {
      console.error("Leonardo error:", err.message);
      if (err.message === "rate_limited") return jsonResponse({ error: "rate_limited" }, 429);
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    // STEP 3: Save record
    const { error: insertError } = await supabaseAdmin.from("generated_images").insert({
      user_id: user.id,
      prompt: userInput,
      optimized_prompt: optimizedPrompt,
      negative_prompt: negativePrompt,
      image_url: imageUrl,
      model: "leonardo-ai",
      quality,
      credits_used: creditCost,
    });
    if (insertError) console.error("Insert error:", insertError);

    // STEP 4: Deduct credits
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_description: `Geração de imagem (${quality === "pro" ? "Alta qualidade" : "Rápido"})`,
    });
    if (deductError) console.error("Credit deduction error:", deductError);

    // STEP 5: Log usage
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

    console.log("=== Generation Complete ===");

    return jsonResponse({
      image_url: imageUrl,
      prompt: userInput,
      optimized_prompt: optimizedPrompt,
      negative_prompt: negativePrompt,
      model: "leonardo-ai",
      credits_used: creditCost,
      credits_remaining: updatedCredits?.balance ?? 0,
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});

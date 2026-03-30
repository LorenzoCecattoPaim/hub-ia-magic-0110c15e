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

NEGATIVE PROMPT (MANDATORY):
Always include: blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "prompt": "...",
  "negative_prompt": "..."
}

DO NOT add explanations.`;

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
    }),
  });

  if (!response.ok) {
    throw new Error(`GPT API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty GPT response");

  const parsed = JSON.parse(text);
  if (!parsed.prompt || typeof parsed.prompt !== "string") {
    throw new Error("Invalid GPT JSON structure");
  }

  return {
    prompt: parsed.prompt,
    negative_prompt: parsed.negative_prompt || "blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text",
  };
}

async function generateImageLeonardo(
  prompt: string,
  negativePrompt: string,
  leonardoKey: string
): Promise<string> {
  // Step 1: Create generation
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

  // Step 2: Poll for completion (max ~60s)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const pollRes = await fetch(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
      {
        headers: { Authorization: `Bearer ${leonardoKey}` },
      }
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
        templateContext = "Instagram post, square format 1:1, vibrant colors, social media ready, eye-catching, modern design";
        break;
      case "logo":
        templateContext = "Logo design, clean, minimalist, professional, vector style, on a solid white background";
        break;
      case "ad":
        templateContext = "Advertisement banner, eye-catching, commercial, bold text space, product promotion, marketing";
        break;
      case "product":
        templateContext = "Product photography, studio lighting, clean background, professional e-commerce style, high detail";
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
        // Fallback: use raw input
        optimizedPrompt = userInput;
        negativePrompt = "blurry, low quality, distorted, deformed, bad anatomy, extra limbs, watermark, text";
      }
    }

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
    await supabaseAdmin.from("generated_images").insert({
      user_id: user.id,
      prompt: userInput,
      optimized_prompt: optimizedPrompt,
      negative_prompt: negativePrompt,
      image_url: imageUrl,
      model: "leonardo-ai",
      quality,
      credits_used: creditCost,
    });

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

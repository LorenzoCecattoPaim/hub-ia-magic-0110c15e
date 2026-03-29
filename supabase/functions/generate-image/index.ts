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
    const prompt = body?.prompt?.trim();
    const quality: string = body?.quality === "pro" ? "pro" : "fast";
    const template: string = body?.template || "";

    if (!prompt || prompt.length < 3 || prompt.length > 2000) {
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

    // Rate limit: 5 image generations per minute
    const { error: rateInsertError } = await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: user.id });

    if (rateInsertError) {
      console.error("Rate limit insert error:", rateInsertError);
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
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
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

    // Step 1: Enhance prompt using text model
    let optimizedPrompt = prompt;
    try {
      const enhanceResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "You are an expert prompt engineer for AI image generation. Transform the user's brief description into a detailed, high-quality image generation prompt in English. Include visual style, lighting, camera angle, colors, mood, composition. Keep it under 150 words. Output ONLY the enhanced prompt text, nothing else.",
            },
            {
              role: "user",
              content: `${prompt}${templateContext ? `\n\nContext/Style: ${templateContext}` : ""}`,
            },
          ],
        }),
      });

      if (enhanceResponse.ok) {
        const enhanceData = await enhanceResponse.json();
        const enhanced = enhanceData.choices?.[0]?.message?.content?.trim();
        if (enhanced && enhanced.length > 10) {
          optimizedPrompt = enhanced;
        }
      }
    } catch (e) {
      console.error("Prompt enhancement failed, using original:", e);
    }

    // Step 2: Generate image
    const imageModel =
      quality === "pro"
        ? "google/gemini-3-pro-image-preview"
        : "google/gemini-3.1-flash-image-preview";

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageModel,
        messages: [{ role: "user", content: optimizedPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!imageResponse.ok) {
      const status = imageResponse.status;
      if (status === 429) return jsonResponse({ error: "rate_limited" }, 429);
      if (status === 402) return jsonResponse({ error: "ai_payment_required" }, 502);
      const errText = await imageResponse.text();
      console.error("Image generation error:", status, errText);
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    const imageData = await imageResponse.json();
    const base64Image =
      imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) {
      console.error("No image in response:", JSON.stringify(imageData).substring(0, 500));
      return jsonResponse({ error: "image_generation_failed" }, 502);
    }

    // Step 3: Upload to storage
    // Ensure bucket exists
    await supabaseAdmin.storage
      .createBucket("generated-images", { public: true })
      .catch(() => {});

    const imageId = crypto.randomUUID();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );

    const filePath = `${user.id}/${imageId}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("generated-images")
      .upload(filePath, imageBytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return jsonResponse({ error: "upload_failed" }, 500);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("generated-images")
      .getPublicUrl(filePath);
    const imageUrl = urlData.publicUrl;

    // Step 4: Save record
    await supabaseAdmin.from("generated_images").insert({
      user_id: user.id,
      prompt,
      optimized_prompt: optimizedPrompt,
      image_url: imageUrl,
      model: imageModel,
      quality,
      credits_used: creditCost,
    });

    // Step 5: Deduct credits
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_description: `Geração de imagem (${quality === "pro" ? "Alta qualidade" : "Rápido"})`,
    });

    if (deductError) {
      console.error("Credit deduction error:", deductError);
    }

    // Step 6: Log usage
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: user.id,
      model: imageModel,
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
      prompt,
      optimized_prompt: optimizedPrompt,
      model: imageModel,
      credits_used: creditCost,
      credits_remaining: updatedCredits?.balance ?? 0,
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});

import { supabase } from "@/integrations/supabase/client";

export type AiResponse = {
  response: string;
  credits_used?: number;
  credits_remaining?: number;
  model_used?: string;
};

export type AiContext = {
  ragContext?: string;
  ctaFallback?: string;
};

const CTA_REGEX =
  /(clique|acesse|compre|fale|chame|cadastre|assine|garanta|aproveite|inscreva|peça|baixe|entre em contato|whatsapp)/i;

export function ensureCta(text: string, fallback?: string) {
  if (!text) return text;
  if (CTA_REGEX.test(text)) return text;
  const cta = fallback || "Fale com a gente no WhatsApp e garanta sua oferta hoje.";
  return `${text}\n\nCTA: ${cta}`;
}

export function buildPromptWithContext(prompt: string, context?: AiContext) {
  const ragContext = context?.ragContext?.trim();
  if (!ragContext) return prompt;
  return `${prompt}\n\nContexto adicional (arquivos enviados):\n${ragContext}`;
}

export async function sendMessage(message: string): Promise<AiResponse> {
  const payload = { message };
  console.log("[AI] Request start", {
    message_length: message?.length ?? 0,
    preview: message?.substring(0, 200) ?? "",
  });
  console.log("[AI] Payload", payload);

  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: payload,
  });

  console.log("[AI] Raw response", { data, error });

  if (error) {
    console.error("[AI] Request error", error);
    throw new Error(data?.error || error.message || "Erro ao se comunicar com a IA");
  }

  if (data?.error) {
    const err = new Error(data.error);
    (err as any).code = data.code;
    (err as any).balance = data.balance;
    (err as any).required = data.required;
    throw err;
  }

  if (!data || typeof data.response !== "string") {
    console.error("[AI] Invalid response format", data);
    throw new Error("Resposta inválida da IA");
  }

  return data;
}

export async function aiOrchestrator(
  prompt: string,
  context?: AiContext
): Promise<AiResponse> {
  const message = buildPromptWithContext(prompt, context);
  const data = await sendMessage(message);
  return {
    ...data,
    response: ensureCta(data.response, context?.ctaFallback),
  };
}

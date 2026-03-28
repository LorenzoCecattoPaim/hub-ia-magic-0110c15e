import { supabase } from "@/integrations/supabase/client";

export type AiResponse = {
  response: string;
  credits_used?: number;
  credits_remaining?: number;
  model_used?: string;
};

export async function sendMessage(message: string): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { message },
  });

  if (error) {
    throw new Error(data?.error || error.message || "Erro ao se comunicar com a IA");
  }

  if (data?.error) {
    const err = new Error(data.error);
    (err as any).code = data.code;
    (err as any).balance = data.balance;
    (err as any).required = data.required;
    throw err;
  }

  return data;
}

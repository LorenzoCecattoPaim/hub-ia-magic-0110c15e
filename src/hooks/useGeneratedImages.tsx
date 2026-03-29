import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type GeneratedImage = {
  id: string;
  prompt: string;
  optimized_prompt: string | null;
  image_url: string;
  model: string;
  quality: string;
  credits_used: number;
  created_at: string;
};

export function useGeneratedImages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["generated-images", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_images")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as GeneratedImage[];
    },
    enabled: !!user,
  });
}

export type GenerateImageParams = {
  prompt: string;
  quality: "fast" | "pro";
  template?: string;
};

export type GenerateImageResult = {
  image_url: string;
  prompt: string;
  optimized_prompt: string;
  model: string;
  credits_used: number;
  credits_remaining: number;
};

export function useGenerateImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateImageParams): Promise<GenerateImageResult> => {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: params,
      });

      if (error) {
        throw new Error(data?.error || error.message || "Erro ao gerar imagem");
      }

      if (data?.error) {
        const err = new Error(
          data.error === "insufficient_credits"
            ? `Créditos insuficientes. Necessário: ${data.required}, disponível: ${data.balance}`
            : data.error === "rate_limited"
            ? "Limite de requisições atingido. Aguarde um momento."
            : data.error === "image_generation_failed"
            ? "Falha ao gerar imagem. Tente novamente."
            : data.error
        );
        (err as any).code = data.error;
        throw err;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-images"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao gerar imagem");
    },
  });
}

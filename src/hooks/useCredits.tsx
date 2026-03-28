import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance ?? 0;
    },
    enabled: !!user,
  });
}

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useBuyCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: string) => {
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { package: pkg },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast.success(`${data.credits_added} créditos adicionados!`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao comprar créditos");
    },
  });
}

export function useUpgradePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: string) => {
      const { data, error } = await supabase.functions.invoke("upgrade-plan", {
        body: { plan },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success(`Plano atualizado para ${data.plan}!`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar plano");
    },
  });
}

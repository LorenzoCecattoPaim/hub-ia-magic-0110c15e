import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome_empresa: "",
    nicho: "",
    tom_comunicacao: "informal",
    publico_alvo: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("business_profiles").insert({
        user_id: user.id,
        nome_empresa: form.nome_empresa,
        nicho: form.nicho || null,
        tom_comunicacao: form.tom_comunicacao,
        publico_alvo: form.publico_alvo || null,
      });

      if (error) throw error;
      toast.success("Perfil criado com sucesso!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar perfil");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="gradient-primary rounded-2xl p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Configure seu negócio</h1>
          <p className="text-muted-foreground mt-1">
            A IA vai usar essas informações para gerar conteúdo personalizado
          </p>
        </div>

        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome da Empresa *</Label>
                <Input
                  value={form.nome_empresa}
                  onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
                  placeholder="Ex: Loja da Maria"
                  className="bg-secondary border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Nicho / Segmento</Label>
                <Input
                  value={form.nicho}
                  onChange={(e) => setForm({ ...form, nicho: e.target.value })}
                  placeholder="Ex: Moda feminina, Restaurante, Pet Shop"
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Tom de Comunicação</Label>
                <Select
                  value={form.tom_comunicacao}
                  onValueChange={(v) => setForm({ ...form, tom_comunicacao: v })}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="informal">Informal</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="persuasivo">Persuasivo</SelectItem>
                    <SelectItem value="jovem">Jovem / Descolado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Público-alvo</Label>
                <Input
                  value={form.publico_alvo}
                  onChange={(e) => setForm({ ...form, publico_alvo: e.target.value })}
                  placeholder="Ex: Mulheres de 25-45 anos, classe B/C"
                  className="bg-secondary border-border"
                />
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground hover:opacity-90 mt-2"
                disabled={isSubmitting || !form.nome_empresa}
              >
                <Building2 className="h-4 w-4 mr-2" />
                {isSubmitting ? "Salvando..." : "Salvar e começar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

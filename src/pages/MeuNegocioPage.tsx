import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, UploadCloud, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const segmentos = [
  "E-commerce",
  "Serviços",
  "Segurança, Infraestrutura ou Obras",
  "Transportes, Frete ou Viagens",
  "Agricultura, Alimentos ou Restaurante",
  "Ensino",
  "Instituição Financeira",
  "Corretor de Imóveis ou Imobiliária",
  "Loja de Vestuário, Decoração ou Lar",
  "Serviços de Saúde ou Clínica",
  "Comunicações ou Produção de Conteúdo",
  "Beleza, Estética ou Barbearia",
  "Loja de Automóveis ou Bem Durável",
  "Outro",
];

const objetivos = [
  "Vender mais",
  "Gerar leads",
  "Aumentar reconhecimento de marca",
  "Melhorar autoridade",
  "Lançar um produto",
  "Outro",
];

const publicos = [
  "Jovens (13–24 anos)",
  "Adultos (25–40 anos)",
  "Adultos (40+)",
  "Empresas (B2B)",
  "Público geral",
];

const tons = [
  "Formal",
  "Profissional",
  "Descontraído",
  "Engraçado / Irônico",
  "Inspirador / Motivacional",
];

const estilosMarca = [
  "Moderna e inovadora",
  "Tradicional e confiável",
  "Luxuosa / premium",
  "Acessível / popular",
  "Criativa / disruptiva",
];

const canais = [
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "Site próprio",
  "WhatsApp",
];

const tiposConteudo = [
  "Posts para redes sociais",
  "Anúncios (ads)",
  "Textos para site",
  "E-mails marketing",
  "Roteiros de vídeo",
  "Imagens com IA",
];

const niveis = ["Iniciante", "Intermediário", "Avançado"];

const desafios = [
  "Falta de vendas",
  "Baixo engajamento",
  "Pouco tráfego",
  "Falta de consistência",
  "Dificuldade em criar conteúdo",
  "Outro",
];

const ajuda = [
  "Criar conteúdo automaticamente",
  "Gerar ideias",
  "Melhorar textos existentes",
  "Criar imagens",
  "Automatizar marketing",
  "Tudo isso",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const sanitizeFileName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, "_");

type BusinessFormState = {
  segmento_atuacao: string;
  objetivo_principal: string;
  publico_alvo: string;
  tom_comunicacao: string;
  marca_descricao: string;
  canais: string[];
  tipos_conteudo: string[];
  nivel_experiencia: string;
  maior_desafio: string;
  como_ia_ajuda: string;
};

const emptyForm: BusinessFormState = {
  segmento_atuacao: "",
  objetivo_principal: "",
  publico_alvo: "",
  tom_comunicacao: "",
  marca_descricao: "",
  canais: [],
  tipos_conteudo: [],
  nivel_experiencia: "",
  maior_desafio: "",
  como_ia_ajuda: "",
};

export default function MeuNegocioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: businessProfile, isLoading: profileLoading } = useBusinessProfile();
  const [form, setForm] = useState<BusinessFormState>(emptyForm);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ["business_materials", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("business_materials")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!businessProfile) return;
    setForm({
      segmento_atuacao: businessProfile.segmento_atuacao ?? "",
      objetivo_principal: businessProfile.objetivo_principal ?? "",
      publico_alvo: businessProfile.publico_alvo ?? "",
      tom_comunicacao: businessProfile.tom_comunicacao ?? "",
      marca_descricao: businessProfile.marca_descricao ?? "",
      canais: businessProfile.canais ?? [],
      tipos_conteudo: businessProfile.tipos_conteudo ?? [],
      nivel_experiencia: businessProfile.nivel_experiencia ?? "",
      maior_desafio: businessProfile.maior_desafio ?? "",
      como_ia_ajuda: businessProfile.como_ia_ajuda ?? "",
    });
    setIsHydrated(true);
  }, [businessProfile]);

  const isComplete = useMemo(() => {
    return Boolean(
      form.segmento_atuacao &&
        form.objetivo_principal &&
        form.publico_alvo &&
        form.tom_comunicacao &&
        form.marca_descricao &&
        form.canais.length > 0 &&
        form.tipos_conteudo.length > 0 &&
        form.nivel_experiencia &&
        form.maior_desafio &&
        form.como_ia_ajuda
    );
  }, [form]);

  const persistProfile = useCallback(async () => {
    if (!user || !businessProfile?.nome_empresa) return;
    setIsSaving(true);
    const payload = {
      user_id: user.id,
      nome_empresa: businessProfile.nome_empresa,
      nicho: businessProfile.nicho ?? null,
      segmento_atuacao: form.segmento_atuacao || null,
      objetivo_principal: form.objetivo_principal || null,
      publico_alvo: form.publico_alvo || null,
      tom_comunicacao: form.tom_comunicacao || null,
      marca_descricao: form.marca_descricao || null,
      canais: form.canais.length ? form.canais : null,
      tipos_conteudo: form.tipos_conteudo.length ? form.tipos_conteudo : null,
      nivel_experiencia: form.nivel_experiencia || null,
      maior_desafio: form.maior_desafio || null,
      como_ia_ajuda: form.como_ia_ajuda || null,
      questionario_completo: isComplete,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("business_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      toast.error(error.message || "Erro ao salvar informações do negócio");
    } else {
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["business_profile", user.id] });
    }

    setIsSaving(false);
  }, [businessProfile?.nicho, businessProfile?.nome_empresa, form, isComplete, queryClient, user]);

  useEffect(() => {
    if (!isHydrated || !user || !businessProfile?.nome_empresa) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      persistProfile();
    }, 700);
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [form, isHydrated, persistProfile, user, businessProfile?.nome_empresa]);

  const handleToggle = (field: "canais" | "tipos_conteudo", value: string) => {
    setForm((prev) => {
      const exists = prev[field].includes(value);
      const updated = exists
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value];
      return { ...prev, [field]: updated };
    });
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !user) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} excede o limite de 20MB.`);
          continue;
        }
        const safeName = sanitizeFileName(file.name);
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("business-materials")
          .upload(storagePath, file, { contentType: file.type || undefined });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("business_materials")
          .insert({
            user_id: user.id,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || null,
            size_bytes: file.size,
            status: "pending",
          });

        if (insertError) throw insertError;
      }

      toast.success("Materiais enviados! Eles serão usados como contexto.");
      queryClient.invalidateQueries({ queryKey: ["business_materials", user.id] });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar arquivos");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteMaterial = async (id: string, storagePath: string) => {
    if (!user) return;
    try {
      const { error: storageError } = await supabase.storage
        .from("business-materials")
        .remove([storagePath]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from("business_materials")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;

      queryClient.invalidateQueries({ queryKey: ["business_materials", user.id] });
      toast.success("Material removido.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover material");
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!businessProfile) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Finalize o onboarding primeiro</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Para personalizar a IA, precisamos do cadastro inicial do seu negócio.
            </p>
            <Button className="gradient-primary text-primary-foreground" onClick={() => navigate("/onboarding")}>
              Ir para onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Meu negócio</h1>
          <p className="text-muted-foreground mt-1">
            Responda uma vez para a IA entender seu contexto e personalizar todas as respostas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <Badge className="gap-1 gradient-primary text-primary-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Questionário completo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Questionário em progresso</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {isSaving
              ? "Salvando..."
              : lastSavedAt
              ? `Salvo ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Alterações não salvas"}
          </span>
        </div>
      </div>

      <Card className="bg-card border-border shadow-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Questionário estratégico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="space-y-3">
            <Label className="text-foreground">1. Qual é o seu segmento de atuação?</Label>
            <RadioGroup
              value={form.segmento_atuacao}
              onValueChange={(value) => setForm((prev) => ({ ...prev, segmento_atuacao: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {segmentos.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">2. Qual é o principal objetivo da sua empresa atualmente?</Label>
            <RadioGroup
              value={form.objetivo_principal}
              onValueChange={(value) => setForm((prev) => ({ ...prev, objetivo_principal: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {objetivos.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">3. Quem é o seu público-alvo?</Label>
            <RadioGroup
              value={form.publico_alvo}
              onValueChange={(value) => setForm((prev) => ({ ...prev, publico_alvo: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {publicos.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">4. Qual é o tom de comunicação da sua marca?</Label>
            <RadioGroup
              value={form.tom_comunicacao}
              onValueChange={(value) => setForm((prev) => ({ ...prev, tom_comunicacao: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {tons.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">5. Qual dessas opções descreve melhor sua marca?</Label>
            <RadioGroup
              value={form.marca_descricao}
              onValueChange={(value) => setForm((prev) => ({ ...prev, marca_descricao: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {estilosMarca.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">6. Em quais canais você mais atua?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {canais.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <Checkbox
                    checked={form.canais.includes(item)}
                    onCheckedChange={() => handleToggle("canais", item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">7. Qual tipo de conteúdo você mais precisa gerar?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tiposConteudo.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <Checkbox
                    checked={form.tipos_conteudo.includes(item)}
                    onCheckedChange={() => handleToggle("tipos_conteudo", item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">8. Qual é o nível de experiência com marketing digital?</Label>
            <RadioGroup
              value={form.nivel_experiencia}
              onValueChange={(value) => setForm((prev) => ({ ...prev, nivel_experiencia: value }))}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {niveis.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">9. Qual é o maior desafio da sua empresa hoje?</Label>
            <RadioGroup
              value={form.maior_desafio}
              onValueChange={(value) => setForm((prev) => ({ ...prev, maior_desafio: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {desafios.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground">10. Como você quer que a IA te ajude?</Label>
            <RadioGroup
              value={form.como_ia_ajuda}
              onValueChange={(value) => setForm((prev) => ({ ...prev, como_ia_ajuda: value }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {ajuda.map((item) => (
                <label key={item} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">
                  <RadioGroupItem value={item} />
                  <span>{item}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Materiais do meu negócio
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-foreground font-medium">
                Envie PDFs, documentos, textos ou imagens com informações estratégicas.
              </p>
              <p className="text-xs text-muted-foreground">
                Esses materiais serão usados como base de conhecimento para a IA.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.rtf,.odt,image/*"
                disabled={isUploading}
              />
              <Button variant="outline" className="gap-2" disabled={isUploading}>
                <UploadCloud className="h-4 w-4" />
                {isUploading ? "Enviando..." : "Adicionar arquivos"}
              </Button>
            </label>
          </div>

          <div className="space-y-2">
            {materialsLoading ? (
              <p className="text-xs text-muted-foreground">Carregando materiais...</p>
            ) : materials.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum material enviado ainda.
              </p>
            ) : (
              materials.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-border rounded-lg px-3 py-2 bg-secondary/20"
                >
                  <div>
                    <p className="text-sm text-foreground font-medium">{material.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(material.size_bytes)} • {material.mime_type || "arquivo"} • {material.status}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive gap-1"
                    onClick={() => handleDeleteMaterial(material.id, material.storage_path)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-6 space-y-2">
          <p className="text-sm text-foreground font-medium">Salvamento automático ativado</p>
          <p className="text-xs text-muted-foreground">
            Você pode editar essas respostas quando quiser. A IA sempre usará a versão mais recente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

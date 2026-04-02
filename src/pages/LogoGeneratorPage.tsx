import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Palette, Loader2, Download, Maximize2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ChatMessage from "@/components/ChatMessage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Msg = { role: "user" | "assistant"; content: string; timestamp: Date };

type LogoImage = {
  id: number;
  title: string;
  description: string;
  prompt: string;
  image_url?: string;
};

type LogoState =
  | "coleta_nome"
  | "coleta_mercado"
  | "coleta_estilo"
  | "coleta_cores"
  | "definicao_identidade"
  | "geracao_logos"
  | "iteracao"
  | "finalizacao";

type LogoProject = {
  state: LogoState;
  name?: string;
  market?: string;
  style?: string;
  colors?: string;
  identity?: string;
  history?: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
  last_action_id?: string;
};

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: `# 🎨 Gerador de Logo IA

Olá! Sou seu **Designer Gráfico especialista** em criação de logotipos para empresas brasileiras.

Vou te guiar por um processo profissional de criação:

1. **Coleta de informações** sobre sua marca
2. **Definição da identidade visual**
3. **Geração de 3 opções** de logotipo
4. **Iteração** com base no seu feedback
5. **Versões finais** (original, prata, dourado, P&B)

Vamos começar! 👇

**Qual é o nome completo da sua marca?**`,
  timestamp: new Date(),
};

const stageLabels: Record<LogoState, string> = {
  coleta_nome: "Coletando o nome da marca",
  coleta_mercado: "Coletando o mercado de atuação",
  coleta_estilo: "Coletando o estilo da marca",
  coleta_cores: "Coletando as cores desejadas",
  definicao_identidade: "Definindo identidade visual",
  geracao_logos: "Gerando 3 opções de logo",
  iteracao: "Iterando com base no feedback",
  finalizacao: "Gerando variações finais",
};

export default function LogoGeneratorPage() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logos, setLogos] = useState<LogoImage[]>([]);
  const [generatingLogos, setGeneratingLogos] = useState(false);
  const [logoProject, setLogoProject] = useState<LogoProject>({ state: "coleta_nome", history: [] });
  const [previewLogo, setPreviewLogo] = useState<LogoImage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, logos]);

  const sendMessage = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text) return;

    const userMsg: Msg = { role: "user", content: text, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const actionId = crypto.randomUUID();

    const apiMessages = newMessages
      .filter((m) => m !== WELCOME_MSG)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada");
        return;
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logo-generator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            message: text,
            messages: apiMessages,
            logo_project: logoProject,
            action_id: actionId,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error === "insufficient_credits") {
          toast.error("Créditos insuficientes. Adquira mais créditos para continuar.");
        } else if (err.error === "rate_limited") {
          toast.error("Muitas requisições. Aguarde um momento.");
        } else if (err.error === "duplicate_action") {
          toast.info("Esta ação já foi processada. Tente novamente se necessário.");
        } else {
          toast.error("Erro ao se comunicar com a IA");
        }
        return;
      }

      const data = await resp.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, timestamp: new Date() }]);
      }

      if (Array.isArray(data.logos) && data.logos.length > 0) {
        setLogos(
          data.logos.map((logo: any) => ({
            id: Number(logo.id),
            title: String(logo.title || `Logo ${logo.id}`),
            description: String(logo.description || ""),
            prompt: String(logo.prompt || ""),
            image_url: logo.image_url,
          }))
        );
        setGeneratingLogos(false);
      }

      if (data.logo_project) {
        setLogoProject(data.logo_project);
      }

      queryClient.invalidateQueries({ queryKey: ["credits"] });
    } catch (e) {
      console.error("Send error:", e);
      toast.error("Erro inesperado");
    } finally {
      setLoading(false);
      setGeneratingLogos(false);
    }
  }, [logoProject, messages, queryClient]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    setGeneratingLogos(
      logoProject.state === "geracao_logos" ||
      logoProject.state === "iteracao" ||
      logoProject.state === "finalizacao"
    );
    await sendMessage(input);
  }, [input, loading, logoProject.state, sendMessage]);

  const handleSelectLogo = useCallback(async (logo: LogoImage) => {
    if (loading) return;
    setGeneratingLogos(true);
    await sendMessage(`Escolho o logo ${logo.id}.`);
  }, [loading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const downloadImage = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="gradient-primary rounded-xl p-2">
            <Palette className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Gerador de Logo IA</h1>
            <p className="text-xs text-muted-foreground">Designer gráfico especialista em logotipos</p>
            <p className="text-[10px] text-muted-foreground mt-1">{stageLabels[logoProject.state]}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
        ))}

        {/* Generated logos gallery */}
        {logos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {generatingLogos ? "Gerando logos..." : "Logos gerados"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
                >
                  <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                    {logo.image_url ? (
                      <img
                        src={logo.image_url}
                        alt={logo.title}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    )}
                    {logo.image_url && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-8 w-8 rounded-xl bg-card/80"
                        onClick={() => setPreviewLogo(logo)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {logo.description}
                    </p>
                    <div className="flex gap-2">
                      {logo.image_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => downloadImage(logo.image_url!, `logo-${logo.id}.png`)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                      )}
                      {logo.image_url && logoProject.state !== "finalizacao" && (
                        <Button
                          size="sm"
                          className="flex-1 text-xs gradient-primary text-primary-foreground"
                          onClick={() => handleSelectLogo(logo)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Selecionar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && !messages.some((m, i) => i === messages.length - 1 && m.role === "assistant") && (
          <div className="flex gap-3 justify-start animate-fade-in">
            <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {stageLabels[logoProject.state]}...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva sua marca..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="gradient-primary shrink-0"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Cada mensagem consome 1 crédito • Cada rodada de logos consome 5 créditos
        </p>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewLogo} onOpenChange={() => setPreviewLogo(null)}>
        <DialogContent className="max-w-3xl bg-card border-border rounded-2xl p-0 overflow-hidden">
          {previewLogo && (
            <>
              <div className="relative">
                <img
                  src={previewLogo.image_url}
                  alt={previewLogo.title}
                  className="w-full max-h-[60vh] object-contain bg-background"
                />
              </div>
              <div className="p-5 space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-display text-base">
                    {previewLogo.title}
                  </DialogTitle>
                </DialogHeader>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm text-foreground bg-secondary/50 rounded-xl p-3">
                    {previewLogo.description}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prompt</p>
                  <p className="text-sm text-foreground bg-secondary/50 rounded-xl p-3">
                    {previewLogo.prompt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-border"
                    onClick={() => previewLogo.image_url && downloadImage(previewLogo.image_url, `logo-${previewLogo.id}.png`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                  {logoProject.state !== "finalizacao" && (
                    <Button
                      className="flex-1 rounded-xl gradient-primary text-primary-foreground"
                      onClick={() => handleSelectLogo(previewLogo)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Selecionar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

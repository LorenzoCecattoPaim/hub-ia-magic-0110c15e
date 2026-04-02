import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Palette, Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ChatMessage from "@/components/ChatMessage";

type Msg = { role: "user" | "assistant"; content: string; timestamp: Date };
type LogoImage = { id: number; description: string; prompt: string; url?: string; loading?: boolean };

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

export default function LogoGeneratorPage() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logos, setLogos] = useState<LogoImage[]>([]);
  const [generatingLogos, setGeneratingLogos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, logos]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const apiMessages = allMessages
      .filter((m) => m !== WELCOME_MSG)
      .map((m) => ({ role: m.role, content: m.content }));

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { toast.error("Sessão expirada"); return ""; }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logo-generator`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: apiMessages }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (err.error === "insufficient_credits") {
        toast.error("Créditos insuficientes. Adquira mais créditos para continuar.");
      } else if (err.error === "rate_limited") {
        toast.error("Muitas requisições. Aguarde um momento.");
      } else {
        toast.error("Erro ao se comunicar com a IA");
      }
      return "";
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && last !== WELCOME_MSG) {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
              }
              return [...prev, { role: "assistant", content: fullText, timestamp: new Date() }];
            });
          }
        } catch {
          // try to parse credits metadata
          try {
            const meta = JSON.parse(jsonStr);
            if (meta.credits_remaining !== undefined) {
              queryClient.invalidateQueries({ queryKey: ["credits"] });
            }
          } catch { /* ignore */ }
        }
      }
    }

    return fullText;
  }, [queryClient]);

  const generateLogoImage = useCallback(async (prompt: string): Promise<string | null> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return null;

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logo-generator`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ mode: "generate_image", prompt }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (err.error === "insufficient_credits") {
        toast.error("Créditos insuficientes para gerar imagem.");
      } else {
        toast.error("Erro ao gerar imagem do logo.");
      }
      return null;
    }

    const data = await resp.json();
    queryClient.invalidateQueries({ queryKey: ["credits"] });
    return data.image_url || null;
  }, [queryClient]);

  const tryParseAction = useCallback(async (text: string) => {
    // Check if AI returned a JSON action block
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!jsonMatch) return;

    try {
      const action = JSON.parse(jsonMatch[1]);

      if (action.action === "generate_logos" && action.prompts) {
        setGeneratingLogos(true);
        const newLogos: LogoImage[] = action.prompts.map((p: any) => ({
          id: p.id,
          description: p.description,
          prompt: p.prompt,
          loading: true,
        }));
        setLogos(newLogos);

        // Generate all 3 in parallel
        const results = await Promise.allSettled(
          newLogos.map(async (logo) => {
            const url = await generateLogoImage(logo.prompt);
            return { id: logo.id, url };
          })
        );

        setLogos((prev) =>
          prev.map((logo) => {
            const result = results.find(
              (r) => r.status === "fulfilled" && r.value.id === logo.id
            );
            if (result?.status === "fulfilled") {
              return { ...logo, url: result.value.url || undefined, loading: false };
            }
            return { ...logo, loading: false };
          })
        );
        setGeneratingLogos(false);
      }

      if (action.action === "generate_variations" && action.variations) {
        setGeneratingLogos(true);
        const newLogos: LogoImage[] = action.variations.map((desc: string, i: number) => ({
          id: i + 1,
          description: desc,
          prompt: `${action.base_prompt}, ${desc}`,
          loading: true,
        }));
        setLogos(newLogos);

        const results = await Promise.allSettled(
          newLogos.map(async (logo) => {
            const url = await generateLogoImage(logo.prompt);
            return { id: logo.id, url };
          })
        );

        setLogos((prev) =>
          prev.map((logo) => {
            const result = results.find(
              (r) => r.status === "fulfilled" && r.value.id === logo.id
            );
            if (result?.status === "fulfilled") {
              return { ...logo, url: result.value.url || undefined, loading: false };
            }
            return { ...logo, loading: false };
          })
        );
        setGeneratingLogos(false);
      }
    } catch {
      // Not valid JSON action, ignore
    }
  }, [generateLogoImage]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: "user", content: text, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const responseText = await streamChat(newMessages);
      if (responseText) {
        await tryParseAction(responseText);
      }
    } catch (e) {
      console.error("Send error:", e);
      toast.error("Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, streamChat, tryParseAction]);

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
                  <div className="aspect-square bg-muted/50 flex items-center justify-center">
                    {logo.loading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : logo.url ? (
                      <img
                        src={logo.url}
                        alt={`Logo ${logo.id}`}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground p-4 text-center">
                        Falha ao gerar
                      </p>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {logo.description}
                    </p>
                    {logo.url && !logo.loading && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => downloadImage(logo.url!, `logo-${logo.id}.png`)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Baixar
                      </Button>
                    )}
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
                <span className="text-sm text-muted-foreground">Pensando...</span>
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
          Cada mensagem consome 1 crédito • Cada logo gerado consome 5 créditos
        </p>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Sparkles, Bot, Megaphone, Image, Lightbulb, Tag, TrendingUp, Target, BarChart3 } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useQueryClient } from "@tanstack/react-query";
import { buildRagContextSummary, loadRagFiles, RAG_UPDATE_EVENT, type RagFileEntry } from "@/lib/rag";
import { buildRagContextSummary, loadRagFiles, RAG_UPDATE_EVENT, type RagFileEntry } from "@/lib/rag";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Insight = {
  title: string;
  description: string;
  category: "Tendência" | "Oportunidade" | "Insight" | "Case";
  icon: typeof TrendingUp;
};

const insights: Insight[] = [
  {
    title: "Vídeos curtos dominam",
    description: "Reels e TikToks geram 3x mais engajamento que posts estáticos.",
    category: "Tendência",
    icon: TrendingUp,
  },
  {
    title: "Seu nicho está em alta",
    description: "Buscas por produtos do seu segmento cresceram 18% este mês.",
    category: "Oportunidade",
    icon: Target,
  },
  {
    title: "Melhores horários",
    description: "Para seu público: 9h, 12h e 19h nos dias úteis.",
    category: "Insight",
    icon: BarChart3,
  },
  {
    title: "Case de sucesso",
    description: "Cupons progressivos aumentaram ticket médio em 40%.",
    category: "Case",
    icon: Lightbulb,
  },
];

const categoryColors: Record<Insight["category"], string> = {
  Tendência: "bg-primary/10 text-primary",
  Oportunidade: "bg-chart-2/10 text-chart-2",
  Insight: "bg-chart-4/10 text-chart-4",
  Case: "bg-chart-5/10 text-chart-5",
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  token,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  token: string;
  onDelta: (text: string) => void;
  onDone: (meta?: { credits_used?: number; credits_remaining?: number }) => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, stream: true }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") || "";

  // Non-streaming JSON response (fallback)
  if (contentType.includes("application/json")) {
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    onDelta(data.response || "");
    onDone({ credits_used: data.credits_used, credits_remaining: data.credits_remaining });
    return;
  }

  // SSE streaming
  if (!resp.body) throw new Error("No response body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let meta: any = {};

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
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        onDone(meta);
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        // Check for metadata event
        if (parsed.credits_used != null) {
          meta = parsed;
          continue;
        }
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        // partial JSON, put back
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }
  onDone(meta);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ragFiles, setRagFiles] = useState<RagFileEntry[]>(() => loadRagFiles());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: businessProfile, isLoading: profileLoading } = useBusinessProfile();

  const suggestions = useMemo(
    () => [
      { text: "Crie um post para Black Friday", icon: Megaphone },
      { text: "Gere legenda para Instagram com CTA", icon: Tag },
      { text: "Sugira promoções para este mês", icon: Lightbulb },
      { text: "Monte um cronograma de marketing semanal", icon: Image },
    ],
    []
  );

  const ragContext = useMemo(() => buildRagContextSummary(ragFiles), [ragFiles]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const handleUpdate = () => setRagFiles(loadRagFiles());
    window.addEventListener(RAG_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(RAG_UPDATE_EVENT, handleUpdate);
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      // Build conversation history for context
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Add RAG context to the last user message if available
      if (ragContext) {
        const last = history[history.length - 1];
        last.content = `${last.content}\n\nContexto adicional (arquivos enviados):\n${ragContext}`;
      }

      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      const upsertAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === assistantId) {
            return prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            );
          }
          return [
            ...prev,
            { id: assistantId, role: "assistant" as const, content: assistantContent, timestamp: new Date() },
          ];
        });
      };

      try {
        // Get session token
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("not_authenticated");

        await streamChat({
          messages: history,
          token,
          onDelta: (chunk) => upsertAssistant(chunk),
          onDone: () => {
            queryClient.invalidateQueries({ queryKey: ["credits"] });
          },
          onError: (err) => {
            console.error("[Chat] Stream error:", err);
          },
        });
      } catch (error: any) {
        const code = String(error?.message || "").toLowerCase();
        const friendly =
          code.includes("insufficient_credits") || code.includes("credits")
            ? "Você ficou sem créditos. Faça uma recarga para continuar."
            : code.includes("rate_limited")
            ? "Limite de requisições atingido. Aguarde um minuto e tente novamente."
            : "Não consegui gerar agora, tente novamente em alguns segundos.";

        if (!assistantContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: `⚠️ ${friendly}`,
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, queryClient, ragContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Insights Section */}
      {messages.length === 0 && (
        <div className="border-b border-border bg-card/50 p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Últimos Insights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {insights.map((insight) => (
                <Card
                  key={insight.title}
                  className="bg-card border-border hover:shadow-glow transition-shadow duration-200"
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${categoryColors[insight.category]}`}>
                        {insight.category}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground leading-tight">{insight.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
            <div className="gradient-primary rounded-2xl p-4 mb-6">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Consultor de Marketing IA
            </h2>
            <p className="text-muted-foreground mb-2 max-w-md">
              Seu consultor de marketing especializado em pequenas e médias empresas. Diga o que precisa!
            </p>
            {businessProfile && (
              <p className="text-xs text-primary mb-8">
                🏢 Contexto ativo: {businessProfile.nome_empresa}
                {businessProfile.nicho ? ` • ${businessProfile.nicho}` : ""}
                {ragFiles.length ? ` • ${ragFiles.length} arquivo(s)` : ""}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s) => (
                <Card
                  key={s.text}
                  className="bg-card border-border hover:border-primary/30 hover:shadow-glow cursor-pointer transition-all duration-200 group"
                  onClick={() => handleSend(s.text)}
                >
                  <div className="p-4 flex items-start gap-3">
                    <s.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors text-left">
                      {s.text}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
            {isLoading && !messages.some((m) => m.role === "assistant" && m.content === "") && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 animate-fade-in">
                <div className="gradient-primary rounded-xl p-1.5 h-9 w-9 flex items-center justify-center shrink-0 shadow-glow">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl px-5 py-4 shadow-card">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-muted-foreground ml-2">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-border rounded-2xl flex items-end gap-2 p-3 shadow-card focus-within:border-primary/50 focus-within:shadow-glow transition-all duration-200">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite seu comando de marketing..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[40px] max-h-[120px] py-2 px-1"
              rows={1}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="gradient-primary text-primary-foreground rounded-xl h-10 w-10 shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Consultor de Marketing IA • Respostas personalizadas para seu negócio
          </p>
        </div>
      </div>
    </div>
  );
}

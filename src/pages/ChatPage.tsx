import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Sparkles, Bot, User, Megaphone, Image, Lightbulb, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useNavigate } from "react-router-dom";
import { aiOrchestrator } from "@/services/ai";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { buildRagContextSummary, loadRagFiles, RAG_UPDATE_EVENT, type RagFileEntry } from "@/lib/rag";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ragFiles, setRagFiles] = useState<RagFileEntry[]>(() => loadRagFiles());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: businessProfile, isLoading: profileLoading } = useBusinessProfile();

  const suggestions = useMemo(
    () => [
      { text: "Crie um post para Black Friday", icon: Megaphone },
      { text: "Gere legenda para Instagram com CTA", icon: Tag },
      { text: "Sugira promoções para este mês", icon: Lightbulb },
      { text: "Crie imagem promocional de produto", icon: Image },
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

  // Redirect to onboarding if no business profile
  useEffect(() => {
    if (!profileLoading && !businessProfile) {
      navigate("/onboarding");
    }
  }, [profileLoading, businessProfile, navigate]);

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

      try {
        const response = await aiOrchestrator(messageText, { ragContext });
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        queryClient.invalidateQueries({ queryKey: ["credits"] });
      } catch (error: any) {
        const code = String(error?.code || error?.message || "").toLowerCase();
        const friendly =
          code.includes("insufficient_credits") || code.includes("credits")
            ? "Você ficou sem créditos. Faça uma recarga para continuar."
            : code.includes("rate_limited")
            ? "Limite de requisições atingido. Aguarde um minuto e tente novamente."
            : "Não consegui gerar agora, tente novamente em alguns segundos.";
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ ${friendly}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, queryClient, ragContext]
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
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center">
            <div className="gradient-primary rounded-2xl p-4 mb-6">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Chat Inteligente de Marketing
            </h2>
            <p className="text-muted-foreground mb-2 max-w-md">
              Diga o que precisa e a IA escolherá o melhor modelo para gerar seu conteúdo, campanha ou estratégia.
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
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="gradient-primary rounded-lg p-2 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                    msg.role === "user"
                      ? "gradient-primary text-primary-foreground"
                      : "bg-card border border-border shadow-card"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="text-sm prose prose-sm prose-invert max-w-none leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                  <p
                    className={`text-xs mt-2 ${
                      msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="bg-secondary rounded-lg p-2 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="gradient-primary rounded-lg p-2 h-8 w-8 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-card">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
            A IA escolherá o melhor modelo automaticamente para sua necessidade
          </p>
        </div>
      </div>
    </div>
  );
}

import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import logoImg from "@/assets/logo.png";

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex gap-3 animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="gradient-primary rounded-xl p-1.5 h-9 w-9 flex items-center justify-center shadow-glow">
            <img src={logoImg} alt="IA" className="h-6 w-6 object-contain rounded-md" />
          </div>
          <span className="text-[10px] font-semibold text-primary">IA</span>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`rounded-2xl max-w-[75%] ${
          isUser
            ? "gradient-primary text-primary-foreground px-4 py-3 shadow-glow/30"
            : "bg-card/80 backdrop-blur-sm border border-border/60 px-5 py-4 shadow-card"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
            {content}
          </p>
        ) : (
          <div className="chat-markdown text-sm leading-[1.7] break-words">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        <p
          className={`text-[10px] mt-2 ${
            isUser ? "text-primary-foreground/50 text-right" : "text-muted-foreground"
          }`}
        >
          {timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="bg-secondary rounded-xl p-1.5 h-9 w-9 flex items-center justify-center">
            <User className="h-5 w-5 text-secondary-foreground" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Você</span>
        </div>
      )}
    </div>
  );
}

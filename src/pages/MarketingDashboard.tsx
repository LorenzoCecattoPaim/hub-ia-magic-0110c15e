import { Megaphone, TrendingUp, Image, FileText, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Posts Gerados", value: "0", icon: FileText, change: "Comece agora" },
  { label: "Imagens Criadas", value: "0", icon: Image, change: "Crie sua primeira" },
  { label: "Campanhas Ativas", value: "0", icon: Megaphone, change: "Lance uma campanha" },
  { label: "Insights do Mês", value: "3", icon: TrendingUp, change: "Novos insights" },
];

const quickActions = [
  { title: "Criar Post", description: "Gere conteúdo para redes sociais com IA", icon: FileText, route: "/gerador" },
  { title: "Gerar Imagem", description: "Crie visuais promocionais automaticamente", icon: Image, route: "/gerador" },
  { title: "Nova Campanha", description: "Monte uma estratégia completa de marketing", icon: Megaphone, route: "/chat" },
  { title: "Chat com IA", description: "Converse com seu assistente de marketing", icon: Sparkles, route: "/chat" },
];

const upcomingDates = [
  { date: "12 Jun", event: "Dia dos Namorados", tip: "Promoções românticas e kits especiais" },
  { date: "24 Jun", event: "São João", tip: "Conteúdo temático e promoções festivas" },
  { date: "14 Ago", event: "Dia dos Pais", tip: "Campanhas de presentes e homenagens" },
];

export default function MarketingDashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Bom dia! 👋</h1>
        <p className="text-muted-foreground mt-1">
          Seu hub de marketing está pronto para impulsionar suas vendas.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="bg-card border-border shadow-card hover:shadow-glow transition-shadow duration-300"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-display font-bold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-primary mt-1">{stat.change}</p>
                </div>
                <div className="gradient-primary rounded-xl p-3">
                  <stat.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Ações Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.title}
                className="bg-card border-border shadow-card hover:shadow-glow hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                onClick={() => navigate(action.route)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="gradient-primary rounded-lg p-2.5 shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <action.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-semibold text-foreground">{action.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Upcoming Dates */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Datas Importantes</h2>
          <Card className="bg-card border-border shadow-card">
            <CardContent className="p-0 divide-y divide-border">
              {upcomingDates.map((item) => (
                <div key={item.event} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="gradient-warm rounded-lg px-2.5 py-1 text-xs font-bold text-foreground shrink-0">
                      {item.date}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.event}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.tip}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button
            className="w-full gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            onClick={() => navigate("/chat")}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Falar com IA
          </Button>
        </div>
      </div>
    </div>
  );
}

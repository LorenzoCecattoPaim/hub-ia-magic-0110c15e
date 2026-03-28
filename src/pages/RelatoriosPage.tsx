import { useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Insight = {
  title: string;
  description: string;
  category: "Tendência" | "Oportunidade" | "Insight" | "Case";
};

const initialInsights: Insight[] = [
  {
    title: "Tendência: Vídeos curtos dominam",
    description: "Reels e TikToks geram 3x mais engajamento que posts estáticos. Considere adaptar seu conteúdo.",
    category: "Tendência",
  },
  {
    title: "Seu nicho está em alta",
    description: "Buscas por produtos do seu segmento cresceram 18% este mês. Aproveite para investir em conteúdo.",
    category: "Oportunidade",
  },
  {
    title: "Melhores horários de postagem",
    description: "Para seu público, os melhores horários são: 9h, 12h e 19h nos dias úteis.",
    category: "Insight",
  },
  {
    title: "Case: Loja que triplicou vendas",
    description: "Uma loja similar à sua usou cupons progressivos e aumentou o ticket médio em 40%.",
    category: "Case",
  },
];

const categoryColors: Record<Insight["category"], string> = {
  Tendência: "gradient-primary",
  Oportunidade: "gradient-warm",
  Insight: "gradient-accent",
  Case: "bg-secondary",
};

const insightTemplates: Insight[] = [
  {
    title: "Campanhas sazonais em alta",
    description: "Campanhas temáticas geram até 25% mais cliques. Planeje conteúdos especiais para datas-chave.",
    category: "Oportunidade",
  },
  {
    title: "Formato carrossel performa melhor",
    description: "Posts em carrossel aumentam a retenção e impulsionam salvamentos. Teste dicas em sequência.",
    category: "Insight",
  },
  {
    title: "Clientes respondem a prova social",
    description: "Depoimentos reais elevam conversões. Inclua avaliações e números de clientes satisfeitos.",
    category: "Tendência",
  },
];

export default function RelatoriosPage() {
  const [insights, setInsights] = useState<Insight[]>(initialInsights);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const next = insightTemplates.sort(() => 0.5 - Math.random()).slice(0, 2);
      setInsights((prev) => [...next, ...prev]);
      setLoading(false);
    }, 700);
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Relatórios & Insights</h1>
          <p className="text-muted-foreground mt-1">Tendências, ideias e insights gerados para seu negócio</p>
        </div>
        <Button variant="outline" className="border-border text-foreground hover:bg-accent">
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Monthly Report Card */}
      <Card className="gradient-surface border-border shadow-glow overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <CardContent className="p-8 relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider">Relatório Mensal</p>
              <h2 className="font-display text-xl font-bold text-foreground mt-2">Junho 2026</h2>
              <p className="text-muted-foreground text-sm mt-2 max-w-lg">
                Resumo completo das tendências de marketing digital, oportunidades identificadas e sugestões práticas
                para o seu negócio.
              </p>
            </div>
            <Button
              className="gradient-primary text-primary-foreground hover:opacity-90"
              onClick={handleGenerate}
              disabled={loading}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Gerando..." : "Gerar com IA"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-6 mt-8">
            <div>
              <p className="text-3xl font-display font-bold text-foreground">12</p>
              <p className="text-xs text-muted-foreground mt-1">Tendências identificadas</p>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-foreground">5</p>
              <p className="text-xs text-muted-foreground mt-1">Oportunidades de crescimento</p>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-foreground">8</p>
              <p className="text-xs text-muted-foreground mt-1">Sugestões práticas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Últimos Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <Card
              key={`${insight.title}-${insight.category}`}
              className="bg-card border-border shadow-card hover:shadow-glow transition-shadow duration-300"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={`${categoryColors[insight.category]} rounded-lg px-2.5 py-1 text-xs font-bold text-primary-foreground shrink-0`}
                  >
                    {insight.category}
                  </div>
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground mt-3">{insight.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{insight.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

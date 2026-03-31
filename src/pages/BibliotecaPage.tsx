import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const templates = [
  {
    id: "social-launch",
    title: "Lançamento nas redes",
    type: "image",
    description: "Sequência de posts com CTA forte e identidade roxa.",
    cta: "Usar este modelo",
  },
  {
    id: "email-nurture",
    title: "Fluxo de nutrição",
    type: "animation",
    description: "Animação curta para aquecimento de leads.",
    cta: "Adaptar",
  },
  {
    id: "promo-banner",
    title: "Banner promocional",
    type: "image",
    description: "Headline direta + destaque do benefício.",
    cta: "Usar este modelo",
  },
  {
    id: "reels-script",
    title: "Roteiro para Reels",
    type: "animation",
    description: "Storyboard animado para vídeos rápidos.",
    cta: "Adaptar",
  },
  {
    id: "case-study",
    title: "Estudo de caso",
    type: "image",
    description: "Layout elegante para provas sociais.",
    cta: "Usar este modelo",
  },
  {
    id: "event-invite",
    title: "Convite para evento",
    type: "animation",
    description: "Convite animado com contagem regressiva.",
    cta: "Adaptar",
  },
  {
    id: "carousel",
    title: "Carrossel educativo",
    type: "image",
    description: "Slides sequenciais para explicar soluções.",
    cta: "Usar este modelo",
  },
  {
    id: "landing-highlight",
    title: "Hero de landing page",
    type: "image",
    description: "Hero section com destaque visual intenso.",
    cta: "Adaptar",
  },
];

const featuredTemplates = templates.slice(0, 3);

export default function BibliotecaPage() {
  return (
    <div className="p-6 space-y-10 max-w-7xl mx-auto">
      <section className="rounded-2xl border border-border shadow-card gradient-primary-soft p-8">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            Biblioteca para Meu negócio
          </span>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Modelos prontos para acelerar seu marketing
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Explore exemplos visuais com imagens e animações. Visualize, escolha e adapte modelos
            prontos para aplicar no seu negócio com poucos cliques.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Destaques da biblioteca</h2>
            <p className="text-sm text-muted-foreground">
              Seleção rápida com os modelos mais usados pela comunidade.
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-accent">Ver todos</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredTemplates.map((template) => (
            <Card key={template.id} className="bg-card border-border shadow-card">
              <CardContent className="p-5 space-y-4">
                <div className="relative h-44 rounded-xl overflow-hidden border border-border">
                  <div className="absolute inset-0 gradient-primary" />
                  <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_top,hsla(293,69%,49%,0.35),transparent_60%)]" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-primary-foreground/80">{template.type}</span>
                    <Wand2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{template.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                </div>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-accent">
                  {template.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Galeria completa</h2>
          <p className="text-sm text-muted-foreground">
            Visualize todos os modelos disponíveis e escolha o melhor ponto de partida.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="bg-card border-border shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
            >
              <CardContent className="p-4 space-y-3">
                <div className="relative h-32 rounded-lg overflow-hidden border border-border">
                  <div className="absolute inset-0 gradient-primary" />
                  <div className="absolute inset-0 opacity-60 bg-[linear-gradient(160deg,hsla(304,100%,20%,0.35),transparent)]" />
                  {template.type === "animation" && (
                    <div className="absolute inset-0 animate-pulse opacity-40 bg-[radial-gradient(circle,hsla(293,69%,49%,0.4),transparent_70%)]" />
                  )}
                  <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/80">
                    {template.type}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{template.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                </div>
                <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-accent">
                  {template.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

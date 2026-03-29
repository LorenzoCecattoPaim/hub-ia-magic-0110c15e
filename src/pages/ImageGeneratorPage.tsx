import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Download,
  Copy,
  Shuffle,
  Zap,
  Crown,
  Image as ImageIcon,
  Instagram,
  Palette,
  ShoppingBag,
  Megaphone,
  CreditCard,
  X,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCredits } from "@/hooks/useCredits";
import { useGeneratedImages, useGenerateImage, type GeneratedImage } from "@/hooks/useGeneratedImages";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const templates = [
  { id: "instagram", label: "Post Instagram", icon: Instagram },
  { id: "logo", label: "Logo", icon: Palette },
  { id: "ad", label: "Anúncio", icon: Megaphone },
  { id: "product", label: "Produto", icon: ShoppingBag },
];

export default function ImageGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<"fast" | "pro">("fast");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const { data: balance } = useCredits();
  const { user } = useAuth();
  const { data: images, isLoading: imagesLoading } = useGeneratedImages();
  const generateMutation = useGenerateImage();

  const creditCost = quality === "pro" ? 15 : 5;

  const scrollToLatest = useCallback(() => {
    setTimeout(() => {
      galleryRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  }, []);

  useEffect(() => {
    if (generateMutation.isSuccess) {
      scrollToLatest();
    }
  }, [generateMutation.isSuccess, scrollToLatest]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generateMutation.isPending) return;

    if ((balance ?? 0) < creditCost) {
      toast.error(`Créditos insuficientes. Necessário: ${creditCost}, disponível: ${balance ?? 0}`);
      return;
    }

    generateMutation.mutate({
      prompt: prompt.trim(),
      quality,
      template: selectedTemplate || undefined,
    });
  };

  const handleVary = (img: GeneratedImage) => {
    setPrompt(img.optimized_prompt || img.prompt);
    setSelectedImage(null);
    toast.info("Prompt carregado! Clique em Gerar para criar uma variação.");
  };

  const handleDownload = async (img: GeneratedImage) => {
    try {
      const response = await fetch(img.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `imagem-${img.id.substring(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleCopyPrompt = (img: GeneratedImage) => {
    navigator.clipboard.writeText(img.optimized_prompt || img.prompt);
    toast.success("Prompt copiado!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-full lg:w-[420px] xl:w-[460px] border-r border-border flex flex-col shrink-0 bg-card/50">
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="gradient-primary rounded-xl p-2">
                <ImageIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">
                  Gerador de Imagens
                </h1>
                <p className="text-xs text-muted-foreground">
                  Crie imagens profissionais com IA
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-medium gap-1 ${
                (balance ?? 0) <= 10
                  ? "border-destructive text-destructive"
                  : "border-primary/40 text-primary"
              }`}
            >
              <CreditCard className="h-3 w-3" />
              {balance ?? 0}
            </Badge>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Descreva sua imagem
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Logo moderno para cafeteria artesanal com tons terrosos e minimalista..."
              className="min-h-[120px] bg-background border-border resize-none text-sm placeholder:text-muted-foreground/60 focus:border-primary/50 rounded-2xl"
              maxLength={2000}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {prompt.length}/2000
              </span>
              <span className="text-xs text-muted-foreground">
                ⌘+Enter para gerar
              </span>
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tipo de imagem
            </label>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    setSelectedTemplate(
                      selectedTemplate === t.id ? null : t.id
                    )
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                    selectedTemplate === t.id
                      ? "gradient-primary text-primary-foreground border-transparent shadow-glow"
                      : "bg-secondary/50 text-secondary-foreground border-border hover:border-primary/30 hover:bg-secondary"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Qualidade
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuality("fast")}
                className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all duration-200 ${
                  quality === "fast"
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-secondary/30 hover:border-primary/30"
                }`}
              >
                <Zap
                  className={`h-4 w-4 ${
                    quality === "fast"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      quality === "fast"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Rápido
                  </p>
                  <p className="text-xs text-muted-foreground">5 créditos</p>
                </div>
              </button>
              <button
                onClick={() => setQuality("pro")}
                className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all duration-200 ${
                  quality === "pro"
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-secondary/30 hover:border-primary/30"
                }`}
              >
                <Crown
                  className={`h-4 w-4 ${
                    quality === "pro"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      quality === "pro"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Alta Qualidade
                  </p>
                  <p className="text-xs text-muted-foreground">15 créditos</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-5 border-t border-border">
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generateMutation.isPending}
            className="w-full h-12 gradient-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:opacity-90 transition-all duration-200 disabled:opacity-40 gap-2"
          >
            {generateMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Imagem — {creditCost} créditos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* RIGHT PANEL — Gallery */}
      <div
        ref={galleryRef}
        className="flex-1 overflow-y-auto p-5 bg-background"
      >
        {/* Generating skeleton */}
        {generateMutation.isPending && (
          <div className="mb-5">
            <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-card animate-pulse">
              <Skeleton className="w-full aspect-square" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          </div>
        )}

        {/* Images Grid */}
        {imagesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="bg-card border-border rounded-2xl overflow-hidden"
              >
                <Skeleton className="w-full aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : images && images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {images.map((img) => (
              <Card
                key={img.id}
                className="bg-card border-border rounded-2xl overflow-hidden shadow-card group hover:border-primary/30 hover:shadow-glow transition-all duration-300"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.prompt}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay buttons */}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-sm hover:bg-card border border-border"
                      onClick={() => setSelectedImage(img)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-sm hover:bg-card border border-border"
                      onClick={() => handleVary(img)}
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-sm hover:bg-card border border-border"
                      onClick={() => handleDownload(img)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-sm hover:bg-card border border-border"
                      onClick={() => handleCopyPrompt(img)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Quality badge */}
                  <Badge
                    className={`absolute top-2 right-2 text-[10px] ${
                      img.quality === "pro"
                        ? "gradient-accent text-primary-foreground"
                        : "bg-secondary/80 text-secondary-foreground"
                    }`}
                  >
                    {img.quality === "pro" ? "PRO" : "RÁPIDO"}
                  </Badge>
                </div>
                <div className="p-3">
                  <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                    {img.prompt}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(img.created_at).toLocaleDateString("pt-BR")} •{" "}
                    {img.credits_used} créditos
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-secondary/50 rounded-3xl p-6 mb-4">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">
              Nenhuma imagem gerada
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Descreva o que você precisa no campo ao lado e clique em gerar
              para criar sua primeira imagem com IA.
            </p>
          </div>
        )}
      </div>

      {/* Image Detail Modal */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-3xl bg-card border-border rounded-2xl p-0 overflow-hidden">
          {selectedImage && (
            <>
              <div className="relative">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[60vh] object-contain bg-background"
                />
              </div>
              <div className="p-5 space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-display text-base">
                    Detalhes da Imagem
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Prompt Original
                    </p>
                    <p className="text-sm text-foreground bg-secondary/50 rounded-xl p-3">
                      {selectedImage.prompt}
                    </p>
                  </div>
                  {selectedImage.optimized_prompt &&
                    selectedImage.optimized_prompt !==
                      selectedImage.prompt && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Prompt Otimizado
                        </p>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-xl p-3">
                          {selectedImage.optimized_prompt}
                        </p>
                      </div>
                    )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {selectedImage.quality === "pro" ? "Alta Qualidade" : "Rápido"}
                    </Badge>
                    <span>•</span>
                    <span>{selectedImage.credits_used} créditos</span>
                    <span>•</span>
                    <span>
                      {new Date(selectedImage.created_at).toLocaleDateString(
                        "pt-BR",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-border"
                    onClick={() => handleVary(selectedImage)}
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Gerar Variação
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-border"
                    onClick={() => handleDownload(selectedImage)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-border"
                    onClick={() => handleCopyPrompt(selectedImage)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

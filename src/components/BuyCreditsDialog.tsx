import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { useBuyCredits } from "@/hooks/useCredits";

const packages = [
  { id: "small", credits: 100, price: "R$ 9,90", popular: false },
  { id: "medium", credits: 300, price: "R$ 24,90", popular: true },
  { id: "large", credits: 1000, price: "R$ 69,90", popular: false },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsDialog({ open, onOpenChange }: Props) {
  const buyCredits = useBuyCredits();

  const handleBuy = async (pkg: string) => {
    await buyCredits.mutateAsync(pkg);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Comprar Créditos
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                pkg.popular ? "border-primary shadow-glow" : ""
              }`}
              onClick={() => handleBuy(pkg.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{pkg.credits} créditos</span>
                    {pkg.popular && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{pkg.price}</span>
                </div>
                <Button
                  size="sm"
                  disabled={buyCredits.isPending}
                  className="gradient-primary text-primary-foreground"
                >
                  Comprar
                </Button>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center">
            Pagamento simulado • Pronto para integrar Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

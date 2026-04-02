import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Check } from "lucide-react";
import { useUpgradePlan, useSubscription } from "@/hooks/useCredits";

const plans = [
  {
    id: "basic",
    name: "Basico",
    price: "R$ 199/mes",
    credits: "500 creditos/mes",
    features: ["Chat IA completo", "Modelos premium", "Suporte padrao"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$ 424/mes",
    credits: "1200 creditos/mes",
    features: ["Tudo do Basico", "Compra de creditos avulsos", "Suporte prioritario"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradePlanDialog({ open, onOpenChange }: Props) {
  const upgradePlan = useUpgradePlan();
  const { data: subscription } = useSubscription();

  const handleUpgrade = async (plan: string) => {
    await upgradePlan.mutateAsync(plan);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Escolha seu Plano
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`p-4 transition-all ${
                  plan.id === "premium" ? "border-primary shadow-glow" : ""
                } ${isCurrent ? "opacity-70" : "hover:border-primary/50 cursor-pointer"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{plan.name}</span>
                      {isCurrent && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-primary">{plan.price}</p>
                    <p className="text-xs text-muted-foreground">{plan.credits}</p>
                    <ul className="space-y-1 mt-2">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    size="sm"
                    disabled={isCurrent || upgradePlan.isPending}
                    onClick={() => handleUpgrade(plan.id)}
                    className={plan.id === "premium" ? "gradient-primary text-primary-foreground" : ""}
                    variant={plan.id === "premium" ? "default" : "outline"}
                  >
                    {isCurrent ? "Atual" : "Selecionar"}
                  </Button>
                </div>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground text-center">
            Assinatura ativada apos confirmacao do pagamento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { CreditCard, Zap, AlertTriangle } from "lucide-react";
import { useCredits, useSubscription } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { BuyCreditsDialog } from "@/components/BuyCreditsDialog";
import { UpgradePlanDialog } from "@/components/UpgradePlanDialog";

export function CreditsDisplay({ collapsed = false }: { collapsed?: boolean }) {
  const { data: balance, isLoading } = useCredits();
  const { data: subscription } = useSubscription();
  const [buyOpen, setBuyOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isLoading) return null;

  const isLow = (balance ?? 0) <= 10;

  if (collapsed) {
    return (
      <>
        <div className={`flex items-center justify-center p-2 rounded-lg ${isLow ? "bg-destructive/10" : "bg-primary/10"}`}>
          <CreditCard className={`h-4 w-4 ${isLow ? "text-destructive" : "text-primary"}`} />
        </div>
        <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} />
        <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    );
  }

  return (
    <>
      <div className="px-3 py-2 space-y-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLow ? "bg-destructive/10" : "bg-primary/10"}`}>
          {isLow ? (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <CreditCard className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className={`text-sm font-medium ${isLow ? "text-destructive" : "text-primary"}`}>
            💳 {balance ?? 0} créditos
          </span>
        </div>
        {subscription?.plan && (
          <span className="text-xs text-muted-foreground px-3">
            Plano: {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
          </span>
        )}
        <div className="flex gap-1.5 px-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => setBuyOpen(true)}
          >
            <Zap className="h-3 w-3 mr-1" />
            Comprar
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7 gradient-primary text-primary-foreground"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade
          </Button>
        </div>
      </div>
      <BuyCreditsDialog open={buyOpen} onOpenChange={setBuyOpen} />
      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}

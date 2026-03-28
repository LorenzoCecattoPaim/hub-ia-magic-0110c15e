import { Ticket, Plus, Sparkles, Calendar, Percent, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sampleCoupons = [
  { code: "PROMO10", type: "percent", value: 10, expires: "30/06/2026", status: "ativo", uses: 23 },
  { code: "FRETE0", type: "fixed", value: 0, expires: "15/07/2026", status: "ativo", uses: 45 },
  { code: "BF2025", type: "percent", value: 25, expires: "30/11/2025", status: "expirado", uses: 189 },
];

export default function CuponsPage() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Central de Cupons</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie cupons de desconto com ajuda da IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border text-foreground hover:bg-accent">
            <Sparkles className="h-4 w-4 mr-2" />
            Sugerir Cupom
          </Button>
          <Button className="gradient-primary text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="gradient-primary rounded-xl p-3">
              <Ticket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Cupons Ativos</p>
              <p className="text-2xl font-display font-bold text-foreground">2</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="gradient-warm rounded-xl p-3">
              <Percent className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Usos Totais</p>
              <p className="text-2xl font-display font-bold text-foreground">257</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="gradient-accent rounded-xl p-3">
              <DollarSign className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Economia Gerada</p>
              <p className="text-2xl font-display font-bold text-foreground">R$ 4.320</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card className="bg-card border-border shadow-card overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg">Seus Cupons</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {sampleCoupons.map((coupon) => (
              <div key={coupon.code} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-4">
                  <code className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-mono font-bold">
                    {coupon.code}
                  </code>
                  <div>
                    <p className="text-sm text-foreground font-medium">
                      {coupon.type === "percent" ? `${coupon.value}% de desconto` : "Frete grátis"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Expira em {coupon.expires}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{coupon.uses} usos</span>
                  <Badge variant={coupon.status === "ativo" ? "default" : "secondary"} className={coupon.status === "ativo" ? "gradient-primary text-primary-foreground" : ""}>
                    {coupon.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

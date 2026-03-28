import { useMemo, useState } from "react";
import { Ticket, Plus, Sparkles, Calendar, Percent, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Coupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  expires: string;
  status: "ativo" | "expirado";
  uses: number;
};

const initialCoupons: Coupon[] = [
  { code: "PROMO10", type: "percent", value: 10, expires: "2026-06-30", status: "ativo", uses: 23 },
  { code: "FRETE0", type: "fixed", value: 0, expires: "2026-07-15", status: "ativo", uses: 45 },
  { code: "BF2025", type: "percent", value: 25, expires: "2025-11-30", status: "expirado", uses: 189 },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: "",
    expires: "",
  });

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.status === "ativo").length;
    const uses = coupons.reduce((acc, c) => acc + c.uses, 0);
    return { active, uses };
  }, [coupons]);

  const validateCoupon = () => {
    if (!form.code.trim()) return "Informe o código do cupom.";
    if (!form.expires) return "Informe a data de expiração.";
    if (form.expires < today()) return "A data de expiração deve ser futura.";
    const value = Number(form.value);
    if (Number.isNaN(value)) return "Informe o valor do cupom.";
    if (form.type === "percent" && (value <= 0 || value > 100)) {
      return "Percentual deve ser entre 1 e 100.";
    }
    if (form.type === "fixed" && value < 0) {
      return "Valor fixo não pode ser negativo.";
    }
    return null;
  };

  const handleCreateCoupon = () => {
    const error = validateCoupon();
    if (error) {
      toast.error(error);
      return;
    }
    const value = Number(form.value);
    const newCoupon: Coupon = {
      code: form.code.trim().toUpperCase(),
      type: form.type as Coupon["type"],
      value,
      expires: form.expires,
      status: form.expires < today() ? "expirado" : "ativo",
      uses: 0,
    };
    setCoupons((prev) => [newCoupon, ...prev]);
    setForm({ code: "", type: "percent", value: "", expires: "" });
    setShowForm(false);
    toast.success("Cupom criado com sucesso!");
  };

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
          <Button className="gradient-primary text-primary-foreground hover:opacity-90" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="bg-card border-border shadow-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="font-display text-lg">Criar novo cupom</CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="EX: PROMO20"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual</SelectItem>
                  <SelectItem value="fixed">Valor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Valor</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === "percent" ? "10" : "25"}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Expira em</Label>
              <Input
                type="date"
                value={form.expires}
                onChange={(e) => setForm({ ...form, expires: e.target.value })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <Button variant="outline" className="border-border" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button className="gradient-primary text-primary-foreground" onClick={handleCreateCoupon}>
                Criar Cupom
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="gradient-primary rounded-xl p-3">
              <Ticket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Cupons Ativos</p>
              <p className="text-2xl font-display font-bold text-foreground">{stats.active}</p>
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
              <p className="text-2xl font-display font-bold text-foreground">{stats.uses}</p>
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
            {coupons.map((coupon) => (
              <div key={coupon.code} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-4">
                  <code className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-mono font-bold">
                    {coupon.code}
                  </code>
                  <div>
                    <p className="text-sm text-foreground font-medium">
                      {coupon.type === "percent" ? `${coupon.value}% de desconto` : coupon.value === 0 ? "Frete grátis" : `R$ ${coupon.value} off`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Expira em{" "}
                      {new Date(coupon.expires).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{coupon.uses} usos</span>
                  <Badge
                    variant={coupon.status === "ativo" ? "default" : "secondary"}
                    className={coupon.status === "ativo" ? "gradient-primary text-primary-foreground" : ""}
                  >
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

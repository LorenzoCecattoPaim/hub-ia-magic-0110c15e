import { Building2, Bell, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const integrations = [
  { name: "Lovable AI", description: "Gateway OpenAI para chat e prompts", connected: true },
  { name: "Leonardo AI", description: "Geração de imagens por IA", connected: true },
  { name: "WhatsApp", description: "Evolution API — Envio de mensagens", connected: false },
  { name: "Omie", description: "Sistema financeiro e ERP", connected: false },
  { name: "Bling", description: "ERP e gestão de estoque", connected: false },
];

export default function ConfiguracoesPage() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie seu perfil, integrações e preferências</p>
      </div>

      {/* Business Info */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Dados do Negócio
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nome da Empresa</Label>
              <Input placeholder="Minha Empresa" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Nicho/Segmento</Label>
              <Input placeholder="Ex: Moda feminina, Restaurante..." className="bg-secondary border-border" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-foreground">Descrição breve</Label>
              <Input placeholder="Descreva seu negócio em uma frase" className="bg-secondary border-border" />
            </div>
          </div>
          <Button className="gradient-primary text-primary-foreground hover:opacity-90">
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Integrações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {integrations.map((int) => (
              <div key={int.name} className="flex items-center justify-between p-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{int.name}</h3>
                  <p className="text-xs text-muted-foreground">{int.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {int.connected ? "Conectado" : "Desconectado"}
                  </span>
                  <Switch checked={int.connected} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Relatório Mensal</p>
              <p className="text-xs text-muted-foreground">Receba um resumo de insights por email</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Datas Comemorativas</p>
              <p className="text-xs text-muted-foreground">Alertas sobre datas importantes se aproximando</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Sugestões da IA</p>
              <p className="text-xs text-muted-foreground">Notificações quando a IA tiver novos insights</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

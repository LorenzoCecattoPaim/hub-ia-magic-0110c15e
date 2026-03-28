import { FolderOpen, Upload, Search, FileText, Image, FileSpreadsheet, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const files = [
  { name: "Catálogo Produtos 2026.pdf", type: "pdf", size: "2.4 MB", date: "15/03/2026", icon: FileText },
  { name: "Fotos Produtos.zip", type: "image", size: "45 MB", date: "10/03/2026", icon: Image },
  { name: "Planilha Preços.xlsx", type: "excel", size: "340 KB", date: "01/03/2026", icon: FileSpreadsheet },
  { name: "Manual Marca.pdf", type: "pdf", size: "5.1 MB", date: "20/02/2026", icon: FileText },
];

export default function BibliotecaPage() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Biblioteca de Conteúdo</h1>
          <p className="text-muted-foreground mt-1">Faça upload de arquivos para a IA conhecer seu negócio</p>
        </div>
        <Button className="gradient-primary text-primary-foreground hover:opacity-90">
          <Upload className="h-4 w-4 mr-2" />
          Enviar Arquivo
        </Button>
      </div>

      {/* Upload Zone */}
      <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer bg-card">
        <CardContent className="p-10 flex flex-col items-center justify-center text-center">
          <div className="gradient-primary rounded-2xl p-4 mb-4">
            <Upload className="h-8 w-8 text-primary-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">Arraste arquivos aqui</h3>
          <p className="text-sm text-muted-foreground mt-1">
            PDFs, planilhas Excel, imagens de produtos — tudo que ajude a IA entender seu negócio
          </p>
          <p className="text-xs text-muted-foreground mt-3">PDF, XLSX, CSV, JPG, PNG • Máximo 20MB por arquivo</p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar arquivos..." className="pl-10 bg-card border-border" />
        </div>
        <Button variant="outline" className="border-border text-foreground hover:bg-accent">
          <Filter className="h-4 w-4 mr-2" />
          Filtrar
        </Button>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <Card key={file.name} className="bg-card border-border shadow-card hover:shadow-glow hover:border-primary/30 transition-all duration-200 cursor-pointer group">
            <CardContent className="p-5">
              <div className="gradient-primary rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <file.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground truncate">{file.name}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">{file.size}</span>
                <span className="text-xs text-muted-foreground">{file.date}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

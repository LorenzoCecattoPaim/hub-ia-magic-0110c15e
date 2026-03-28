import { useMemo, useRef, useState } from "react";
import { Upload, Search, FileText, Image, FileSpreadsheet, Filter, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  buildRagContextSummary,
  buildRagFileEntry,
  loadRagFiles,
  removeRagFile,
  saveRagFiles,
  type RagFileEntry,
} from "@/lib/rag";

const MAX_SIZE_MB = 20;
const ACCEPTED_EXTENSIONS = [".pdf", ".xlsx", ".xls", ".csv", ".txt", ".png", ".jpg", ".jpeg"];

const iconMap: Record<string, typeof FileText> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  txt: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BibliotecaPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<RagFileEntry[]>(() => loadRagFiles());
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");

  const filteredFiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return files;
    return files.filter((file) => file.name.toLowerCase().includes(term));
  }, [files, search]);

  const contextSummary = useMemo(() => buildRagContextSummary(files), [files]);

  const handlePickFiles = () => {
    inputRef.current?.click();
  };

  const readTextSnippet = (file: File) =>
    new Promise<string | undefined>((resolve) => {
      const isText = file.type.startsWith("text/") || file.name.endsWith(".csv") || file.name.endsWith(".txt");
      if (!isText) {
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").slice(0, 1200));
      reader.onerror = () => resolve(undefined);
      reader.readAsText(file);
    });

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setIsUploading(true);
    const next: RagFileEntry[] = [];
    for (const file of Array.from(fileList)) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        toast.error(`Formato não suportado: ${file.name}`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`Arquivo acima de ${MAX_SIZE_MB}MB: ${file.name}`);
        continue;
      }
      const snippet = await readTextSnippet(file);
      next.push(buildRagFileEntry(file, snippet));
    }
    const updated = [...next, ...files];
    setFiles(updated);
    saveRagFiles(updated);
    setIsUploading(false);
    if (next.length) {
      toast.success(`${next.length} arquivo(s) enviados e disponíveis no chat`);
    }
  };

  const handleRemove = (id: string) => {
    const updated = removeRagFile(files, id);
    setFiles(updated);
    saveRagFiles(updated);
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Biblioteca de Conteúdo</h1>
          <p className="text-muted-foreground mt-1">
            Faça upload de arquivos para a IA conhecer seu negócio e usar no chat
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground hover:opacity-90" onClick={handlePickFiles}>
          <Upload className="h-4 w-4 mr-2" />
          Enviar Arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
      </div>

      {/* Upload Zone */}
      <Card
        className="border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer bg-card"
        onClick={handlePickFiles}
      >
        <CardContent className="p-10 flex flex-col items-center justify-center text-center">
          <div className="gradient-primary rounded-2xl p-4 mb-4">
            <Upload className="h-8 w-8 text-primary-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isUploading ? "Enviando arquivos..." : "Arraste arquivos aqui"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            PDFs, planilhas Excel e textos que ajudam a IA a entender seu negócio
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            PDF, XLSX, CSV, TXT, JPG, PNG • Máximo {MAX_SIZE_MB}MB por arquivo
          </p>
          {contextSummary && (
            <p className="text-xs text-primary mt-4">
              Contexto ativo no chat: {files.length} arquivo(s)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar arquivos..."
            className="pl-10 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="border-border text-foreground hover:bg-accent">
          <Filter className="h-4 w-4 mr-2" />
          Filtrar
        </Button>
      </div>

      {/* Files Grid */}
      {filteredFiles.length === 0 ? (
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum arquivo enviado ainda. Faça upload para usar no contexto do chat.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            const Icon = iconMap[ext] || FileText;
            return (
              <Card
                key={file.id}
                className="bg-card border-border shadow-card hover:shadow-glow hover:border-primary/30 transition-all duration-200"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="gradient-primary rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => handleRemove(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="text-sm font-medium text-foreground truncate">{file.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {file.textSnippet ? (
                    <p className="text-xs text-muted-foreground mt-3 overflow-hidden">
                      {file.textSnippet}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-3">
                      Conteúdo binário pronto para contexto do chat.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

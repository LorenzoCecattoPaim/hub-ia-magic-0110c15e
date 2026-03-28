export type RagFileEntry = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  textSnippet?: string;
};

const STORAGE_KEY = "ai_marketing_rag_files";
export const RAG_UPDATE_EVENT = "rag:update";

function safeWindow() {
  return typeof window === "undefined" ? null : window;
}

export function loadRagFiles(): RagFileEntry[] {
  const win = safeWindow();
  if (!win) return [];
  try {
    const raw = win.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RagFileEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRagFiles(files: RagFileEntry[]) {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  win.dispatchEvent(new CustomEvent(RAG_UPDATE_EVENT));
}

export function buildRagContextSummary(files: RagFileEntry[]) {
  if (!files.length) return "";
  const lines: string[] = [];
  const maxFiles = 6;
  const maxSnippet = 280;
  files.slice(0, maxFiles).forEach((file) => {
    const typeLabel = file.type ? file.type.toUpperCase() : "ARQUIVO";
    let line = `- ${file.name} (${typeLabel})`;
    if (file.textSnippet) {
      const snippet =
        file.textSnippet.length > maxSnippet
          ? `${file.textSnippet.slice(0, maxSnippet)}…`
          : file.textSnippet;
      line += ` | Trecho: ${snippet}`;
    }
    lines.push(line);
  });
  if (files.length > maxFiles) {
    lines.push(`- +${files.length - maxFiles} arquivo(s) adicionais`);
  }
  return lines.join("\n");
}

export function buildRagFileEntry(file: File, textSnippet?: string): RagFileEntry {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    type: file.type || file.name.split(".").pop() || "arquivo",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    textSnippet,
  };
}

export function removeRagFile(files: RagFileEntry[], id: string) {
  return files.filter((file) => file.id !== id);
}

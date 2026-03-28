import { describe, expect, it } from "vitest";
import { ensureCta, buildPromptWithContext } from "@/services/ai";

describe("ai helpers", () => {
  it("adds CTA when missing", () => {
    const input = "Aqui está um post para Instagram sobre seu produto.";
    const result = ensureCta(input);
    expect(result).toMatch(/CTA:/);
  });

  it("keeps CTA when already present", () => {
    const input = "Aproveite agora e fale no WhatsApp para garantir o desconto.";
    const result = ensureCta(input);
    expect(result).toBe(input);
  });

  it("builds prompt with context when provided", () => {
    const prompt = "Crie uma legenda.";
    const result = buildPromptWithContext(prompt, { ragContext: "- Catálogo 2026" });
    expect(result).toContain("Contexto adicional");
    expect(result).toContain("Catálogo 2026");
  });
});

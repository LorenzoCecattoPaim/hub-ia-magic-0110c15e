import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatPage from "@/pages/ChatPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const aiOrchestrator = vi.fn().mockResolvedValue({ response: "Resposta da IA" });
const navigate = vi.fn();

vi.mock("@/services/ai", () => ({
  aiOrchestrator,
}));

vi.mock("@/hooks/useBusinessProfile", () => ({
  useBusinessProfile: () => ({
    data: { nome_empresa: "Loja Teste", nicho: "Moda" },
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

describe("ChatPage", () => {
  it("sends a prompt and renders response", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ChatPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("Digite seu comando de marketing..."), {
      target: { value: "Crie um post" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(aiOrchestrator).toHaveBeenCalled();
    });

    expect(await screen.findByText("Crie um post")).toBeInTheDocument();
    expect(await screen.findByText("Resposta da IA")).toBeInTheDocument();
  });
});

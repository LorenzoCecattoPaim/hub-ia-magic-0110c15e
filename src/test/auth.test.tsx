import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuthPage from "@/pages/AuthPage";

const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
const signUp = vi.fn().mockResolvedValue({ error: null });
const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
const navigate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithPassword, signUp },
  },
}));

vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth } },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

describe("AuthPage", () => {
  beforeEach(() => {
    signInWithPassword.mockClear();
    signUp.mockClear();
    signInWithOAuth.mockClear();
    navigate.mockClear();
  });

  it("submits login with email and password", async () => {
    render(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "user@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "user@test.com",
        password: "123456",
      });
    });
  });

  it("submits signup when toggled", async () => {
    render(<AuthPage />);

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "new@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "123456" },
    });

    const createButtons = screen.getAllByRole("button", { name: "Criar conta" });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "new@test.com",
        password: "123456",
        options: { emailRedirectTo: window.location.origin },
      });
    });
  });
});

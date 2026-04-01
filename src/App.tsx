import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/OnboardingPage";
import { DashboardLayout } from "./components/DashboardLayout";
import ChatPage from "./pages/ChatPage";
import ImageGeneratorPage from "./pages/ImageGeneratorPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import BibliotecaPage from "./pages/BibliotecaPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import MeuNegocioPage from "./pages/MeuNegocioPage";

const queryClient = new QueryClient();

const WithLayout = ({ children }: { children: React.ReactNode }) => (
  <DashboardLayout>{children}</DashboardLayout>
);

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
            <Route path="/" element={<Protected><Index /></Protected>} />
            <Route path="/chat" element={<Protected><WithLayout><ChatPage /></WithLayout></Protected>} />
            <Route path="/meu-negocio" element={<Protected><WithLayout><MeuNegocioPage /></WithLayout></Protected>} />
            <Route path="/gerador" element={<Protected><WithLayout><ImageGeneratorPage /></WithLayout></Protected>} />
            <Route path="/relatorios" element={<Protected><WithLayout><RelatoriosPage /></WithLayout></Protected>} />
            <Route path="/biblioteca" element={<Protected><WithLayout><BibliotecaPage /></WithLayout></Protected>} />
            <Route path="/configuracoes" element={<Protected><WithLayout><ConfiguracoesPage /></WithLayout></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

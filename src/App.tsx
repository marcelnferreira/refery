import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { isFirebaseConfigured } from "@/integrations/firebase/client";
import { Loader2 } from "lucide-react";

// REFERY Pages
import DashboardPage from "@/pages/refery/DashboardPage";
import IndicacoesPage from "@/pages/refery/IndicacoesPage";
import ClientesPage from "@/pages/refery/ClientesPage";
import AgendaPage from "@/pages/refery/AgendaPage";
import ArvoreIndicacoesPage from "@/pages/refery/ArvoreIndicacoesPage";
import FunilPage from "@/pages/refery/FunilPage";
import WhatsappPage from "@/pages/refery/WhatsappPage";
import CentralLigacoesPage from "@/pages/refery/CentralLigacoesPage";
import ConfiguracoesPage from "@/pages/refery/ConfiguracoesPage";
import UsuariosPage from "@/pages/refery/UsuariosPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AuthForm />;
}

// Layout persistente: fica montado durante toda a navegação entre páginas
// autenticadas, para que widgets globais (ex: Central Telefônica) não percam
// conexão ao trocar de tela.
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

const App = () => {
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔥</div>
          <h2 className="text-xl font-bold mb-2">Firebase não configurado</h2>
          <p className="text-muted-foreground text-sm">
            Configure as variáveis <code>VITE_FIREBASE_*</code> no arquivo <code>.env</code> e reinicie o servidor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner richColors />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/indicacoes" element={<IndicacoesPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/agenda" element={<AgendaPage />} />
                <Route path="/arvore" element={<ArvoreIndicacoesPage />} />
                <Route path="/funil" element={<FunilPage />} />
                <Route path="/whatsapp" element={<WhatsappPage />} />
                <Route path="/ligacoes" element={<CentralLigacoesPage />} />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="/usuarios" element={<UsuariosPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;

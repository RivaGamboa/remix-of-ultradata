
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import History from "./pages/History";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import UltraData from "./pages/UltraData";
import BlingCallback from "./pages/BlingCallback";
import AuthBlingCallback from "./pages/AuthBlingCallback";
import Conexoes from "./pages/Conexoes";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import BlingDashboard from "./pages/BlingDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/conexoes" element={<Conexoes />} />
            <Route path="/ultradata" element={<UltraData />} />
            <Route path="/dashboard/:connectionId" element={<BlingDashboard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/bling/callback" element={<BlingCallback />} />
            <Route path="/auth/bling/callback" element={<AuthBlingCallback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

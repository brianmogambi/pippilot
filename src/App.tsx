import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Signals from "./pages/Signals";
import SignalDetail from "./pages/SignalDetail";
import CalculatorPage from "./pages/CalculatorPage";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/SettingsPage";
import Watchlist from "./pages/Watchlist";
import PairDetail from "./pages/PairDetail";
import Journal from "./pages/Journal";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import AdminReview from "./pages/AdminReview";
import Learn from "./pages/Learn";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected onboarding (no layout) */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Protected app routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/watchlist/:pair" element={<PairDetail />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/signals/:id" element={<SignalDetail />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminReview />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

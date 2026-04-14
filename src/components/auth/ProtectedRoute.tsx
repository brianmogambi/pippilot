import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, profileLoading } = useAuth();
  const location = useLocation();

  // Phase 18.10: only show the loading spinner on the FIRST load
  // (session handshake OR initial profile fetch before any profile
  // exists). Once the profile is in memory, later profileLoading
  // transitions are background refreshes triggered by Supabase auth
  // events like TOKEN_REFRESHED on window focus. Blocking on those
  // unmounts the entire route tree — which resets every local state
  // inside the page, including any open dialog's `open` state. The
  // symptom we were chasing: the Take Manual Trade dialog closing
  // when the user alt-tabbed to copy broker data and came back.
  if (loading || (profileLoading && !profile)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If user hasn't completed onboarding and isn't already on the onboarding page
  if (profile && !profile.onboarding_completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

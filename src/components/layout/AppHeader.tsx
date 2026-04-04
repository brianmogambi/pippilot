import { useLocation, Link } from "react-router-dom";
import { Bell, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTradingAccount } from "@/hooks/use-account";
import { useUnreadAlertCount } from "@/hooks/use-alerts";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/watchlist": "Watchlist",
  "/signals": "Signals",
  "/calculator": "Risk Calculator",
  "/alerts": "Alerts Center",
  "/journal": "Trade Journal",
  "/settings": "Settings",
  "/admin": "Admin Review",
};

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const title = routeTitles[pathname] || "PipPilot AI";

  const { data: account } = useTradingAccount();
  const { data: unreadCount = 0 } = useUnreadAlertCount();

  const initials = (profile?.display_name ?? user?.email ?? "P").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6 h-14">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <span className="hidden sm:inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          AI-Assisted
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">${Number(account?.balance ?? 10000).toLocaleString()}</span>
          <span className="w-px h-3.5 bg-border" />
          <span className="text-xs text-muted-foreground">Eq ${Number(account?.equity ?? 10000).toLocaleString()}</span>
        </div>

        <Link to="/alerts" className="relative p-1.5 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Link>

        <Link to="/settings" className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/30 transition-colors">
          {initials}
        </Link>
      </div>
    </header>
  );
}

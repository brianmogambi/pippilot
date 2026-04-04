import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Eye, TrendingUp, Calculator, Bell,
  BookOpen, Settings, Activity, LogOut, ShieldCheck, GraduationCap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-admin";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/watchlist", icon: Eye, label: "Watchlist" },
  { to: "/signals", icon: TrendingUp, label: "Signals" },
  { to: "/calculator", icon: Calculator, label: "Calculator" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/journal", icon: BookOpen, label: "Journal" },
  { to: "/learn", icon: GraduationCap, label: "Learn" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar min-h-screen p-4 gap-2">
      <Link to="/" className="flex items-center gap-2 px-3 py-4 mb-4">
        <Activity className="h-7 w-7 text-primary" />
        <span className="text-lg font-bold tracking-tight text-foreground">
          PipPilot <span className="text-primary">AI</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2">
        <Separator className="bg-border/50" />
        {isAdmin && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Review
          </Link>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            ⚠️ AI-assisted analysis only. Not financial advice.
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center">v1.0 MVP</p>
      </div>
    </aside>
  );
}

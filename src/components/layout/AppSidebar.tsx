import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Calculator,
  Bell,
  Settings,
  Activity,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/signals", icon: TrendingUp, label: "Signals" },
  { to: "/calculator", icon: Calculator, label: "Calculator" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
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

      <div className="mt-auto p-3 rounded-lg bg-accent/50 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          ⚠️ AI-assisted analysis only. Not financial advice. Always manage your risk.
        </p>
      </div>
    </aside>
  );
}

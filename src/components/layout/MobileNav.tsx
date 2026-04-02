import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Eye,
  TrendingUp,
  Calculator,
  Bell,
  BookOpen,
  Settings,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/watchlist", icon: Eye, label: "Watch" },
  { to: "/signals", icon: TrendingUp, label: "Signals" },
  { to: "/calculator", icon: Calculator, label: "Calc" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/journal", icon: BookOpen, label: "Journal" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-2 overflow-x-auto">
      {navItems.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] transition-colors shrink-0 ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

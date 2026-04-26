import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Eye, TrendingUp, Bell, BookOpen, Calculator,
} from "lucide-react";

// Phase 6 (improvement plan): Calculator promoted into the mobile
// nav — beginners reach for sizing far more often than the Learn
// glossary, and Phase 3's tooltips already cover the in-context
// glossary need. Learn stays accessible from the desktop sidebar.
const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/watchlist", icon: Eye, label: "Watch" },
  { to: "/signals", icon: TrendingUp, label: "Signals" },
  { to: "/calculator", icon: Calculator, label: "Sizing" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/journal", icon: BookOpen, label: "Journal" },
];

export default function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border flex justify-around py-1.5 safe-area-pb">
      {navItems.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center px-1 text-[10px] transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

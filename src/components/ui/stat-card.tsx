import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type StatVariant = "default" | "success" | "warning" | "danger";

const variantStyles: Record<StatVariant, string> = {
  default: "border-border bg-card",
  success: "border-bullish/20 bg-bullish/5",
  warning: "border-warning/20 bg-warning/5",
  danger: "border-bearish/20 bg-bearish/5",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  iconColor?: string;
  variant?: StatVariant;
}

export default function StatCard({ label, value, icon: Icon, trend, iconColor = "text-primary", variant = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border p-4 space-y-2", variantStyles[variant])}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {trend && (
        <div className={`flex items-center gap-1 text-xs ${trend.positive ? "text-bullish" : "text-bearish"}`}>
          {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
    </div>
  );
}

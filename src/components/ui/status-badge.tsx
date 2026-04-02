import { cn } from "@/lib/utils";

type BadgeVariant = "bullish" | "bearish" | "neutral" | "active" | "pending" | "triggered" | "expired" | "trade" | "no_trade";

const variantStyles: Record<BadgeVariant, string> = {
  bullish: "bg-bullish/15 text-bullish border-bullish/20",
  bearish: "bg-bearish/15 text-bearish border-bearish/20",
  neutral: "bg-muted text-muted-foreground border-border",
  active: "bg-primary/15 text-primary border-primary/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  triggered: "bg-bullish/15 text-bullish border-bullish/20",
  expired: "bg-muted text-muted-foreground border-border",
  trade: "bg-bullish/15 text-bullish border-bullish/20",
  no_trade: "bg-warning/15 text-warning border-warning/20",
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export default function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", variantStyles[variant], className)}>
      {children}
    </span>
  );
}

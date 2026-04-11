import { cn } from "@/lib/utils";
import type { Freshness } from "@/lib/data-freshness";

type BadgeVariant =
  | "bullish"
  | "bearish"
  | "neutral"
  | "active"
  | "pending"
  | "triggered"
  | "expired"
  | "trade"
  | "no_trade"
  | "live"
  | "cached"
  | "fallback";

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
  live: "bg-bullish/15 text-bullish border-bullish/20",
  cached: "bg-warning/15 text-warning border-warning/20",
  fallback: "bg-muted text-muted-foreground border-border",
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

const FRESHNESS_LABELS: Record<Freshness, string> = {
  live: "Live",
  cached: "Cached",
  fallback: "Demo",
};

export function FreshnessBadge({
  freshness,
  title,
  className,
}: {
  freshness: Freshness;
  title?: string;
  className?: string;
}) {
  return (
    <span title={title}>
      <StatusBadge variant={freshness} className={className}>
        {FRESHNESS_LABELS[freshness]}
      </StatusBadge>
    </span>
  );
}

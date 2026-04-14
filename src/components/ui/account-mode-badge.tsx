import { cn } from "@/lib/utils";
import type { AccountMode } from "@/types/trading";

/**
 * Phase 18.2: consistent demo/real pill used across accounts, journal,
 * analytics and any trade view. Colors intentionally differ from the
 * regular StatusBadge palette so demo/real is visually unambiguous at
 * a glance and never blends with signal/direction badges.
 */
interface AccountModeBadgeProps {
  mode: AccountMode | null | undefined;
  className?: string;
  /** Compact variant used inside table rows. */
  size?: "sm" | "md";
}

const MODE_STYLES: Record<AccountMode, string> = {
  demo: "bg-warning/15 text-warning border-warning/30",
  real: "bg-bullish/15 text-bullish border-bullish/30",
};

const MODE_LABELS: Record<AccountMode, string> = {
  demo: "Demo",
  real: "Real",
};

export default function AccountModeBadge({
  mode,
  className,
  size = "sm",
}: AccountModeBadgeProps) {
  // Fall back to demo visually — matches the DB default for legacy rows
  // and keeps analytics readable without lighting up an "unknown" state.
  const resolved: AccountMode = mode === "real" ? "real" : "demo";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wider",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        MODE_STYLES[resolved],
        className,
      )}
      title={`Account mode: ${MODE_LABELS[resolved]}`}
    >
      {MODE_LABELS[resolved]}
    </span>
  );
}

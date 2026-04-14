import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import CloseTradeReviewDialog from "@/components/trades/CloseTradeReviewDialog";
import { useUnjournaledClosedTrades } from "@/hooks/use-executed-trades";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountMode, ExecutedTrade } from "@/types/trading";

/**
 * Phase 18.8: a polite, dismissible reminder for closed trades that
 * haven't been journaled yet. Mounts on the Journal page above the
 * Open Trades panel. Clicking "Add review" on a row opens
 * CloseTradeReviewDialog in journalOnly mode so the user can
 * backfill ratings + lesson_learned + mistake tags without re-closing
 * the trade.
 *
 * Renders nothing when the unjournaled list is empty so it cannot
 * become an annoying always-on banner. Collapses by default once
 * there are more than 3 entries to avoid pushing the rest of the
 * journal page off-screen.
 */
interface Props {
  /** Mode filter from the Journal page; undefined = all. */
  mode?: AccountMode;
}

export default function UnjournaledTradesReminder({ mode }: Props) {
  const { data: trades = [], isLoading } = useUnjournaledClosedTrades(mode);
  const [selected, setSelected] = useState<ExecutedTrade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }
  if (trades.length === 0 || dismissed) return null;

  const visible = expanded ? trades : trades.slice(0, 3);
  const hiddenCount = trades.length - visible.length;

  const openReview = (trade: ExecutedTrade) => {
    setSelected(trade);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="rounded-lg border border-warning/30 bg-warning/[0.06]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-warning/20">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">
              Unjournaled trades
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {trades.length} closed{" "}
              {trades.length === 1 ? "trade has" : "trades have"} no review yet
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
        <ul className="divide-y divide-warning/15">
          {visible.map((trade) => (
            <li
              key={trade.id}
              className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
            >
              <span className="font-medium text-foreground min-w-[72px]">
                {trade.symbol}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  trade.direction === "long" ? "text-bullish" : "text-bearish"
                }`}
              >
                {trade.direction === "long" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {trade.direction}
              </span>
              <AccountModeBadge mode={trade.account_mode as AccountMode} />
              {trade.signal_id && (
                <Link2
                  className="h-3 w-3 text-primary"
                  aria-label="Linked to AI signal"
                />
              )}
              <span
                className={`text-[11px] font-mono ${
                  trade.result_status === "win"
                    ? "text-bullish"
                    : trade.result_status === "loss"
                    ? "text-bearish"
                    : "text-muted-foreground"
                }`}
              >
                {trade.result_status}
                {trade.pnl != null
                  ? ` · ${Number(trade.pnl) >= 0 ? "+" : ""}$${Math.abs(
                      Number(trade.pnl),
                    ).toFixed(2)}`
                  : ""}
              </span>
              <span className="text-[10px] text-muted-foreground">
                closed{" "}
                {trade.closed_at
                  ? formatDistanceToNow(new Date(trade.closed_at), {
                      addSuffix: true,
                    })
                  : "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs ml-auto"
                onClick={() => openReview(trade)}
              >
                Add review
              </Button>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <button
            type="button"
            className="w-full px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-warning/15 flex items-center justify-center gap-1"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className="h-3 w-3" />
            Show {hiddenCount} more
          </button>
        )}
        {expanded && trades.length > 3 && (
          <button
            type="button"
            className="w-full px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-warning/15 flex items-center justify-center gap-1"
            onClick={() => setExpanded(false)}
          >
            <ChevronUp className="h-3 w-3" />
            Collapse
          </button>
        )}
      </div>

      <CloseTradeReviewDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setSelected(null);
        }}
        trade={selected}
        journalOnly
      />
    </>
  );
}

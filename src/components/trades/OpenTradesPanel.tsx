import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Link2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import CloseTradeReviewDialog from "@/components/trades/CloseTradeReviewDialog";
import { useOpenExecutedTrades } from "@/hooks/use-executed-trades";
import { formatDistanceToNow } from "date-fns";
import type { AccountMode, ExecutedTrade } from "@/types/trading";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Phase 18.4: the "Open Trades" card rendered on the Journal page
 * above the journal table. Lists executed_trades with result_status
 * = 'open' and exposes the Close & Review action. Filtered by the
 * user's active demo/real mode filter so it never silently mixes
 * demo and real positions.
 */
interface Props {
  /** Mode filter from the Journal page; undefined = show all. */
  mode?: AccountMode;
}

export default function OpenTradesPanel({ mode }: Props) {
  const { data: openTrades = [], isLoading } = useOpenExecutedTrades(mode);
  const [selected, setSelected] = useState<ExecutedTrade | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (openTrades.length === 0) return null;

  const openClose = (trade: ExecutedTrade) => {
    setSelected(trade);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/[0.03]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/20">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Open Trades</h2>
            <span className="text-[10px] text-muted-foreground">
              {openTrades.length} {openTrades.length === 1 ? "position" : "positions"}
            </span>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {openTrades.map((trade) => (
            <li
              key={trade.id}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
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
              <span className="text-xs font-mono text-muted-foreground">
                @ {trade.actual_entry_price}
              </span>
              {trade.lot_size != null && (
                <span className="text-[10px] text-muted-foreground">
                  {Number(trade.lot_size)} lot
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(trade.opened_at), { addSuffix: true })}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs ml-auto"
                onClick={() => openClose(trade)}
              >
                Close
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <CloseTradeReviewDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setSelected(null);
        }}
        trade={selected}
      />
    </>
  );
}

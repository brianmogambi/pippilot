import { ArrowUpRight, ArrowDownRight, Ban } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import { formatDistanceToNow } from "date-fns";
import type { EnrichedSignal } from "@/pages/Signals";

function computeRRFallback(entry: number, sl: number, tp1: number): number {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return Math.round((Math.abs(tp1 - entry) / risk) * 100) / 100;
}

export default function SignalCard({ signal }: { signal: EnrichedSignal }) {
  const isLong = signal.direction === "long";
  const isNoTrade = signal.verdict === "no_trade";
  const quality = signal.analysis?.setupQuality ?? null;
  const rr = signal.riskReward ?? computeRRFallback(signal.entry_price, signal.stop_loss, signal.take_profit_1);

  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{signal.pair}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{signal.timeframe}</span>
        </div>
        <div className="flex items-center gap-2">
          {quality && (
            <StatusBadge variant={quality === "A+" || quality === "A" ? "bullish" : quality === "B" ? "neutral" : "bearish"}>
              {quality}
            </StatusBadge>
          )}
          {isNoTrade ? (
            <span className="flex items-center gap-1 text-xs font-medium text-warning">
              <Ban className="h-3 w-3" /> No Trade
            </span>
          ) : (
            <span className={`flex items-center gap-1 text-xs font-medium ${isLong ? "text-bullish" : "text-bearish"}`}>
              {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {isLong ? "Long" : "Short"}
            </span>
          )}
        </div>
      </div>

      {/* Setup type */}
      {signal.setup_type && (
        <p className="text-[11px] text-muted-foreground mb-2">{signal.setup_type}</p>
      )}

      {/* Price levels */}
      <div className="grid grid-cols-4 gap-2 text-xs mb-3">
        <div>
          <span className="text-muted-foreground">Entry</span>
          <p className="text-foreground font-mono">{signal.entry_price}</p>
        </div>
        <div>
          <span className="text-muted-foreground">SL</span>
          <p className="text-bearish font-mono">{signal.stop_loss}</p>
        </div>
        <div>
          <span className="text-muted-foreground">TP1</span>
          <p className="text-bullish font-mono">{signal.take_profit_1}</p>
        </div>
        <div>
          <span className="text-muted-foreground">R:R</span>
          <p className="text-foreground font-mono">{rr}R</p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge
            variant={
              signal.status === "active" ? "active"
              : signal.status === "triggered" ? "triggered"
              : signal.status === "invalidated" ? "bearish"
              : "expired"
            }
          >
            {signal.status}
          </StatusBadge>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-10 bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${signal.confidence >= 70 ? "bg-bullish" : signal.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{signal.confidence}%</span>
        </div>
      </div>
    </div>
  );
}

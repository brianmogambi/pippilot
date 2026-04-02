import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Ban } from "lucide-react";
import type { Signal } from "@/data/mockSignals";

export default function SignalCard({ signal }: { signal: Signal }) {
  const isLong = signal.direction === "long";
  const isNoTrade = signal.verdict === "no_trade";

  return (
    <Link
      to={`/signals/${signal.id}`}
      className="block rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{signal.pair}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{signal.timeframe}</span>
        </div>
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

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
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
      </div>

      <div className="flex items-center justify-between">
        <div className="w-full bg-muted rounded-full h-1.5 mr-3">
          <div
            className={`h-1.5 rounded-full ${signal.confidence >= 70 ? "bg-bullish" : signal.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{signal.confidence}%</span>
      </div>
    </Link>
  );
}

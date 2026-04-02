import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Ban, Info } from "lucide-react";
import { mockSignals } from "@/data/mockSignals";
import RiskCalculator from "@/components/calculator/RiskCalculator";

export default function SignalDetail() {
  const { id } = useParams();
  const signal = mockSignals.find((s) => s.id === id);

  if (!signal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Signal not found.</p>
        <Link to="/signals" className="text-primary hover:underline text-sm mt-2 inline-block">← Back to signals</Link>
      </div>
    );
  }

  const isLong = signal.direction === "long";
  const isNoTrade = signal.verdict === "no_trade";
  const rrRatio = (Math.abs(signal.take_profit_1 - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)).toFixed(2);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl">
      <Link to="/signals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to signals
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{signal.pair}</h1>
        <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{signal.timeframe}</span>
        {isNoTrade ? (
          <span className="flex items-center gap-1 text-sm font-medium text-warning bg-warning/10 px-2 py-1 rounded">
            <Ban className="h-3 w-3" /> No Trade
          </span>
        ) : (
          <span className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded ${isLong ? "text-bullish bg-bullish/10" : "text-bearish bg-bearish/10"}`}>
            {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {isLong ? "Long" : "Short"}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Chart Placeholder */}
          <div className="rounded-lg border border-border bg-card aspect-video flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chart integration coming soon</p>
            </div>
          </div>

          {/* Price Levels */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground text-sm mb-3">Price Levels</h3>
            <div className="space-y-2">
              {[
                { label: "Entry", value: signal.entry_price, color: "text-foreground" },
                { label: "Stop Loss", value: signal.stop_loss, color: "text-bearish" },
                { label: "Take Profit 1", value: signal.take_profit_1, color: "text-bullish" },
                { label: "Take Profit 2", value: signal.take_profit_2, color: "text-bullish" },
              ].map((level) => (
                <div key={level.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{level.label}</span>
                  <span className={`font-mono text-sm ${level.color}`}>{level.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground">R:R Ratio</span>
                <span className="font-mono text-sm text-primary font-bold">1:{rrRatio}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* AI Reasoning */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">AI Analysis</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{signal.ai_reasoning}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${signal.confidence >= 70 ? "bg-bullish" : signal.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">{signal.confidence}%</span>
            </div>
          </div>

          {/* Risk Calculator */}
          <RiskCalculator defaultEntry={signal.entry_price} defaultSl={signal.stop_loss} />
        </div>
      </div>
    </div>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

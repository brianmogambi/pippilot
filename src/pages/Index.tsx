import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Activity, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { mockSignals, watchlistPairs } from "@/data/mockSignals";
import SignalCard from "@/components/signals/SignalCard";

const Dashboard = () => {
  const activeSignals = mockSignals.filter((s) => s.verdict === "trade" && s.status === "active");
  const avgConfidence = Math.round(activeSignals.reduce((a, s) => a + s.confidence, 0) / (activeSignals.length || 1));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-assisted market analysis overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Signals", value: activeSignals.length, icon: TrendingUp, color: "text-primary" },
          { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Activity, color: "text-bullish" },
          { label: "No-Trade Alerts", value: mockSignals.filter((s) => s.verdict === "no_trade").length, icon: Shield, color: "text-warning" },
          { label: "Watchlist Pairs", value: watchlistPairs.length, icon: Eye, color: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Signals */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Signals</h2>
            <Link to="/signals" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {mockSignals.slice(0, 4).map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Watchlist</h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {watchlistPairs.map((pair) => {
              const signal = mockSignals.find((s) => s.pair === pair);
              return (
                <div key={pair} className="flex items-center justify-between p-3">
                  <span className="text-sm font-medium text-foreground">{pair}</span>
                  {signal ? (
                    <span className={`flex items-center gap-1 text-xs ${signal.direction === "long" ? "text-bullish" : "text-bearish"}`}>
                      {signal.direction === "long" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {signal.entry_price}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No signal</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Risk Disclaimer */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-primary">Remember:</strong> These are AI-generated analysis suggestions, not financial advice. Always use proper risk management and never risk more than you can afford to lose.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

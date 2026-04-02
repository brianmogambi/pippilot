import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Activity, Eye, Wallet, DollarSign, AlertTriangle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { mockSignals, mockAlerts, mockAccountStats, mockJournalEntries, mockMarketSummary } from "@/data/mockSignals";
import SignalCard from "@/components/signals/SignalCard";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";

const Dashboard = () => {
  const activeSignals = mockSignals.filter((s) => s.verdict === "trade" && s.status === "active");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Row 1: Account Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Account Balance"
          value={`$${mockAccountStats.balance.toLocaleString()}`}
          icon={Wallet}
          iconColor="text-primary"
        />
        <StatCard
          label="Equity"
          value={`$${mockAccountStats.equity.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-primary"
          trend={{ value: `$${mockAccountStats.equity - mockAccountStats.balance >= 0 ? "+" : ""}${mockAccountStats.equity - mockAccountStats.balance}`, positive: mockAccountStats.equity >= mockAccountStats.balance }}
        />
        <StatCard
          label="Daily P&L"
          value={`${mockAccountStats.dailyPnL >= 0 ? "+" : ""}$${mockAccountStats.dailyPnL}`}
          icon={TrendingUp}
          iconColor="text-bullish"
          trend={{ value: `${mockAccountStats.dailyPnLPct >= 0 ? "+" : ""}${mockAccountStats.dailyPnLPct}%`, positive: mockAccountStats.dailyPnL >= 0 }}
        />
        <StatCard
          label="Daily Risk Used"
          value={`${mockAccountStats.dailyRiskUsed}%`}
          icon={Shield}
          iconColor={mockAccountStats.dailyRiskUsed > mockAccountStats.maxDailyRisk * 0.8 ? "text-warning" : "text-bullish"}
          trend={{ value: `of ${mockAccountStats.maxDailyRisk}% max`, positive: mockAccountStats.dailyRiskUsed <= mockAccountStats.maxDailyRisk * 0.8 }}
        />
      </div>

      {/* Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Setups + Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Setups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Active Setups</h2>
              <Link to="/signals" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {activeSignals.slice(0, 4).map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </div>

          {/* Latest Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Latest Alerts</h2>
              <Link to="/alerts" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {mockAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{alert.pair}</span>
                    <span className="text-xs text-muted-foreground">{alert.condition}</span>
                  </div>
                  <StatusBadge variant={alert.status}>{alert.status}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Watchlist Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Watchlist</h2>
              <Link to="/watchlist" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {mockMarketSummary.slice(0, 5).map((pair) => (
                <div key={pair.pair} className="flex items-center justify-between p-3">
                  <span className="text-sm font-medium text-foreground">{pair.pair}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{pair.price}</span>
                    <span className={`flex items-center gap-0.5 text-xs ${pair.changePct >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {pair.changePct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {pair.changePct >= 0 ? "+" : ""}{pair.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Journal */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Recent Trades</h2>
              <Link to="/journal" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {mockJournalEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{entry.pair}</span>
                    <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>{entry.direction}</StatusBadge>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${entry.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {entry.pnl >= 0 ? "+" : ""}{entry.pnl}p
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Market Summary */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">Market Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {mockMarketSummary.map((pair) => (
            <div key={pair.pair} className="rounded-lg border border-border bg-card p-3 space-y-1">
              <span className="text-xs text-muted-foreground">{pair.pair}</span>
              <p className="text-sm font-bold font-mono text-foreground">{pair.price}</p>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${pair.changePct >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {pair.changePct >= 0 ? "+" : ""}{pair.changePct.toFixed(2)}%
                </span>
                <StatusBadge variant={pair.sentiment}>{pair.sentiment}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed text-center">
          <strong className="text-primary">⚠️ Disclaimer:</strong> PipPilot AI provides AI-assisted analysis only. This is not financial advice. Trading forex and CFDs carries significant risk of loss. Always use proper risk management and never risk more than you can afford to lose.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;

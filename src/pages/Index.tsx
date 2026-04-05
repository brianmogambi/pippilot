import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Wallet, DollarSign, AlertTriangle, BookOpen, Activity, Lightbulb, Eye, BarChart3, Clock, Circle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTradingAccount, useRiskProfile } from "@/hooks/use-account";
import { useActiveSignals } from "@/hooks/use-signals";
import { useDashboardAlerts } from "@/hooks/use-alerts";
import { useDashboardJournal, useDashboardJournalStats } from "@/hooks/use-journal";
import { useDashboardWatchlist } from "@/hooks/use-watchlist";
import { useMarketSummary } from "@/hooks/use-market-data";
import { useDailyRiskUsed } from "@/hooks/use-daily-risk";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const beginnerTips = [
  "A good trade setup needs structure, confirmation, and acceptable risk.",
  "Never risk more than you can afford to lose on a single trade.",
  "Consistency beats intensity — focus on process, not individual outcomes.",
  "Always define your stop loss before entering a trade.",
  "Your journal is your most powerful learning tool. Review it weekly.",
  "Risk-reward ratios above 1:2 give you room to be wrong and still profitable.",
  "The best trade is sometimes no trade at all — patience pays.",
];

const SectionHeader = ({ title, linkTo, linkText = "View all →" }: { title: string; linkTo: string; linkText?: string }) => (
  <div className="flex items-center justify-between">
    <h2 className="font-semibold text-foreground">{title}</h2>
    <Link to={linkTo} className="text-xs text-primary hover:underline">{linkText}</Link>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { data: account, isLoading: loadingAccount } = useTradingAccount();
  const { data: riskProfile } = useRiskProfile();
  const { data: signals = [], isLoading: loadingSignals } = useActiveSignals(6);
  const { data: alerts = [] } = useDashboardAlerts(5);
  const { data: journalEntries = [] } = useDashboardJournal(3);
  const { data: journalStats } = useDashboardJournalStats();
  const { data: watchlist = [] } = useDashboardWatchlist(6);
  const marketSummary = useMarketSummary();
  const [tipDismissed, setTipDismissed] = useState(false);

  const isLoading = loadingAccount || loadingSignals;

  const balance = Number(account?.balance ?? 10000);
  const equity = Number(account?.equity ?? 10000);
  const dailyPnL = equity - balance;
  const maxDailyRisk = riskProfile?.max_daily_loss_pct ?? 5;
  const { riskUsedPct } = useDailyRiskUsed();
  const riskUsed = Math.round(riskUsedPct * 10) / 10;
  const riskRemaining = Math.max(0, Number(maxDailyRisk) - riskUsed);
  const todayTip = beginnerTips[new Date().getDate() % beginnerTips.length];

  const marketLookup = Object.fromEntries(marketSummary.map((m) => [m.pair, m]));
  const watchPairs = watchlist.length > 0
    ? watchlist.map((w) => ({ ...(marketLookup[w.pair] ?? {}), pair: w.pair }))
    : marketSummary.slice(0, 5).map((m) => ({ ...m }));

  const signalPairs = new Set(signals.map((s) => s.pair));

  const getVolatility = (changePct: number | undefined) => {
    if (changePct === undefined) return "N/A";
    const abs = Math.abs(changePct);
    if (abs >= 0.3) return "High";
    if (abs >= 0.15) return "Med";
    return "Low";
  };

  const severityIcon = (severity: string) => {
    if (severity === "critical") return "text-bearish";
    if (severity === "warning") return "text-warning";
    return "text-primary";
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-lg" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav">
      {/* 1. Account Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Balance" value={`$${balance.toLocaleString()}`} icon={Wallet} iconColor="text-primary" />
        <StatCard
          label="Equity"
          value={`$${equity.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-primary"
          trend={{ value: `${dailyPnL >= 0 ? "+" : ""}$${dailyPnL.toLocaleString()}`, positive: dailyPnL >= 0 }}
        />
        <StatCard
          label="Daily P/L"
          value={`${dailyPnL >= 0 ? "+" : ""}$${dailyPnL.toLocaleString()}`}
          icon={BarChart3}
          iconColor={dailyPnL >= 0 ? "text-bullish" : "text-bearish"}
          variant={dailyPnL >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Risk Used Today"
          value={`${riskUsed}%`}
          icon={Activity}
          iconColor="text-bullish"
          variant="default"
          trend={{ value: `of ${maxDailyRisk}% max`, positive: true }}
        />
        <StatCard
          label="Risk Remaining"
          value={`${riskRemaining}%`}
          icon={Shield}
          iconColor={riskRemaining <= 1 ? "text-bearish" : "text-warning"}
          variant={riskRemaining <= 1 ? "danger" : riskRemaining <= 2 ? "warning" : "default"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3. Active Trade Ideas */}
          <div className="space-y-3">
            <SectionHeader title="Active Trade Ideas" linkTo="/signals" />
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {signals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                        <th className="text-left p-3 font-medium">Pair</th>
                        <th className="text-left p-3 font-medium">Dir</th>
                        <th className="text-left p-3 font-medium hidden sm:table-cell">Setup</th>
                        <th className="text-right p-3 font-medium">Entry</th>
                        <th className="text-right p-3 font-medium">SL</th>
                        <th className="text-right p-3 font-medium hidden sm:table-cell">TP1</th>
                        <th className="text-right p-3 font-medium">Conf</th>
                        <th className="text-right p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {signals.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium text-foreground">
                            <Link to={`/signals/${s.id}`} className="hover:text-primary">{s.pair}</Link>
                          </td>
                          <td className="p-3">
                            <span className={`flex items-center gap-1 text-xs font-medium ${s.direction === "long" ? "text-bullish" : "text-bearish"}`}>
                              {s.direction === "long" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {s.direction === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden sm:table-cell">{s.setup_type ?? "—"}</td>
                          <td className="p-3 text-right font-mono text-foreground">{s.entry_price}</td>
                          <td className="p-3 text-right font-mono text-bearish">{s.stop_loss}</td>
                          <td className="p-3 text-right font-mono text-bullish hidden sm:table-cell">{s.take_profit_1}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${s.confidence >= 70 ? "bg-bullish" : s.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
                                  style={{ width: `${s.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{s.confidence}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <StatusBadge variant={s.verdict === "no_trade" ? "no_trade" : s.status === "active" ? "active" : "neutral"}>
                              {s.verdict === "no_trade" ? "no trade" : s.status}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No active trade ideas. Check back soon.</div>
              )}
            </div>
          </div>

          {/* 4. Alerts Feed */}
          <div className="space-y-3">
            <SectionHeader title="Alerts" linkTo="/alerts" />
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severityIcon(alert.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!alert.is_read && <Circle className="h-2 w-2 fill-primary text-primary shrink-0" />}
                      <span className={`text-sm font-medium truncate ${!alert.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {alert.title ?? alert.pair}
                      </span>
                      <StatusBadge variant={alert.severity === "critical" ? "bearish" : alert.severity === "warning" ? "pending" : "neutral"} className="shrink-0">
                        {alert.severity}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.message ?? alert.condition}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                </div>
              )) : (
                <div className="p-8 text-center text-sm text-muted-foreground">All clear — no alerts.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* 2. Market Watch Summary */}
          <div className="space-y-3">
            <SectionHeader title="Market Watch" linkTo="/watchlist" />
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {watchPairs.map((wp: any) => {
                const market = marketLookup[wp.pair];
                const changePct = market?.changePct;
                const volatility = getVolatility(changePct);
                const hasSignal = signalPairs.has(wp.pair);
                return (
                  <div key={wp.pair} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{wp.pair}</span>
                      <span className="text-sm font-mono text-muted-foreground">{market?.price ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {changePct !== undefined && (
                        <StatusBadge variant={changePct >= 0 ? "bullish" : "bearish"}>
                          {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                        </StatusBadge>
                      )}
                      {market?.sentiment && (
                        <StatusBadge variant={market.sentiment}>{market.sentiment}</StatusBadge>
                      )}
                      <StatusBadge variant={volatility === "High" ? "bearish" : volatility === "Med" ? "pending" : "neutral"}>
                        {volatility} vol
                      </StatusBadge>
                      {hasSignal && <StatusBadge variant="active">Signal</StatusBadge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Journal Snapshot */}
          <div className="space-y-3">
            <SectionHeader title="Journal Snapshot" linkTo="/journal" />
            {journalStats && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{journalStats.total}</p>
                  <span className="text-[10px] text-muted-foreground">Total</span>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                  <p className="text-lg font-bold text-foreground">{journalStats.winRate}%</p>
                  <span className="text-[10px] text-muted-foreground">Win Rate</span>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                  <p className={`text-lg font-bold ${journalStats.avgPL >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {journalStats.avgPL >= 0 ? "+" : ""}{journalStats.avgPL}p
                  </p>
                  <span className="text-[10px] text-muted-foreground">Avg P/L</span>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {journalEntries.length > 0 ? journalEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{entry.pair}</span>
                    <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>{entry.direction}</StatusBadge>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${(Number(entry.result_pips) ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {entry.result_pips != null ? `${Number(entry.result_pips) >= 0 ? "+" : ""}${entry.result_pips}p` : "open"}
                  </span>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground">Start logging trades to track your performance.</div>
              )}
            </div>
          </div>

          {/* 6. Beginner Insight Card */}
          {!tipDismissed && (
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 relative">
              <button onClick={() => setTipDismissed(true)} className="absolute top-2 right-2 p-1 rounded hover:bg-primary/10 transition-colors">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/15 p-2 shrink-0">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Trading Tip</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{todayTip}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer — subtle footer */}
      <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
        ⚠️ PipPilot AI provides AI-assisted analysis only — not financial advice. Trading carries significant risk.
      </p>
    </div>
  );
};

export default Dashboard;

import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Activity, Eye, Wallet, DollarSign, AlertTriangle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mockMarketSummary } from "@/data/mockSignals";
import SignalCard from "@/components/signals/SignalCard";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";

const Dashboard = () => {
  const { user } = useAuth();

  const { data: account } = useQuery({
    queryKey: ["trading-account", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("trading_accounts").select("*").eq("is_default", true).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: riskProfile } = useQuery({
    queryKey: ["risk-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_risk_profiles").select("*").maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: signals = [] } = useQuery({
    queryKey: ["signals"],
    queryFn: async () => {
      const { data } = await supabase.from("signals").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(4);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: journalEntries = [] } = useQuery({
    queryKey: ["dashboard-journal", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("trade_journal_entries").select("*").order("created_at", { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  const balance = account?.balance ?? 10000;
  const equity = account?.equity ?? 10000;
  const maxDailyRisk = riskProfile?.max_daily_loss_pct ?? 5;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Row 1: Account Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Account Balance" value={`$${Number(balance).toLocaleString()}`} icon={Wallet} iconColor="text-primary" />
        <StatCard
          label="Equity"
          value={`$${Number(equity).toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-primary"
          trend={{ value: `$${Number(equity) - Number(balance) >= 0 ? "+" : ""}${Number(equity) - Number(balance)}`, positive: Number(equity) >= Number(balance) }}
        />
        <StatCard label="Risk/Trade" value={`${riskProfile?.risk_per_trade_pct ?? 1}%`} icon={TrendingUp} iconColor="text-bullish" />
        <StatCard
          label="Max Daily Loss"
          value={`${maxDailyRisk}%`}
          icon={Shield}
          iconColor="text-warning"
          trend={{ value: riskProfile?.conservative_mode ? "Conservative" : "Standard", positive: true }}
        />
      </div>

      {/* Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Setups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Active Setups</h2>
              <Link to="/signals" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            {signals.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {signals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal as any} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No active signals</div>
            )}
          </div>

          {/* Latest Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Latest Alerts</h2>
              <Link to="/alerts" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{alert.title ?? alert.pair}</span>
                    <span className="text-xs text-muted-foreground">{alert.message ?? alert.condition}</span>
                  </div>
                  <StatusBadge variant={alert.status}>{alert.status}</StatusBadge>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No alerts</div>
              )}
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
              {journalEntries.length > 0 ? journalEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{entry.pair}</span>
                    <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>{entry.direction}</StatusBadge>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${(entry.result_pips ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {entry.result_pips != null ? `${entry.result_pips >= 0 ? "+" : ""}${entry.result_pips}p` : "open"}
                  </span>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground">No trades yet</div>
              )}
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

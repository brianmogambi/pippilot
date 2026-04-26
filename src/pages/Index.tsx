import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Wallet, AlertTriangle, BookOpen, Activity, Lightbulb, BarChart3, Clock, Circle, X, Zap, ChevronDown, ChevronUp, Calculator, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTradingAccount,
  useTradingAccounts,
  useRiskProfile,
  useDefaultAccountMode,
  useUpdateTradingAccount,
} from "@/hooks/use-account";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import WelcomeStrip from "@/components/dashboard/WelcomeStrip";
import { useEnrichedActiveSignals, useSignalFreshness } from "@/hooks/use-signals";
import { useDashboardAlerts } from "@/hooks/use-alerts";
import { useDashboardJournal, useDashboardJournalStats } from "@/hooks/use-journal";
import { useRecentLessons } from "@/hooks/use-trade-analyses";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import { useDashboardWatchlist } from "@/hooks/use-watchlist";
import { useMarketSummary, useAllMarketData } from "@/hooks/use-market-data";
import { useRefreshMarketData } from "@/hooks/use-refresh-market-data";
import { useDailyRiskUsed } from "@/hooks/use-daily-risk";
import StatusBadge, { FreshnessBadge } from "@/components/ui/status-badge";
import { RefreshButton } from "@/components/ui/refresh-button";
import { freshnessOf, type Freshness } from "@/lib/data-freshness";
import {
  getSignalAge,
  getPrimaryRisk,
  getAccountSuitability,
  getPotentialLoss,
} from "@/lib/signal-presentation";
import { TermTooltip } from "@/components/ui/term-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { AccountMode, EnrichedSignal } from "@/types/trading";

const beginnerTips = [
  "A good trade setup needs structure, confirmation, and acceptable risk.",
  "Never risk more than you can afford to lose on a single trade.",
  "Consistency beats intensity — focus on process, not individual outcomes.",
  "Always define your stop loss before entering a trade.",
  "Your journal is your most powerful learning tool. Review it weekly.",
  "Risk-reward ratios above 1:2 give you room to be wrong and still profitable.",
  "The best trade is sometimes no trade at all — patience pays.",
];

// ── Top Trade Hero Card ────────────────────────────────────────

function TopTradeCard({
  signal,
  balance,
  riskPct,
}: {
  signal: EnrichedSignal;
  balance: number;
  riskPct: number;
}) {
  const navigate = useNavigate();
  const isLong = signal.direction === "long";
  const quality = signal.analysis?.setupQuality ?? null;
  const rr = signal.riskReward;

  // Phase 1 (improvement plan): trust signals derived from the
  // already-persisted analysis fields. Heuristics live in the pure
  // signal-presentation module so they stay testable and consistent
  // across surfaces.
  const age = getSignalAge(signal);
  const suitability = getAccountSuitability(signal);
  const primaryRisk = getPrimaryRisk(signal);
  const potentialLoss = getPotentialLoss(balance, riskPct);

  return (
    <Link
      to={`/signals/${signal.id}`}
      className="block rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card to-card p-4 hover:border-primary/60 transition-all"
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Top Trade Idea</span>
        {quality && (
          <StatusBadge variant={quality === "A+" || quality === "A" ? "bullish" : "neutral"}>
            {quality}
          </StatusBadge>
        )}
        {age.staleness !== "fresh" && (
          <StatusBadge
            variant={age.staleness === "stale" ? "bearish" : "pending"}
            title={`Generated ${age.label} — market conditions may have shifted.`}
          >
            {age.staleness === "stale" ? "Stale" : "Aging"}
          </StatusBadge>
        )}
        <span className="text-[10px] text-muted-foreground">{age.label}</span>
        {suitability.level === "real" && (
          <StatusBadge variant="bullish" title={suitability.reason}>
            Real-account suitable
          </StatusBadge>
        )}
        {suitability.level === "demo_only" && (
          <StatusBadge variant="pending" title={suitability.reason}>
            Demo only
          </StatusBadge>
        )}
        {suitability.level === "no_trade" && (
          <StatusBadge variant="bearish" title={suitability.reason}>
            No trade
          </StatusBadge>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-foreground">{signal.pair}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{signal.timeframe}</span>
          <span className={`flex items-center gap-1 text-sm font-semibold ${isLong ? "text-bullish" : "text-bearish"}`}>
            {isLong ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {isLong ? "Long" : "Short"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {signal.setup_type}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Entry</p>
          <p className="text-sm font-mono font-semibold text-foreground">{signal.entry_price}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">
            <TermTooltip term="stop_loss">Stop Loss</TermTooltip>
          </p>
          <p className="text-sm font-mono font-semibold text-bearish">{signal.stop_loss}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">
            <TermTooltip term="take_profit">TP1</TermTooltip>
          </p>
          <p className="text-sm font-mono font-semibold text-bullish">{signal.take_profit_1}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">
            <TermTooltip term="risk_reward">R:R</TermTooltip>
          </p>
          <p className="text-sm font-mono font-semibold text-primary">{rr.toFixed(2)}R</p>
        </div>
      </div>

      {primaryRisk && (
        <div className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/20 bg-warning/[0.06] px-2.5 py-1.5">
          <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-snug">
            <span className="font-medium text-warning">Could fail if: </span>
            {primaryRisk}
          </p>
        </div>
      )}

      {/* Phase 4 (improvement plan): stale-signal banner — flags
          signals >6h old so a beginner doesn't act on a setup whose
          market context has already shifted. */}
      {age.staleness === "stale" && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-bearish/30 bg-bearish/[0.06] px-2.5 py-1.5">
          <AlertTriangle className="h-3 w-3 text-bearish mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-snug">
            <span className="font-medium text-bearish">Stale signal: </span>
            generated {age.label} — market conditions may have shifted. Re-check the chart before acting.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-20 bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${signal.confidence >= 70 ? "bg-bullish" : signal.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {signal.confidence}% <TermTooltip term="confidence">confidence</TermTooltip>
          </span>
        </div>
        {potentialLoss && (
          <span className="text-[11px] text-muted-foreground">
            ≈ <span className="font-mono font-semibold text-foreground">${potentialLoss.riskUsd.toFixed(0)}</span> at <TermTooltip term="risk_pct">risk</TermTooltip> ({potentialLoss.pctOfAccount}%)
          </span>
        )}
        {/* Phase 4: shortcut to calculator pre-filled with this trade's
            pair/entry/SL so the user can play with sizing without
            re-typing it. Rendered as a button (not <Link>) to avoid
            nested anchors — the card root already wraps everything in
            a <Link>, so we navigate programmatically on click. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(
              `/calculator?pair=${encodeURIComponent(signal.pair)}&entry=${signal.entry_price}&sl=${signal.stop_loss}`,
            );
          }}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <Calculator className="h-3 w-3" /> Calculate lot size
        </button>
        <span className="text-xs text-primary font-medium">View details →</span>
      </div>
    </Link>
  );
}

// ── Account Switcher (Phase 4) ─────────────────────────────────

function AccountSwitcher({ mode }: { mode: AccountMode }) {
  const { data: accounts = [] } = useTradingAccounts();
  const updateAccount = useUpdateTradingAccount();
  const [open, setOpen] = useState(false);

  // Switch the user's default account by un-flagging the current
  // default and flagging the new one. Two sequential updates rather
  // than a transaction — the hook invalidates the relevant queries
  // so the UI reflects the change as soon as both calls land.
  const handleSwitch = async (targetId: string) => {
    const current = accounts.find((a) => a.is_default);
    if (current?.id === targetId) {
      setOpen(false);
      return;
    }
    if (current) {
      await updateAccount.mutateAsync({ id: current.id, payload: { is_default: false } });
    }
    await updateAccount.mutateAsync({ id: targetId, payload: { is_default: true } });
    setOpen(false);
  };

  // Single-account users: badge stays static (nothing to switch to).
  if (accounts.length <= 1) {
    return <AccountModeBadge mode={mode} size="md" className="shrink-0" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-md hover:ring-1 hover:ring-primary/30 transition"
          aria-label="Switch default account"
        >
          <AccountModeBadge mode={mode} size="md" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
          Switch default account
        </p>
        <div className="space-y-1">
          {accounts.map((a) => {
            const isCurrent = a.is_default;
            const accMode: AccountMode = (a.account_mode as AccountMode) ?? "demo";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSwitch(a.id)}
                disabled={updateAccount.isPending}
                className={`w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60 ${
                  isCurrent ? "bg-muted/40" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AccountModeBadge mode={accMode} size="sm" />
                  <span className="truncate text-foreground">{a.account_name}</span>
                </div>
                {isCurrent && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Compact Account Bar ────────────────────────────────────────

function AccountBar({
  balance, equity, riskUsed, riskRemaining, maxDailyRisk, accountMode,
}: {
  balance: number;
  equity: number;
  riskUsed: number;
  riskRemaining: number;
  maxDailyRisk: number;
  accountMode: AccountMode;
}) {
  const dailyPnL = equity - balance;
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 text-sm overflow-x-auto">
      {/* Phase 18.8: mode badge anchors the bar so the trader always
          sees at a glance whether they are looking at demo or real.
          Phase 4: clickable when the user has multiple accounts. */}
      <AccountSwitcher mode={accountMode} />
      <div className="flex items-center gap-1.5 shrink-0">
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Bal</span>
        <span className="font-semibold text-foreground">${balance.toLocaleString()}</span>
      </div>
      <div className="h-4 w-px bg-border shrink-0" />
      <div className="flex items-center gap-1.5 shrink-0">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">P/L</span>
        <span className={`font-semibold ${dailyPnL >= 0 ? "text-bullish" : "text-bearish"}`}>
          {dailyPnL >= 0 ? "+" : ""}${dailyPnL.toLocaleString()}
        </span>
      </div>
      <div className="h-4 w-px bg-border shrink-0" />
      <div className="flex items-center gap-1.5 shrink-0">
        <Shield className={`h-3.5 w-3.5 ${riskRemaining <= 1 ? "text-bearish" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground">
          <TermTooltip term="risk_pct">Risk</TermTooltip>
        </span>
        <span className={`font-semibold ${riskRemaining <= 1 ? "text-bearish" : riskRemaining <= 2 ? "text-warning" : "text-foreground"}`}>
          {riskUsed}%
        </span>
        <span className="text-muted-foreground text-xs">/ {maxDailyRisk}%</span>
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────

const SectionHeader = ({ title, linkTo, linkText = "View all →", extra }: {
  title: string; linkTo: string; linkText?: string; extra?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {extra}
    </div>
    <Link to={linkTo} className="text-xs text-primary hover:underline">{linkText}</Link>
  </div>
);

// ── Main Dashboard ─────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const { data: account, isLoading: loadingAccount } = useTradingAccount();
  const { data: riskProfile } = useRiskProfile();
  // Phase 18.2: scope the dashboard journal panel to the user's default
  // account mode so demo and real performance are never silently mixed.
  const defaultMode = useDefaultAccountMode();
  const { enriched: signals, isLoading: loadingSignals } = useEnrichedActiveSignals(8);
  const { data: alerts = [] } = useDashboardAlerts(5);
  const { data: journalEntries = [] } = useDashboardJournal(3, defaultMode);
  const { data: journalStats } = useDashboardJournalStats(defaultMode);
  // Phase 5 (improvement plan): last 3 distinct improvement actions
  // surfaced from the post-trade rule engine. Mode-scoped so demo
  // lessons don't leak into a real-account dashboard view.
  const { data: recentLessons } = useRecentLessons(defaultMode, 3);
  const { data: watchlist = [] } = useDashboardWatchlist(6);
  const marketSummary = useMarketSummary();
  const { data: marketDataMap } = useAllMarketData();
  const refreshMarketData = useRefreshMarketData();
  const { freshness: signalFreshness, ageLabel: signalAge } = useSignalFreshness();
  const { riskUsedPct } = useDailyRiskUsed();
  const [tipDismissed, setTipDismissed] = useState(false);
  // Phase 4 (improvement plan): journal stats are too valuable to
  // hide behind a chevron. Default expanded; user can collapse.
  const [journalExpanded, setJournalExpanded] = useState(true);

  const isLoading = loadingAccount || loadingSignals;

  const hasAccount = account && Number(account.balance) > 0;
  const balance = Number(account?.balance ?? 0);
  const equity = Number(account?.equity ?? 0);
  const riskPerTradePct = Number(riskProfile?.risk_per_trade_pct ?? 1);
  const maxDailyRisk = riskProfile?.max_daily_loss_pct ?? 5;
  const riskUsed = Math.round(riskUsedPct * 10) / 10;
  const riskRemaining = Math.max(0, Number(maxDailyRisk) - riskUsed);
  const todayTip = beginnerTips[new Date().getDate() % beginnerTips.length];

  const topTrade = signals.length > 0 ? signals[0] : null;
  const remainingSignals = signals.slice(1);

  const marketLookup = Object.fromEntries(marketSummary.map((m) => [m.pair, m]));
  const watchPairs = watchlist.map((w) => ({
    ...(marketLookup[w.pair] ?? {}),
    pair: w.pair,
  }));

  const watchFreshnesses: Freshness[] = watchPairs.map((wp) =>
    freshnessOf(marketDataMap?.[wp.pair]?.updatedAt, !!marketDataMap?.[wp.pair]),
  );
  const headerFreshness: Freshness | null = watchFreshnesses.length === 0
    ? null
    : watchFreshnesses.includes("fallback")
    ? "fallback"
    : watchFreshnesses.includes("cached")
    ? "cached"
    : "live";

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
      <div className="p-4 md:p-6 lg:p-8 space-y-4 pb-mobile-nav">
        <Skeleton className="h-11 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-64 rounded-lg" /></div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 pb-mobile-nav">
      {/* 1. Compact account bar */}
      {hasAccount ? (
        <AccountBar
          balance={balance}
          equity={equity}
          riskUsed={riskUsed}
          riskRemaining={riskRemaining}
          maxDailyRisk={maxDailyRisk}
          accountMode={defaultMode}
        />
      ) : (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <Wallet className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            <Link to="/settings" className="text-primary hover:underline font-medium">Set up your account</Link> to see balance and risk data.
          </p>
        </div>
      )}

      {/* Phase 4 (improvement plan): "what to do today" 4-step strip
          for first-time / beginner users. Dismissable per session. */}
      <WelcomeStrip />

      {/* 2. Top Trade Hero */}
      {topTrade ? (
        <TopTradeCard signal={topTrade} balance={balance} riskPct={riskPerTradePct} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No active trade ideas right now.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Signals are generated automatically — check back soon.</p>
        </div>
      )}

      {/* 3. Main content grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: Signals table + Alerts */}
        <div className="lg:col-span-2 space-y-4">
          {/* More Trade Ideas */}
          {remainingSignals.length > 0 && (
            <div className="space-y-2">
              <SectionHeader
                title="More Trade Ideas"
                linkTo="/signals"
                extra={
                  <>
                    <FreshnessBadge
                      freshness={signalFreshness}
                      title={
                        signalFreshness === "live"
                          ? `Updated ${signalAge}`
                          : signalFreshness === "cached"
                          ? `Stale — ${signalAge}`
                          : "No signals yet"
                      }
                    />
                    {signalFreshness !== "live" && signalAge !== "No signals yet" && (
                      <span className="text-[10px] text-muted-foreground">{signalAge}</span>
                    )}
                  </>
                }
              />
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                        <th className="text-left p-2.5 font-medium">Pair</th>
                        <th className="text-left p-2.5 font-medium">Dir</th>
                        <th className="text-left p-2.5 font-medium hidden sm:table-cell">Quality</th>
                        <th className="text-right p-2.5 font-medium">Entry</th>
                        <th className="text-right p-2.5 font-medium hidden sm:table-cell">R:R</th>
                        <th className="text-right p-2.5 font-medium">Conf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {remainingSignals.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-medium text-foreground">
                            <Link to={`/signals/${s.id}`} className="hover:text-primary">{s.pair}</Link>
                          </td>
                          <td className="p-2.5">
                            <span className={`flex items-center gap-1 text-xs font-medium ${s.direction === "long" ? "text-bullish" : "text-bearish"}`}>
                              {s.direction === "long" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {s.direction === "long" ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="p-2.5 hidden sm:table-cell">
                            {s.analysis?.setupQuality ? (
                              <StatusBadge variant={s.analysis.setupQuality === "A+" || s.analysis.setupQuality === "A" ? "bullish" : s.analysis.setupQuality === "B" ? "neutral" : "bearish"}>
                                {s.analysis.setupQuality}
                              </StatusBadge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono text-foreground">{s.entry_price}</td>
                          <td className="p-2.5 text-right font-mono text-primary hidden sm:table-cell">{s.riskReward.toFixed(2)}R</td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-10 bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${s.confidence >= 70 ? "bg-bullish" : s.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
                                  style={{ width: `${s.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-7 text-right">{s.confidence}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Alerts */}
          <div className="space-y-2">
            <SectionHeader title="Alerts" linkTo="/alerts" />
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-2.5">
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
                <div className="p-6 text-center text-sm text-muted-foreground">All clear — no alerts.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Market Watch */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Market Watch</h2>
                {headerFreshness && (
                  <FreshnessBadge
                    freshness={headerFreshness}
                    title={
                      headerFreshness === "live"
                        ? "All visible pairs updated within the last 10 minutes"
                        : headerFreshness === "cached"
                        ? "At least one pair is older than 10 minutes"
                        : "At least one pair has no live data yet"
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-3">
                <RefreshButton
                  onClick={() => refreshMarketData.mutate()}
                  isPending={refreshMarketData.isPending}
                  title="Fetch the latest forex prices now"
                />
                <Link to="/watchlist" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {watchPairs.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Add pairs to your watchlist to see market data here.
                </div>
              )}
              {watchPairs.map((wp) => {
                const market = marketLookup[wp.pair];
                const liveRow = marketDataMap?.[wp.pair];
                const rowFreshness = freshnessOf(liveRow?.updatedAt, !!liveRow);
                const changePct = market?.changePct;
                const volatility = getVolatility(changePct);
                const hasSignal = signalPairs.has(wp.pair);
                return (
                  <div key={wp.pair} className="p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{wp.pair}</span>
                      <div className="flex items-center gap-2">
                        {rowFreshness !== "live" && (
                          <FreshnessBadge
                            freshness={rowFreshness}
                            title={
                              rowFreshness === "fallback"
                                ? "No live data yet"
                                : liveRow?.updatedAt
                                ? `Updated ${formatDistanceToNow(new Date(liveRow.updatedAt), { addSuffix: true })}`
                                : "Cached"
                            }
                          />
                        )}
                        <span className="text-sm font-mono text-muted-foreground">{market?.price ?? "—"}</span>
                      </div>
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

          {/* Collapsible Journal + Tip */}
          <div className="space-y-2">
            <button
              onClick={() => setJournalExpanded(!journalExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Journal & Tips</h2>
                <AccountModeBadge mode={defaultMode} />
              </div>
              {journalExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </button>

            {journalExpanded && (
              <div className="space-y-3">
                {/* Journal stats */}
                {journalStats && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-card p-2 text-center">
                      <p className="text-base font-bold text-foreground">{journalStats.total}</p>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2 text-center">
                      <p className="text-base font-bold text-foreground">{journalStats.winRate}%</p>
                      <span className="text-[10px] text-muted-foreground">Win Rate</span>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2 text-center">
                      <p className={`text-base font-bold ${journalStats.avgPL >= 0 ? "text-bullish" : "text-bearish"}`}>
                        {journalStats.avgPL >= 0 ? "+" : ""}{journalStats.avgPL}p
                      </p>
                      <span className="text-[10px] text-muted-foreground">Avg P/L</span>
                    </div>
                  </div>
                )}

                {/* Recent journal entries */}
                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {journalEntries.length > 0 ? journalEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-2.5">
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
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <Link to="/journal" className="text-primary hover:underline">Start logging trades</Link> to track performance.
                    </div>
                  )}
                </div>

                {/* Phase 5 (improvement plan): Recent lessons —
                    distinct improvement actions surfaced from
                    trade_analyses on this user's recent trades.
                    Empty state hidden so the panel doesn't grow with
                    a placeholder when no analysis exists yet. */}
                {recentLessons && recentLessons.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <Lightbulb className="h-3 w-3 text-primary" />
                      Recent lessons
                    </div>
                    <ul className="space-y-1.5">
                      {recentLessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-start gap-1.5">
                          <span className="text-muted-foreground/50 mt-0.5">•</span>
                          <p className="text-xs text-muted-foreground leading-snug">
                            {lesson.pair && (
                              <span className="font-medium text-foreground">{lesson.pair}: </span>
                            )}
                            {lesson.action}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tip */}
                {!tipDismissed && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 relative">
                    <button onClick={() => setTipDismissed(true)} className="absolute top-2 right-2 p-1 rounded hover:bg-primary/10 transition-colors">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed pr-4">{todayTip}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
        PipPilot AI provides AI-assisted analysis only — not financial advice. Trading carries significant risk.
      </p>
    </div>
  );
};

export default Dashboard;

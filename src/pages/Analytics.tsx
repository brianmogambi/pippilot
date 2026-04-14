import { useMemo, useState } from "react";
import {
  BarChart3,
  Trophy,
  Activity,
  Target,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Wallet,
} from "lucide-react";
import { useTradeAnalytics } from "@/hooks/use-trade-analytics";
import StatCard from "@/components/ui/stat-card";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AccountMode } from "@/types/trading";
import type {
  BreakdownBar,
  TradeAnalyticsFilters,
  TradeAnalyticsSummary,
} from "@/lib/trade-analytics";

/**
 * Phase 18.7: dedicated Analytics page.
 *
 * Conceptually distinct from the Phase 11 signal analytics in
 * src/lib/analytics/ — that module reports on signal-level outcomes
 * (did the signal hit TP/SL in the market). This page reports on
 * trade-level outcomes (did the user make money). Both views are
 * useful and never silently merged.
 */

/**
 * Phase 18.8: collapsed all the analytics filter axes into one
 * 5-option segmented control as the spec requested. Each slice is
 * mutually exclusive with the others — picking "Demo" implicitly
 * means "any source", picking "Linked AI" implicitly means "any
 * mode". Users who want both axes simultaneously can drill in via
 * the Journal page filters; this page is for the quick scan.
 */
type AnalyticsSlice = "all" | "demo" | "real" | "linked" | "manual";

const SLICE_OPTIONS: ReadonlyArray<{
  value: AnalyticsSlice;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "demo", label: "Demo" },
  { value: "real", label: "Real" },
  { value: "linked", label: "Linked to AI" },
  { value: "manual", label: "Manual" },
];

function sliceToFilters(slice: AnalyticsSlice): TradeAnalyticsFilters {
  switch (slice) {
    case "demo":
      return { mode: "demo" };
    case "real":
      return { mode: "real" };
    case "linked":
      return { source: "linked" };
    case "manual":
      return { source: "manual" };
    case "all":
    default:
      return {};
  }
}

export default function Analytics() {
  const [slice, setSlice] = useState<AnalyticsSlice>("all");

  const filters: TradeAnalyticsFilters = useMemo(
    () => sliceToFilters(slice),
    [slice],
  );

  const { breakdown, isLoading, isError } = useTradeAnalytics(filters);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav">
        <PageHeader />
        <SliceFilter slice={slice} onChange={setSlice} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load analytics"
          description="Check your connection and refresh the page."
        />
      </div>
    );
  }

  const { summary, byMode, bySource, byOutcome, topMistakeTags, signalVsExecutionMatrix } =
    breakdown;
  const hasAnyTrades = summary.totalTrades > 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav max-w-6xl">
      <PageHeader />
      <SliceFilter slice={slice} onChange={setSlice} />

      {!hasAnyTrades ? (
        <EmptyState
          icon={BarChart3}
          title="No trades yet"
          description="Open a trade from a signal or log a manual trade. As you close trades, this page fills in with execution + signal-quality metrics."
        />
      ) : (
        <>
          {/* Headline stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total trades"
              value={String(summary.totalTrades)}
              icon={BarChart3}
              iconColor="text-primary"
            />
            <StatCard
              label="Win rate"
              value={`${summary.winRate}%`}
              icon={Trophy}
              iconColor="text-bullish"
              trend={
                summary.closedTrades > 0
                  ? {
                      value: `${summary.wins}W / ${summary.losses}L`,
                      positive: summary.winRate >= 50,
                    }
                  : undefined
              }
            />
            <StatCard
              label="Avg entry drift"
              value={
                summary.avgEntryDriftPips != null
                  ? `${summary.avgEntryDriftPips.toFixed(1)} pips`
                  : "—"
              }
              icon={Target}
              iconColor="text-warning"
            />
            <StatCard
              label="Plan adherence"
              value={
                summary.planAdherenceRate != null
                  ? `${Math.round(summary.planAdherenceRate * 100)}%`
                  : "—"
              }
              icon={CheckCircle2}
              iconColor="text-bullish"
            />
          </div>

          {/* Mode + source breakdowns */}
          <div className="grid lg:grid-cols-2 gap-4">
            <SplitCard
              title="Demo vs Real"
              icon={Wallet}
              left={{
                label: "demo",
                modeBadge: "demo",
                summary: byMode.demo,
              }}
              right={{
                label: "real",
                modeBadge: "real",
                summary: byMode.real,
              }}
            />
            <SplitCard
              title="Linked AI vs Manual"
              icon={Link2}
              left={{
                label: "linked",
                summary: bySource.linked,
              }}
              right={{
                label: "manual",
                summary: bySource.manual,
              }}
            />
          </div>

          {/* Outcome breakdown bars */}
          <BreakdownCard
            title="Outcome breakdown"
            icon={Activity}
            bars={byOutcome}
            emptyText="No closed trades yet."
          />

          {/* Top mistake tags */}
          <BreakdownCard
            title="Top mistake tags"
            icon={AlertTriangle}
            bars={topMistakeTags}
            emptyText="No mistake tags reported yet — keep journaling."
          />

          {/* Signal vs execution quadrant */}
          <SignalVsExecutionQuadrant matrix={signalVsExecutionMatrix} />
        </>
      )}
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
      <p className="text-sm text-muted-foreground mt-1">
        How did your <em>execution</em> measure up to the signals you took? Demo and
        real are kept separate by default.
      </p>
    </div>
  );
}

/**
 * Phase 18.8 quick-filter pill bar. Five mutually-exclusive slices,
 * single click to switch. Matches the shape the spec asked for and
 * is far less ambiguous than two coupled dropdowns.
 */
function SliceFilter({
  slice,
  onChange,
}: {
  slice: AnalyticsSlice;
  onChange: (s: AnalyticsSlice) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Analytics slice"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {SLICE_OPTIONS.map((opt) => {
        const active = slice === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SplitCard({
  title,
  icon: Icon,
  left,
  right,
}: {
  title: string;
  icon: typeof BarChart3;
  left: { label: string; summary: TradeAnalyticsSummary; modeBadge?: AccountMode };
  right: { label: string; summary: TradeAnalyticsSummary; modeBadge?: AccountMode };
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <SplitColumn data={left} />
        <SplitColumn data={right} />
      </div>
    </div>
  );
}

function SplitColumn({
  data,
}: {
  data: {
    label: string;
    summary: TradeAnalyticsSummary;
    modeBadge?: AccountMode;
  };
}) {
  const s = data.summary;
  const empty = s.totalTrades === 0;
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        {data.modeBadge ? (
          <AccountModeBadge mode={data.modeBadge} />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {data.label}
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground">No trades</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-foreground">{s.winRate}%</span>
            <span className="text-xs text-muted-foreground">win rate</span>
          </div>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>{s.totalTrades} trades</span>
              <span>
                {s.wins}W / {s.losses}L
                {s.breakevens > 0 ? ` / ${s.breakevens}BE` : ""}
              </span>
            </div>
            {s.totalPnlUsd != null && (
              <div className="flex justify-between">
                <span>P&L</span>
                <span
                  className={
                    s.totalPnlUsd >= 0
                      ? "text-bullish font-mono"
                      : "text-bearish font-mono"
                  }
                >
                  {s.totalPnlUsd >= 0 ? "+" : ""}${s.totalPnlUsd.toFixed(2)}
                </span>
              </div>
            )}
            {s.avgExecutionQuality != null && (
              <div className="flex justify-between">
                <span>Avg exec quality</span>
                <span className="text-foreground">
                  {Math.round(s.avgExecutionQuality)}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownCard({
  title,
  icon: Icon,
  bars,
  emptyText,
}: {
  title: string;
  icon: typeof BarChart3;
  bars: BreakdownBar[];
  emptyText: string;
}) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">
        {bars.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2.5">
            {bars.map((b) => (
              <li key={b.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{b.label}</span>
                  <span className="text-muted-foreground font-mono">
                    {b.count}
                    {b.winRate > 0 ? ` · ${b.winRate}% win` : ""}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${(b.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SignalVsExecutionQuadrant({
  matrix,
}: {
  matrix: {
    highSignalHighExec: number;
    highSignalLowExec: number;
    lowSignalHighExec: number;
    lowSignalLowExec: number;
  };
}) {
  const total =
    matrix.highSignalHighExec +
    matrix.highSignalLowExec +
    matrix.lowSignalHighExec +
    matrix.lowSignalLowExec;
  const cells = [
    {
      key: "hh",
      title: "High signal · High execution",
      hint: "Clean wins — replicate.",
      count: matrix.highSignalHighExec,
      tone: "border-bullish/30 bg-bullish/10 text-bullish",
    },
    {
      key: "hl",
      title: "High signal · Low execution",
      hint: "Good signals you sabotaged. Highest leverage area.",
      count: matrix.highSignalLowExec,
      tone: "border-bearish/30 bg-bearish/10 text-bearish",
    },
    {
      key: "lh",
      title: "Low signal · High execution",
      hint: "You executed weak signals well — but the edge wasn't there.",
      count: matrix.lowSignalHighExec,
      tone: "border-warning/30 bg-warning/10 text-warning",
    },
    {
      key: "ll",
      title: "Low signal · Low execution",
      hint: "Avoid — neither the signal nor the execution worked.",
      count: matrix.lowSignalLowExec,
      tone: "border-muted-foreground/20 bg-muted/30 text-muted-foreground",
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Signal quality vs execution quality
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {total} scored trade{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-4">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">
            No scored trades yet. Close a signal-linked trade to populate this matrix.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {cells.map((c) => (
              <div
                key={c.key}
                className={`rounded-lg border p-3 space-y-1 ${c.tone}`}
              >
                <div className="text-2xl font-bold font-mono">{c.count}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                  {c.title}
                </div>
                <div className="text-[10px] opacity-75 leading-snug">{c.hint}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

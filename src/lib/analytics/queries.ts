// Phase 11: Analytics query layer.
//
// Pure functions that take a `SupabaseClient` and return rows in the
// `SignalWithOutcome` shape consumed by the analytics service. The
// adapters here are intentionally narrow — they map DB column names
// (snake_case) to the camelCase fields the existing pure backtest types
// expect, so `computeMetrics()` and `analyze()` work over both backtest
// and live signal sources without any schema changes.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BacktestSignalRow,
  ResolvedOutcome,
  SignalWithOutcome,
} from "../backtest/types";

// ── Internal raw row shapes ───────────────────────────────────────
// We use `any` casts at the supabase boundary because the generated
// `Database` type in `src/integrations/supabase/types.ts` has not yet
// been regenerated to include Phase 10 backtest tables. The shapes below
// are the contract this module enforces against the DB.

interface BacktestSignalDbRow {
  id: string;
  pair: string;
  timeframe: string;
  direction: "long" | "short";
  setup_type: string;
  setup_quality: string | null;
  verdict: string | null;
  confidence: number | null;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  risk_reward: number | null;
  cursor_time: string;
  reasons_for: string[];
  reasons_against: string[];
  invalidation: string | null;
}

interface LiveSignalDbRow {
  id: string;
  pair: string;
  timeframe: string;
  direction: string;
  setup_type: string | null;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  risk_reward: number | null;
  verdict: string;
  invalidation_reason: string | null;
  created_at: string;
}

interface SignalOutcomeDbRow {
  id: string;
  backtest_signal_id: string | null;
  live_signal_id: string | null;
  outcome: string;
  entry_hit_at: string | null;
  resolved_at: string;
  bars_to_resolution: number;
  exit_price: number | null;
  r_multiple: number | null;
  pips_result: number | null;
  resolution_path: unknown;
}

const KNOWN_OUTCOME_KINDS = new Set([
  "entry_hit",
  "tp1_hit",
  "tp2_hit",
  "tp3_hit",
  "sl_hit",
  "invalidated",
  "expired",
  "no_entry",
]);

// ── Public types ──────────────────────────────────────────────────

export interface LiveSignalFilters {
  /** ISO timestamp — only include live signals created at or after this. */
  since: string;
  /** ISO timestamp — only include live signals created before this. */
  until?: string;
  pairs?: string[];
  timeframes?: string[];
  setupTypes?: string[];
}

/**
 * Journal-derived outcome row. The trade journal table does not store
 * setup_type or confidence, so journal analytics is necessarily a much
 * thinner shape than `SignalWithOutcome` — keep it separate.
 */
export interface JournalOutcome {
  pair: string;
  direction: "long" | "short";
  openedAt: string;
  closedAt: string | null;
  resultPips: number | null;
  resultAmount: number | null;
  status: "open" | "closed";
}

// ── Backtest source ───────────────────────────────────────────────

/**
 * Load every signal generated for a backtest run together with its
 * resolved outcome row. Returns items in cursor order.
 */
export async function fetchBacktestSignalsWithOutcomes(
  client: SupabaseClient,
  runId: string,
): Promise<SignalWithOutcome[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;

  const { data: signals, error: signalsErr } = await sb
    .from("backtest_signals")
    .select("*")
    .eq("run_id", runId)
    .order("cursor_time", { ascending: true });
  if (signalsErr) throw signalsErr;
  const signalRows = (signals ?? []) as BacktestSignalDbRow[];
  if (signalRows.length === 0) return [];

  const ids = signalRows.map((s) => s.id);
  const { data: outcomes, error: outcomesErr } = await sb
    .from("signal_outcomes")
    .select("*")
    .in("backtest_signal_id", ids);
  if (outcomesErr) throw outcomesErr;
  const outcomeRows = (outcomes ?? []) as SignalOutcomeDbRow[];

  const outcomeBySignal = new Map<string, SignalOutcomeDbRow>();
  for (const o of outcomeRows) {
    if (o.backtest_signal_id) outcomeBySignal.set(o.backtest_signal_id, o);
  }

  const items: SignalWithOutcome[] = [];
  for (const s of signalRows) {
    const o = outcomeBySignal.get(s.id);
    if (!o) continue; // unresolved — analytics ignores
    items.push({
      signal: backtestRowToSignal(s),
      outcome: outcomeRowToResolved(o),
    });
  }
  return items;
}

// ── Live signal source ────────────────────────────────────────────

/**
 * Load resolved live signals (those with a `signal_outcomes` row joined
 * via `live_signal_id`) in the analytics window. Live signals without an
 * outcome row are skipped — they're still in flight and will be picked
 * up after the next `resolve-live-outcomes` run.
 */
export async function fetchLiveSignalsWithOutcomes(
  client: SupabaseClient,
  filters: LiveSignalFilters,
): Promise<SignalWithOutcome[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;

  let query = sb
    .from("signals")
    .select("*")
    .gte("created_at", filters.since)
    .order("created_at", { ascending: true });

  if (filters.until) query = query.lt("created_at", filters.until);
  if (filters.pairs && filters.pairs.length > 0) query = query.in("pair", filters.pairs);
  if (filters.timeframes && filters.timeframes.length > 0) query = query.in("timeframe", filters.timeframes);
  if (filters.setupTypes && filters.setupTypes.length > 0) query = query.in("setup_type", filters.setupTypes);

  const { data: signals, error } = await query;
  if (error) throw error;
  const signalRows = (signals ?? []) as LiveSignalDbRow[];
  if (signalRows.length === 0) return [];

  const ids = signalRows.map((s) => s.id);
  const { data: outcomes, error: outcomesErr } = await sb
    .from("signal_outcomes")
    .select("*")
    .in("live_signal_id", ids);
  if (outcomesErr) throw outcomesErr;
  const outcomeRows = (outcomes ?? []) as SignalOutcomeDbRow[];

  const outcomeBySignal = new Map<string, SignalOutcomeDbRow>();
  for (const o of outcomeRows) {
    if (o.live_signal_id) outcomeBySignal.set(o.live_signal_id, o);
  }

  const items: SignalWithOutcome[] = [];
  for (const s of signalRows) {
    const o = outcomeBySignal.get(s.id);
    if (!o) continue;
    items.push({
      signal: liveRowToSignal(s),
      outcome: outcomeRowToResolved(o),
    });
  }
  return items;
}

// ── Journal source ────────────────────────────────────────────────

export async function fetchJournalOutcomes(
  client: SupabaseClient,
  userId: string,
  range: { since: string; until?: string },
): Promise<JournalOutcome[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;

  let query = sb
    .from("trade_journal_entries")
    .select("pair, direction, opened_at, closed_at, result_pips, result_amount, status")
    .eq("user_id", userId)
    .gte("opened_at", range.since)
    .order("opened_at", { ascending: true });
  if (range.until) query = query.lt("opened_at", range.until);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    pair: string;
    direction: string;
    opened_at: string;
    closed_at: string | null;
    result_pips: number | null;
    result_amount: number | null;
    status: string;
  }>;

  return rows.map((r) => ({
    pair: r.pair,
    direction: normalizeDirection(r.direction),
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    resultPips: r.result_pips,
    resultAmount: r.result_amount,
    status: r.status === "closed" ? "closed" : "open",
  }));
}

// ── Adapters ──────────────────────────────────────────────────────

export function backtestRowToSignal(r: BacktestSignalDbRow): BacktestSignalRow {
  return {
    pair: r.pair,
    timeframe: r.timeframe,
    direction: r.direction,
    setupType: r.setup_type,
    setupQuality: r.setup_quality,
    verdict: r.verdict === "trade" ? "trade" : "no_trade",
    confidence: Number(r.confidence ?? 0),
    entryPrice: Number(r.entry_price),
    stopLoss: Number(r.stop_loss),
    tp1: Number(r.take_profit_1),
    tp2: Number(r.take_profit_2 ?? r.take_profit_1),
    tp3: Number(r.take_profit_3 ?? r.take_profit_2 ?? r.take_profit_1),
    riskReward: Number(r.risk_reward ?? 0),
    cursorTime: r.cursor_time,
    reasonsFor: r.reasons_for ?? [],
    reasonsAgainst: r.reasons_against ?? [],
    invalidation: r.invalidation ?? "",
  };
}

export function liveRowToSignal(r: LiveSignalDbRow): BacktestSignalRow {
  return {
    pair: r.pair,
    timeframe: r.timeframe,
    direction: normalizeDirection(r.direction),
    setupType: r.setup_type ?? "unknown",
    setupQuality: null,
    verdict: r.verdict === "trade" ? "trade" : "no_trade",
    confidence: Number(r.confidence),
    entryPrice: Number(r.entry_price),
    stopLoss: Number(r.stop_loss),
    tp1: Number(r.take_profit_1),
    tp2: Number(r.take_profit_2 ?? r.take_profit_1),
    tp3: Number(r.take_profit_3 ?? r.take_profit_2 ?? r.take_profit_1),
    riskReward: Number(r.risk_reward ?? 0),
    // The live source has no `cursor_time`; use `created_at` so the
    // chronological sort in metrics/equity-curve still works.
    cursorTime: r.created_at,
    reasonsFor: [],
    reasonsAgainst: [],
    invalidation: r.invalidation_reason ?? "",
  };
}

export function outcomeRowToResolved(r: SignalOutcomeDbRow): ResolvedOutcome {
  const kind = KNOWN_OUTCOME_KINDS.has(r.outcome)
    ? (r.outcome as ResolvedOutcome["kind"])
    : "no_entry";
  const path = Array.isArray(r.resolution_path)
    ? (r.resolution_path as ResolvedOutcome["path"])
    : [];
  return {
    kind,
    entryHitAt: r.entry_hit_at,
    resolvedAt: r.resolved_at,
    barsToResolution: r.bars_to_resolution,
    exitPrice: r.exit_price != null ? Number(r.exit_price) : null,
    rMultiple: r.r_multiple != null ? Number(r.r_multiple) : null,
    pipsResult: r.pips_result != null ? Number(r.pips_result) : null,
    path,
  };
}

/**
 * The DB stores live signal direction as either "long"/"short" (engine
 * output) or — in some legacy admin paths — "buy"/"sell". Normalize so
 * the resolver always sees long/short.
 */
function normalizeDirection(d: string): "long" | "short" {
  if (d === "long" || d === "buy") return "long";
  return "short";
}

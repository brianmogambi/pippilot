// supabase/functions/run-backtest/index.ts
//
// Phase 10: Historical replay engine.
//
// Reads ohlcv_candles for a configured date range and pair set, walks a
// cursor across the base timeframe, calls the deterministic signal engine
// at each step using ONLY data sliced at or before the cursor (no
// lookahead bias), resolves outcomes against forward candles, and
// persists the run / signals / outcomes / aggregated metrics.
//
// Invocation:
//   POST /run-backtest
//   body: { label?: string, config: BacktestConfig }
//
// See BACKTEST_ENGINE.md for full schema, rules, and limitations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  analyzeForSignal,
  type OHLCV,
  type SignalOutput,
  type TimeframeData,
} from "../_shared/signal-engine.ts";
import { pipMultiplier } from "../_shared/pip-value.ts";
import { runReplayForPair, type EngineFn, type EngineDecision } from "../_shared/backtest/replay-loop.ts";
import { computeMetrics } from "../_shared/backtest/metrics.ts";
import type {
  BacktestCandle,
  BacktestConfig,
  PairCandleSet,
  SignalWithOutcome,
} from "../_shared/backtest/types.ts";

// ── Engine version (audit trail) ────────────────────────────────

// We store a short marker so backtest_runs can be filtered when the
// signal engine is updated. A real content-hash would require reading
// the .ts file at runtime; the date-based tag is good enough for v1.
const SIGNAL_ENGINE_VERSION = "phase10-2026-04-14";

// ── DB row → BacktestCandle adapter ─────────────────────────────

interface DbCandleRow {
  symbol: string;
  timeframe: "1h" | "4h" | "1d";
  candle_time: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
}

function dbRowToCandle(row: DbCandleRow): BacktestCandle {
  return {
    time: row.candle_time,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
  };
}

// BacktestCandle → engine OHLCV (engine uses `datetime` field name).
function toEngineOHLCV(c: BacktestCandle): OHLCV {
  return {
    datetime: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

// ── Session helper (matches generate-signals/index.ts) ──────────

function getActiveSession(hour: number): boolean {
  return hour >= 7 && hour < 21;
}

// ── Pip size for resolver pips_result ───────────────────────────

function pipSizeForPair(pair: string): number {
  // pipMultiplier returns 100 for JPY pairs, 10000 otherwise.
  // pipSize = 1 / pipMultiplier. Note: XAU/USD uses the forex default
  // here (0.0001). pips_result for gold is therefore approximate; not
  // material for v1 since metrics are R-based, not pip-based.
  return 1 / pipMultiplier(pair);
}

// ── Signal engine adapter ───────────────────────────────────────

function makeEngineFn(): EngineFn {
  return (pair, sliced, cursorISO) => {
    const tfData: TimeframeData = {
      h1: sliced.h1.map(toEngineOHLCV),
      h4: sliced.h4.map(toEngineOHLCV),
      d1: sliced.d1.map(toEngineOHLCV),
    };
    const cursorHour = new Date(cursorISO).getUTCHours();
    const isSession = getActiveSession(cursorHour);
    const result: SignalOutput | null = analyzeForSignal(pair, tfData, isSession);
    if (!result) return null;

    const decision: EngineDecision = {
      pair: result.pair,
      timeframe: result.timeframe,
      direction: result.direction,
      setupType: result.setupType,
      setupQuality: result.setupQuality,
      verdict: result.verdict,
      confidence: result.confidence,
      entryPrice: result.entryPrice,
      stopLoss: result.stopLoss,
      tp1: result.tp1,
      tp2: result.tp2,
      tp3: result.tp3,
      riskReward: result.riskReward,
      reasonsFor: result.reasonsFor,
      reasonsAgainst: result.reasonsAgainst,
      invalidation: result.invalidation,
    };
    return decision;
  };
}

// ── Candle loader ───────────────────────────────────────────────

async function loadCandlesForPair(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pair: string,
  startDate: string,
  endDate: string,
): Promise<PairCandleSet> {
  const result: PairCandleSet = { h1: [], h4: [], d1: [] };
  const timeframes: Array<"1h" | "4h" | "1d"> = ["1h", "4h", "1d"];
  for (const tf of timeframes) {
    const { data, error } = await supabase
      .from("ohlcv_candles")
      .select("symbol, timeframe, candle_time, open, high, low, close")
      .eq("symbol", pair)
      .eq("timeframe", tf)
      .gte("candle_time", startDate)
      .lte("candle_time", endDate)
      .order("candle_time", { ascending: true });
    if (error) {
      console.error(`loadCandles ${pair} ${tf}:`, error.message);
      continue;
    }
    const rows = (data ?? []) as DbCandleRow[];
    result[tf === "1h" ? "h1" : tf === "4h" ? "h4" : "d1"] = rows.map(dbRowToCandle);
  }
  return result;
}

// ── Persistence helpers ─────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function insertSignalsAndOutcomes(supabase: any, runId: string, items: SignalWithOutcome[]) {
  if (items.length === 0) return;

  // Insert backtest_signals first to get IDs.
  const signalRows = items.map((it) => ({
    run_id: runId,
    pair: it.signal.pair,
    timeframe: it.signal.timeframe,
    direction: it.signal.direction,
    setup_type: it.signal.setupType,
    setup_quality: it.signal.setupQuality,
    verdict: it.signal.verdict,
    confidence: it.signal.confidence,
    entry_price: it.signal.entryPrice,
    stop_loss: it.signal.stopLoss,
    take_profit_1: it.signal.tp1,
    take_profit_2: it.signal.tp2,
    take_profit_3: it.signal.tp3,
    risk_reward: it.signal.riskReward,
    cursor_time: it.signal.cursorTime,
    reasons_for: it.signal.reasonsFor,
    reasons_against: it.signal.reasonsAgainst,
    invalidation: it.signal.invalidation,
    raw_output: it.signal,
  }));

  const BATCH = 200;
  // Insert in batches; collect IDs in order.
  const insertedIds: string[] = [];
  for (let i = 0; i < signalRows.length; i += BATCH) {
    const batch = signalRows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("backtest_signals")
      .insert(batch)
      .select("id");
    if (error) {
      console.error("backtest_signals insert error:", error.message);
      throw new Error(`backtest_signals insert failed: ${error.message}`);
    }
    for (const row of data ?? []) insertedIds.push(row.id);
  }

  if (insertedIds.length !== items.length) {
    throw new Error(
      `backtest_signals insert mismatch: expected ${items.length}, got ${insertedIds.length}`,
    );
  }

  // Insert outcomes one-to-one with the signals.
  const outcomeRows = items.map((it, i) => ({
    backtest_signal_id: insertedIds[i],
    live_signal_id: null,
    outcome: it.outcome.kind,
    entry_hit_at: it.outcome.entryHitAt,
    resolved_at: it.outcome.resolvedAt,
    bars_to_resolution: it.outcome.barsToResolution,
    exit_price: it.outcome.exitPrice,
    r_multiple: it.outcome.rMultiple,
    pips_result: it.outcome.pipsResult,
    resolution_path: it.outcome.path,
  }));

  for (let i = 0; i < outcomeRows.length; i += BATCH) {
    const batch = outcomeRows.slice(i, i + BATCH);
    const { error } = await supabase.from("signal_outcomes").insert(batch);
    if (error) {
      console.error("signal_outcomes insert error:", error.message);
      throw new Error(`signal_outcomes insert failed: ${error.message}`);
    }
  }
}

// deno-lint-ignore no-explicit-any
async function insertResults(supabase: any, runId: string, items: SignalWithOutcome[]) {
  const m = computeMetrics(items);
  const row = {
    run_id: runId,
    total_signals: m.totalSignals,
    total_trades: m.totalTrades,
    wins: m.wins,
    losses: m.losses,
    win_rate: m.winRate,
    avg_r: m.avgR,
    expectancy_r: m.expectancyR,
    max_drawdown_r: m.maxDrawdownR,
    profit_factor: m.profitFactor,
    breakdown_by_pair: m.breakdownByPair,
    breakdown_by_setup: m.breakdownBySetup,
    breakdown_by_timeframe: m.breakdownByTimeframe,
  };
  const { error } = await supabase.from("backtest_results").insert(row);
  if (error) {
    console.error("backtest_results insert error:", error.message);
    throw new Error(`backtest_results insert failed: ${error.message}`);
  }
  return m;
}

// ── Config validation ──────────────────────────────────────────

function validateConfig(config: unknown): BacktestConfig {
  if (!config || typeof config !== "object") throw new Error("config required");
  const c = config as Record<string, unknown>;
  const required = [
    "startDate", "endDate", "pairs", "timeframes",
    "setupTypesEnabled", "baseTimeframe", "maxHoldingBars",
    "startingBalance", "riskPerTradePct",
  ];
  for (const k of required) {
    if (!(k in c)) throw new Error(`config.${k} required`);
  }
  if (!Array.isArray(c.pairs) || c.pairs.length === 0) throw new Error("config.pairs must be non-empty");
  if (c.baseTimeframe !== "1h" && c.baseTimeframe !== "4h") {
    throw new Error("config.baseTimeframe must be '1h' or '4h'");
  }
  if (Date.parse(c.startDate as string) >= Date.parse(c.endDate as string)) {
    throw new Error("config.startDate must be before config.endDate");
  }
  return c as unknown as BacktestConfig;
}

// ── HTTP handler ───────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing supabase env" }), { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { label?: string; config?: unknown };
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: "invalid JSON" }), { status: 400 });
  }

  let config: BacktestConfig;
  try {
    config = validateConfig(body.config);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400 });
  }

  const startedAt = new Date();

  // Insert run row in 'running' state.
  const { data: runData, error: runErr } = await supabase
    .from("backtest_runs")
    .insert({
      label: body.label ?? null,
      status: "running",
      config,
      started_at: startedAt.toISOString(),
      signal_engine_version: SIGNAL_ENGINE_VERSION,
    })
    .select("id")
    .single();

  if (runErr || !runData) {
    return new Response(
      JSON.stringify({ error: `failed to create run: ${runErr?.message ?? "unknown"}` }),
      { status: 500 },
    );
  }
  const runId = runData.id as string;

  try {
    const engineFn = makeEngineFn();
    const allItems: SignalWithOutcome[] = [];

    for (const pair of config.pairs) {
      const candles = await loadCandlesForPair(supabase, pair, config.startDate, config.endDate);
      if (candles.h1.length === 0 && candles.h4.length === 0 && candles.d1.length === 0) {
        console.warn(`No candles for ${pair} in range — skipping`);
        continue;
      }
      const result = runReplayForPair(
        { pair, candles, pipSize: pipSizeForPair(pair) },
        {
          baseTimeframe: config.baseTimeframe,
          startDate: config.startDate,
          endDate: config.endDate,
          maxHoldingBars: config.maxHoldingBars,
        },
        engineFn,
      );
      allItems.push(...result.items);
    }

    await insertSignalsAndOutcomes(supabase, runId, allItems);
    const metrics = await insertResults(supabase, runId, allItems);

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    await supabase
      .from("backtest_runs")
      .update({
        status: "success",
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        signals: allItems.length,
        metrics,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const finishedAt = new Date();
    await supabase
      .from("backtest_runs")
      .update({
        status: "failed",
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        error_message: (e as Error).message,
      })
      .eq("id", runId);
    return new Response(
      JSON.stringify({ success: false, run_id: runId, error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

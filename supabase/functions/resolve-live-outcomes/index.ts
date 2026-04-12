// supabase/functions/resolve-live-outcomes/index.ts
//
// Phase 11: Live signal lifecycle resolver.
//
// For every active live signal that does not yet have a `signal_outcomes`
// row, walk forward `ohlcv_candles` from `created_at` and let the existing
// deterministic resolver decide the outcome (TP/SL/expired). Insert a
// `signal_outcomes` row keyed by `live_signal_id` and flip the signal's
// status to `closed`.
//
// Designed to be invoked on a cron schedule (hourly is fine — the inner
// query is bounded). Idempotent: signals that are already resolved or
// still in flight are skipped.
//
// Invocation:
//   POST /resolve-live-outcomes
//   body (optional): { lookbackDays?: number, maxHoldingBars?: number }
//
// Reuses:
//   - resolveOutcome() from _shared/backtest/outcome-resolver.ts
//   - liveRowToResolverSignal / ohlcvRowsToCandles / normalizeTimeframe
//     / pipSizeForPair from _shared/backtest/live-outcome-adapter.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { resolveOutcome } from "../_shared/backtest/outcome-resolver.ts";
import {
  liveRowToResolverSignal,
  normalizeTimeframe,
  ohlcvRowsToCandles,
  pipSizeForPair,
  type LiveSignalRow,
  type OhlcvCandleRow,
} from "../_shared/backtest/live-outcome-adapter.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_HOLDING_BARS = 24;

interface ResolverConfig {
  lookbackDays: number;
  maxHoldingBars: number;
}

interface ResolverSummary {
  considered: number;
  resolved: number;
  stillOpen: number;
  noCandles: number;
  errors: number;
}

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

  let body: { lookbackDays?: number; maxHoldingBars?: number } = {};
  try {
    body = req.headers.get("content-length") === "0" ? {} : await req.json();
  } catch (_e) {
    body = {};
  }

  const config: ResolverConfig = {
    lookbackDays: body.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    maxHoldingBars: body.maxHoldingBars ?? DEFAULT_MAX_HOLDING_BARS,
  };

  const startedAt = new Date();

  // Open a generation_runs row so this is observable alongside generate-signals.
  const { data: runRow } = await supabase
    .from("generation_runs")
    .insert({
      function_name: "resolve-live-outcomes",
      pairs_processed: [],
      started_at: startedAt.toISOString(),
      status: "running",
    })
    .select("id")
    .single();
  const runId: string | null = runRow?.id ?? null;

  let summary: ResolverSummary = { considered: 0, resolved: 0, stillOpen: 0, noCandles: 0, errors: 0 };

  try {
    summary = await resolveAll(supabase, config);

    if (runId) {
      const finished = new Date();
      await supabase
        .from("generation_runs")
        .update({
          finished_at: finished.toISOString(),
          duration_ms: finished.getTime() - startedAt.getTime(),
          status: summary.errors > 0 ? "partial" : "success",
          signals_created: summary.resolved,
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({ success: true, runId, ...summary }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("resolve-live-outcomes error:", err);
    if (runId) {
      const finished = new Date();
      await supabase
        .from("generation_runs")
        .update({
          finished_at: finished.toISOString(),
          duration_ms: finished.getTime() - startedAt.getTime(),
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", runId);
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// ── Core loop ─────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function resolveAll(supabase: any, config: ResolverConfig): Promise<ResolverSummary> {
  const summary: ResolverSummary = { considered: 0, resolved: 0, stillOpen: 0, noCandles: 0, errors: 0 };

  const cutoff = new Date(Date.now() - config.lookbackDays * 86_400_000).toISOString();

  // Pull recent signals that are still actionable. We avoid signals
  // already in `closed` because the outcome would already be recorded.
  const { data: signals, error: signalsErr } = await supabase
    .from("signals")
    .select("id, pair, timeframe, direction, entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, created_at, status, verdict")
    .gte("created_at", cutoff)
    .eq("verdict", "trade")
    .in("status", ["active", "expired", "monitoring"]);

  if (signalsErr) {
    console.error("signals select error:", signalsErr.message);
    throw new Error(signalsErr.message);
  }
  const candidates = (signals ?? []) as Array<LiveSignalRow & { status: string; verdict: string }>;
  if (candidates.length === 0) return summary;

  // Skip ones that already have an outcome row.
  const ids = candidates.map((s) => s.id);
  const { data: existingOutcomes, error: outErr } = await supabase
    .from("signal_outcomes")
    .select("live_signal_id")
    .in("live_signal_id", ids);
  if (outErr) {
    console.error("signal_outcomes select error:", outErr.message);
    throw new Error(outErr.message);
  }
  const alreadyResolved = new Set<string>();
  for (const o of existingOutcomes ?? []) {
    if (o.live_signal_id) alreadyResolved.add(o.live_signal_id);
  }

  for (const sig of candidates) {
    if (alreadyResolved.has(sig.id)) continue;
    summary.considered++;

    try {
      const tf = normalizeTimeframe(sig.timeframe);
      const candleRows = await loadForwardCandles(supabase, sig.pair, tf, sig.created_at);

      if (candleRows.length === 0) {
        summary.noCandles++;
        continue;
      }

      const candles = ohlcvRowsToCandles(candleRows);
      const resolverSignal = liveRowToResolverSignal(sig);
      const outcome = resolveOutcome(resolverSignal, candles, {
        maxBars: config.maxHoldingBars,
        pipSize: pipSizeForPair(sig.pair),
      });

      // If we ran out of candles before the holding window expired, the
      // signal is still in flight (data not yet ingested). Skip — we'll
      // retry on the next run.
      if (
        outcome.kind === "expired" &&
        outcome.barsToResolution < config.maxHoldingBars &&
        candleRows.length < config.maxHoldingBars
      ) {
        summary.stillOpen++;
        continue;
      }

      const insertRow = {
        backtest_signal_id: null,
        live_signal_id: sig.id,
        outcome: outcome.kind,
        entry_hit_at: outcome.entryHitAt,
        resolved_at: outcome.resolvedAt,
        bars_to_resolution: outcome.barsToResolution,
        exit_price: outcome.exitPrice,
        r_multiple: outcome.rMultiple,
        pips_result: outcome.pipsResult,
        resolution_path: outcome.path,
      };

      const { error: insErr } = await supabase.from("signal_outcomes").insert(insertRow);
      if (insErr) {
        console.error(`signal_outcomes insert failed for ${sig.id}:`, insErr.message);
        summary.errors++;
        continue;
      }

      // Flip status to closed so the existing UI lifecycle stays consistent.
      const { error: updErr } = await supabase
        .from("signals")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", sig.id);
      if (updErr) {
        console.error(`signals update failed for ${sig.id}:`, updErr.message);
        // The outcome row is already in — count as resolved but flag.
        summary.errors++;
      }

      summary.resolved++;
    } catch (e) {
      console.error(`resolver loop error for signal ${sig.id}:`, e);
      summary.errors++;
    }
  }

  return summary;
}

// deno-lint-ignore no-explicit-any
async function loadForwardCandles(
  supabase: any,
  pair: string,
  timeframe: "1h" | "4h" | "1d",
  fromIso: string,
): Promise<OhlcvCandleRow[]> {
  const { data, error } = await supabase
    .from("ohlcv_candles")
    .select("candle_time, open, high, low, close")
    .eq("symbol", pair)
    .eq("timeframe", timeframe)
    .gte("candle_time", fromIso)
    .order("candle_time", { ascending: true })
    .limit(200);
  if (error) {
    console.error(`loadForwardCandles ${pair} ${timeframe}:`, error.message);
    return [];
  }
  return (data ?? []) as OhlcvCandleRow[];
}

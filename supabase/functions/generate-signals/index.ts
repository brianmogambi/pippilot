// supabase/functions/generate-signals/index.ts
// Fetches OHLCV data, runs deterministic signal analysis, writes to signals + pair_analyses.
//
// Invoke with batch parameter to stay within Edge Function time limits:
//   ?batch=0  → pairs 0-1   (EUR/USD, GBP/USD)
//   ?batch=1  → pairs 2-3   (USD/JPY, AUD/USD)
//   ?batch=2  → pairs 4-5   (USD/CAD, NZD/USD)
//   ?batch=3  → pairs 6-7   (EUR/GBP, GBP/JPY)
//   ?batch=4  → pairs 8-9   (EUR/JPY, AUD/JPY)
//   ?batch=5  → pairs 10-11 (CHF/JPY, EUR/AUD)
//   ?batch=6  → pairs 12-13 (GBP/AUD, EUR/CAD)
//   ?batch=7  → pairs 14-15 (USD/CHF, XAU/USD)
//   No batch  → all pairs (requires longer runtime, may timeout)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { analyzeForSignal, computeIndicators, type OHLCV, type TimeframeData, type SignalOutput, type TimeframeIndicators } from "../_shared/signal-engine.ts";
import { generateExplanation, PROMPT_VERSION, type ExplanationInputs } from "../_shared/explanation-service.ts";

const TWELVE_DATA_BASE = "https://api.twelvedata.com";

const ALL_SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY",
  "CHF/JPY", "EUR/AUD", "GBP/AUD", "EUR/CAD", "USD/CHF",
  "XAU/USD",
];

const PAIRS_PER_BATCH = 2;

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

function getActiveSession(hour: number): boolean {
  return (hour >= 7 && hour < 21);
}

function parseCandles(values: TwelveDataCandle[]): OHLCV[] {
  return values
    .map((v) => ({
      datetime: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
    .reverse();
}

async function fetchTimeSeries(
  symbol: string,
  interval: string,
  outputsize: number,
  apiKey: string,
): Promise<OHLCV[] | null> {
  const url = `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Twelve Data error for ${symbol} ${interval}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data.code || !data.values) {
      console.error(`Twelve Data API error for ${symbol} ${interval}:`, data.message ?? data.code);
      return null;
    }
    return parseCandles(data.values);
  } catch (err) {
    console.error(`Fetch failed for ${symbol} ${interval}:`, err);
    return null;
  }
}

// Fetch OHLCV for a set of symbols across 3 timeframes.
// 4 pairs × 3 TFs = 12 requests. At 8 credits/min, needs 2 batches with 1 wait.
async function fetchAllOHLCV(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, OHLCV[] | null>> {
  const BATCH_SIZE = 8;
  const results = new Map<string, OHLCV[] | null>();

  interface Job { symbol: string; interval: string; outputsize: number }
  const jobs: Job[] = [];
  for (const symbol of symbols) {
    jobs.push({ symbol, interval: "1h", outputsize: 200 });
    jobs.push({ symbol, interval: "4h", outputsize: 100 });
    jobs.push({ symbol, interval: "1day", outputsize: 60 });
  }

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 15_000));
    }
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (job) => {
      const key = `${job.symbol}|${job.interval}`;
      const candles = await fetchTimeSeries(job.symbol, job.interval, job.outputsize, apiKey);
      results.set(key, candles);
    });
    await Promise.all(promises);
  }

  return results;
}

// ── Candle persistence helpers ────────────────────────────────

const INTERVAL_TO_TIMEFRAME: Record<string, string> = {
  "1h": "1h",
  "4h": "4h",
  "1day": "1d",
};

function buildCandleRows(
  ohlcvData: Map<string, OHLCV[] | null>,
  symbols: string[],
  fetchedAt: string,
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const symbol of symbols) {
    for (const [interval, tf] of Object.entries(INTERVAL_TO_TIMEFRAME)) {
      const candles = ohlcvData.get(`${symbol}|${interval}`);
      if (!candles) continue;
      for (const c of candles) {
        rows.push({
          symbol,
          timeframe: tf,
          candle_time: c.datetime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: null,
          fetched_at: fetchedAt,
        });
      }
    }
  }
  return rows;
}

function buildIndicatorRows(
  runId: string,
  symbol: string,
  indicators: Record<string, TimeframeIndicators>,
  createdAt: string,
): Array<Record<string, unknown>> {
  return Object.entries(indicators).map(([tf, ind]) => ({
    run_id: runId,
    symbol,
    timeframe: tf,
    price: ind.price,
    ema20: Number.isFinite(ind.ema20) ? ind.ema20 : null,
    ema50: Number.isFinite(ind.ema50) ? ind.ema50 : null,
    ema200: Number.isFinite(ind.ema200) ? ind.ema200 : null,
    rsi14: Number.isFinite(ind.rsi14) ? ind.rsi14 : null,
    atr14: Number.isFinite(ind.atr14) ? ind.atr14 : null,
    macd_hist: Number.isFinite(ind.macdHist) ? ind.macdHist : null,
    bb_upper: Number.isFinite(ind.bbUpper) ? ind.bbUpper : null,
    bb_lower: Number.isFinite(ind.bbLower) ? ind.bbLower : null,
    bb_width: Number.isFinite(ind.bbWidth) ? ind.bbWidth : null,
    trend: ind.trend,
    created_at: createdAt,
  }));
}

// ── AI explanation layer ───────────────────────────────────────
// Owned by `_shared/explanation-service.ts` (Phase 8). The service
// receives an `ExplanationInputs` snapshot + the deterministic
// fallback text and decides whether to use Claude or fall back. It
// NEVER touches scores, confidence, verdict, or numerical outputs.

interface AICounters {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

function buildExplanationInputs(s: SignalOutput): ExplanationInputs {
  return {
    pair: s.pair,
    direction: s.direction,
    setupType: s.setupType,
    timeframe: s.timeframe,
    confidence: s.confidence,
    setupQuality: s.setupQuality,
    verdict: s.verdict,
    entryPrice: s.entryPrice,
    entryZone: s.entryZone,
    stopLoss: s.stopLoss,
    tp1: s.tp1,
    tp2: s.tp2,
    tp3: s.tp3,
    invalidation: s.invalidation,
    trendH1: s.trendH1,
    trendH4: s.trendH4,
    trendD1: s.trendD1,
    marketStructure: s.marketStructure,
    supportLevel: s.supportLevel,
    resistanceLevel: s.resistanceLevel,
  };
}

Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TWELVE_DATA_API_KEY not set" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.warn("ANTHROPIC_API_KEY not set — AI enhancement skipped, using template explanations");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startedAt = new Date();
    const utcHour = startedAt.getUTCHours();
    const isSessionActive = getActiveSession(utcHour);

    // Determine which pairs to process
    const url = new URL(req.url);
    const batchParam = url.searchParams.get("batch");
    let symbols: string[];
    let batchIdx: number | null = null;

    if (batchParam !== null) {
      batchIdx = parseInt(batchParam, 10);
      const start = batchIdx * PAIRS_PER_BATCH;
      symbols = ALL_SYMBOLS.slice(start, start + PAIRS_PER_BATCH);
      if (symbols.length === 0) {
        return new Response(JSON.stringify({ error: `Invalid batch index: ${batchIdx}` }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      console.log(`Batch ${batchIdx}: processing ${symbols.join(", ")}`);
    } else {
      symbols = ALL_SYMBOLS;
      console.log(`Processing all ${symbols.length} pairs (no batch param)`);
    }

    // ── Create generation run record ─────────────────────────────
    const { data: runRow, error: runInsertErr } = await supabase
      .from("generation_runs")
      .insert({
        function_name: "generate-signals",
        batch_index: batchIdx,
        pairs_processed: symbols,
        started_at: startedAt.toISOString(),
        status: "running",
      })
      .select("id")
      .single();

    if (runInsertErr) console.error("Failed to create generation run:", runInsertErr.message);
    const runId: string | null = runRow?.id ?? null;

    // Phase 8: per-run AI counters surfaced on the generation_runs row.
    const aiCounters: AICounters = { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };

    // Helper to finalize the run record
    async function finalizeRun(
      status: "success" | "partial" | "failed",
      candleCount: number,
      signalCount: number,
      apiCredits: number,
      errorMsg?: string,
    ) {
      if (!runId) return;
      const finished = new Date();
      await supabase.from("generation_runs").update({
        finished_at: finished.toISOString(),
        duration_ms: finished.getTime() - startedAt.getTime(),
        status,
        candles_fetched: candleCount,
        signals_created: signalCount,
        api_credits_used: apiCredits,
        error_message: errorMsg ?? null,
        ai_calls_attempted: aiCounters.attempted,
        ai_calls_succeeded: aiCounters.succeeded,
        ai_calls_failed: aiCounters.failed,
        ai_calls_skipped: aiCounters.skipped,
      }).eq("id", runId);
    }

    console.log(`Fetching OHLCV for ${symbols.length} pairs across 3 timeframes...`);
    const ohlcvData = await fetchAllOHLCV(symbols, apiKey);

    // Count how many candles were fetched and API credits used
    let totalCandlesFetched = 0;
    let totalApiCredits = 0;
    for (const [, candles] of ohlcvData) {
      if (candles) {
        totalCandlesFetched += candles.length;
        totalApiCredits += 1; // 1 credit per successful API call
      }
    }

    // ── Persist OHLCV candles ────────────────────────────────────
    const candleRows = buildCandleRows(ohlcvData, symbols, startedAt.toISOString());
    if (candleRows.length > 0) {
      // Upsert in batches of 500 to avoid payload limits
      const CANDLE_BATCH = 500;
      for (let i = 0; i < candleRows.length; i += CANDLE_BATCH) {
        const batch = candleRows.slice(i, i + CANDLE_BATCH);
        const { error: candleErr } = await supabase
          .from("ohlcv_candles")
          .upsert(batch, { onConflict: "symbol,timeframe,candle_time" });
        if (candleErr) console.error(`ohlcv_candles upsert error (batch ${i}):`, candleErr.message);
      }
      console.log(`Persisted ${candleRows.length} candle rows`);
    }

    const signalOutputs: SignalOutput[] = [];
    const skipped: string[] = [];
    const allIndicatorRows: Array<Record<string, unknown>> = [];

    for (const symbol of symbols) {
      const h1 = ohlcvData.get(`${symbol}|1h`);
      const h4 = ohlcvData.get(`${symbol}|4h`);
      const d1 = ohlcvData.get(`${symbol}|1day`);

      if (!h1 || !h4 || !d1) {
        console.warn(`Missing OHLCV data for ${symbol}, skipping`);
        skipped.push(symbol);
        continue;
      }

      // ── Compute & capture indicator snapshots ──────────────────
      if (runId) {
        const indH1 = computeIndicators(h1);
        const indH4 = computeIndicators(h4);
        const indD1 = computeIndicators(d1);
        allIndicatorRows.push(
          ...buildIndicatorRows(runId, symbol, { "1h": indH1, "4h": indH4, "1d": indD1 }, startedAt.toISOString()),
        );
      }

      const tfData: TimeframeData = { h1, h4, d1 };
      const result = analyzeForSignal(symbol, tfData, isSessionActive);

      if (result) {
        // Phase 8: route every signal through the explanation service.
        // The service receives the deterministic templates as `fallback`
        // and decides whether to use Claude or fall through.
        aiCounters.attempted++;
        const explanation = await generateExplanation({
          inputs: buildExplanationInputs(result),
          fallback: {
            beginnerExplanation: result.beginnerExplanation,
            expertExplanation: result.expertExplanation,
            reasonsFor: result.reasonsFor,
            reasonsAgainst: result.reasonsAgainst,
            noTradeReason: result.noTradeReason,
          },
          apiKey: anthropicKey ?? null,
          logger: (msg, meta) => console.log(msg, meta ?? {}),
        });
        if (explanation.status === "ai_success") aiCounters.succeeded++;
        else if (explanation.status === "ai_failed") aiCounters.failed++;
        else if (explanation.status === "ai_skipped") aiCounters.skipped++;
        result.beginnerExplanation = explanation.beginnerExplanation;
        result.expertExplanation = explanation.expertExplanation;
        result.reasonsFor = explanation.reasonsFor;
        result.reasonsAgainst = explanation.reasonsAgainst;
        result.noTradeReason = explanation.noTradeReason;
        result.explanationMeta = explanation;
        signalOutputs.push(result);
      } else {
        console.log(`No setup detected for ${symbol}`);
      }
    }

    // ── Persist indicator snapshots ──────────────────────────────
    if (allIndicatorRows.length > 0) {
      const { error: indErr } = await supabase.from("indicator_snapshots").insert(allIndicatorRows);
      if (indErr) console.error("indicator_snapshots insert error:", indErr.message);
      else console.log(`Saved ${allIndicatorRows.length} indicator snapshots`);
    }

    if (signalOutputs.length === 0) {
      await finalizeRun("success", totalCandlesFetched, 0, totalApiCredits);
      return new Response(
        JSON.stringify({ success: true, message: "No setups detected", skipped, pairs: symbols, runId }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Expire old active signals for pairs that have new signals
    const pairsWithNewSignals = signalOutputs.map((s) => s.pair);
    const { error: expireError } = await supabase
      .from("signals")
      .update({ status: "expired", updated_at: startedAt.toISOString() })
      .in("pair", pairsWithNewSignals)
      .eq("status", "active");

    if (expireError) console.error("Error expiring old signals:", expireError.message);

    // Insert new signals
    const signalRows = signalOutputs.map((s) => ({
      pair: s.pair,
      direction: s.direction,
      timeframe: s.timeframe,
      entry_price: s.entryPrice,
      stop_loss: s.stopLoss,
      take_profit_1: s.tp1,
      take_profit_2: s.tp2,
      take_profit_3: s.tp3,
      confidence: s.confidence,
      verdict: s.verdict,
      status: s.verdict === "trade" ? "active" : "monitoring",
      setup_type: s.setupType,
      risk_reward: s.riskReward,
      ai_reasoning: s.expertExplanation,
      created_by_ai: s.explanationMeta?.status === "ai_success",
      invalidation_reason: s.invalidation,
      created_at: startedAt.toISOString(),
      updated_at: startedAt.toISOString(),
    }));

    const { data: insertedSignals, error: signalError } = await supabase
      .from("signals")
      .insert(signalRows)
      .select("id, pair");

    if (signalError) {
      await finalizeRun("failed", totalCandlesFetched, 0, totalApiCredits, signalError.message);
      throw new Error(`Signal insert error: ${signalError.message}`);
    }

    const signalIdMap = new Map<string, string>();
    for (const sig of insertedSignals ?? []) {
      signalIdMap.set(sig.pair, sig.id);
    }

    // Insert pair_analyses
    const analysisRows = signalOutputs.map((s) => {
      const meta = s.explanationMeta;
      return {
        signal_id: signalIdMap.get(s.pair) ?? null,
        pair: s.pair,
        setup_type: s.setupType,
        direction: s.direction,
        entry_zone_low: s.entryZone[0],
        entry_zone_high: s.entryZone[1],
        stop_loss: s.stopLoss,
        tp1: s.tp1,
        tp2: s.tp2,
        tp3: s.tp3,
        confidence: s.confidence,
        setup_quality: s.setupQuality,
        risk_reward: s.riskReward,
        invalidation: s.invalidation,
        beginner_explanation: s.beginnerExplanation,
        expert_explanation: s.expertExplanation,
        reasons_for: s.reasonsFor,
        reasons_against: s.reasonsAgainst,
        no_trade_reason: s.noTradeReason,
        verdict: s.verdict,
        created_at: startedAt.toISOString(),
        // Phase 8: explanation metadata.
        explanation_source: meta?.source ?? "template",
        explanation_status: meta?.status ?? "template_only",
        explanation_model: meta?.model ?? null,
        explanation_prompt_version: meta?.promptVersion ?? PROMPT_VERSION,
        explanation_generated_at: meta?.generatedAt ?? startedAt.toISOString(),
        explanation_error_code: meta?.errorCode ?? null,
      };
    });

    const { error: analysisError } = await supabase.from("pair_analyses").insert(analysisRows);
    if (analysisError) console.error("pair_analyses insert error:", analysisError.message);

    // Update market_data_cache with real trends
    const trendUpdates = signalOutputs.map((s) => ({
      symbol: s.pair,
      trend_h1: s.trendH1,
      trend_h4: s.trendH4,
      trend_d1: s.trendD1,
      market_structure: s.marketStructure,
      support_level: s.supportLevel,
      resistance_level: s.resistanceLevel,
      updated_at: startedAt.toISOString(),
    }));

    const { error: trendError } = await supabase
      .from("market_data_cache")
      .upsert(trendUpdates, { onConflict: "symbol" });

    if (trendError) console.error("market_data_cache trend update error:", trendError.message);

    // ── Finalize run record ──────────────────────────────────────
    const runStatus = skipped.length > 0 ? "partial" : "success";
    await finalizeRun(runStatus, totalCandlesFetched, signalOutputs.length, totalApiCredits);

    return new Response(
      JSON.stringify({
        success: true,
        batch: batchParam ?? "all",
        generated: signalOutputs.length,
        signals: signalOutputs.map((s) => ({
          pair: s.pair,
          direction: s.direction,
          confidence: s.confidence,
          quality: s.setupQuality,
          verdict: s.verdict,
          setup: s.setupType,
        })),
        skipped,
        runId,
        timestamp: startedAt.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-signals error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// supabase/functions/fetch-candles/index.ts
// Fetches OHLCV candles from Twelve Data for a single symbol+timeframe,
// normalizes them, and upserts into ohlcv_candles.
//
// Invoke: POST /functions/v1/fetch-candles
// Body:   { "symbol": "EUR/USD", "timeframe": "5m", "outputsize": 300 }
//
// Supports incremental updates — checks last candle time and fetches only
// what's needed. Skips the API call entirely if data is still fresh.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const TWELVE_DATA_BASE = "https://api.twelvedata.com";

// ── Allowed symbols and timeframe configuration ──────────────────

const ALLOWED_SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY",
  "CHF/JPY", "EUR/AUD", "GBP/AUD", "EUR/CAD", "USD/CHF",
  "XAU/USD",
];

interface TimeframeConfig {
  apiInterval: string;       // Twelve Data interval param
  defaultOutputsize: number; // Candles to fetch on first load
  stalenessMs: number;       // Skip API call if newest candle is younger than this
  intervalMs: number;        // Duration of one candle in milliseconds
}

const TIMEFRAME_CONFIG: Record<string, TimeframeConfig> = {
  "5m":  { apiInterval: "5min",  defaultOutputsize: 300, stalenessMs: 10 * 60_000,       intervalMs: 5 * 60_000 },
  "15m": { apiInterval: "15min", defaultOutputsize: 200, stalenessMs: 30 * 60_000,       intervalMs: 15 * 60_000 },
  "1h":  { apiInterval: "1h",    defaultOutputsize: 200, stalenessMs: 2 * 60 * 60_000,   intervalMs: 60 * 60_000 },
  "4h":  { apiInterval: "4h",    defaultOutputsize: 100, stalenessMs: 8 * 60 * 60_000,   intervalMs: 4 * 60 * 60_000 },
  "1d":  { apiInterval: "1day",  defaultOutputsize: 60,  stalenessMs: 48 * 60 * 60_000,  intervalMs: 24 * 60 * 60_000 },
};

// ── Twelve Data response type ────────────────────────────────────

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

// ── CORS headers ─────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ── Main handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "TWELVE_DATA_API_KEY not set" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Parse request parameters ─────────────────────────────────
    let symbol: string;
    let timeframe: string;
    let requestedOutputsize: number | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      symbol = body.symbol ?? "";
      timeframe = body.timeframe ?? "";
      requestedOutputsize = body.outputsize;
    } else {
      const url = new URL(req.url);
      symbol = url.searchParams.get("symbol") ?? "";
      timeframe = url.searchParams.get("timeframe") ?? "";
      const os = url.searchParams.get("outputsize");
      requestedOutputsize = os ? parseInt(os, 10) : undefined;
    }

    // ── Validate inputs ──────────────────────────────────────────
    if (!ALLOWED_SYMBOLS.includes(symbol)) {
      return jsonResponse({ error: `Invalid symbol: ${symbol}`, allowed: ALLOWED_SYMBOLS }, 400);
    }

    const config = TIMEFRAME_CONFIG[timeframe];
    if (!config) {
      return jsonResponse({ error: `Invalid timeframe: ${timeframe}`, allowed: Object.keys(TIMEFRAME_CONFIG) }, 400);
    }

    const startedAt = new Date();

    // ── Rate limit guard ─────────────────────────────────────────
    // Check how many fetch-candles runs started in the last 60 seconds
    const { count: recentRuns } = await supabase
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("function_name", "fetch-candles")
      .gte("started_at", new Date(startedAt.getTime() - 60_000).toISOString());

    if ((recentRuns ?? 0) >= 7) {
      return jsonResponse(
        { error: "Rate limit — too many candle fetches in the last minute", retryAfter: 60 },
        429,
      );
    }

    // ── Create generation run record ─────────────────────────────
    const { data: runRow } = await supabase
      .from("generation_runs")
      .insert({
        function_name: "fetch-candles",
        pairs_processed: [symbol],
        started_at: startedAt.toISOString(),
        status: "running",
      })
      .select("id")
      .single();

    const runId: string | null = runRow?.id ?? null;

    async function finalizeRun(
      status: "success" | "failed",
      candleCount: number,
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
        api_credits_used: apiCredits,
        error_message: errorMsg ?? null,
      }).eq("id", runId);
    }

    // ── Incremental update check ─────────────────────────────────
    // Find the newest candle we already have for this symbol+timeframe
    const { data: newestRow } = await supabase
      .from("ohlcv_candles")
      .select("candle_time")
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .order("candle_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newestCandleTime = newestRow?.candle_time
      ? new Date(newestRow.candle_time as string).getTime()
      : 0;

    const ageMs = startedAt.getTime() - newestCandleTime;

    // If data is fresh enough, skip the API call
    if (newestCandleTime > 0 && ageMs < config.stalenessMs) {
      await finalizeRun("success", 0, 0);
      return jsonResponse({
        status: "fresh",
        symbol,
        timeframe,
        lastCandleTime: newestRow!.candle_time,
        ageMs,
        runId,
      });
    }

    // Calculate how many candles we need to fill the gap
    let outputsize: number;
    if (requestedOutputsize && requestedOutputsize > 0) {
      outputsize = Math.min(requestedOutputsize, config.defaultOutputsize);
    } else if (newestCandleTime > 0) {
      // Incremental: fetch only candles since last known + 5 overlap buffer
      const candlesNeeded = Math.ceil(ageMs / config.intervalMs) + 5;
      outputsize = Math.min(candlesNeeded, config.defaultOutputsize);
    } else {
      // First fetch: use full default
      outputsize = config.defaultOutputsize;
    }

    // ── Fetch from Twelve Data ───────────────────────────────────
    const apiUrl = `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${config.apiInterval}&outputsize=${outputsize}&apikey=${apiKey}`;

    const res = await fetch(apiUrl);
    if (!res.ok) {
      const errMsg = `Twelve Data API error: ${res.status}`;
      console.error(errMsg);
      await finalizeRun("failed", 0, 1, errMsg);
      return jsonResponse({ error: errMsg }, 502);
    }

    const data = await res.json();
    if (data.code || !data.values) {
      const errMsg = `Twelve Data error: ${data.message ?? data.code}`;
      console.error(errMsg);
      await finalizeRun("failed", 0, 1, errMsg);
      return jsonResponse({ error: errMsg }, 502);
    }

    // ── Normalize candles ────────────────────────────────────────
    const candles: TwelveDataCandle[] = data.values;
    const fetchedAt = startedAt.toISOString();

    const rows = candles.map((c) => ({
      symbol,
      timeframe,
      candle_time: c.datetime,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: null,
      fetched_at: fetchedAt,
    }));

    // ── Upsert into ohlcv_candles (batched) ──────────────────────
    const BATCH_SIZE = 500;
    let upsertErrors = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: upsertErr } = await supabase
        .from("ohlcv_candles")
        .upsert(batch, { onConflict: "symbol,timeframe,candle_time" });
      if (upsertErr) {
        console.error(`ohlcv_candles upsert error (offset ${i}):`, upsertErr.message);
        upsertErrors++;
      }
    }

    // ── Finalize run ─────────────────────────────────────────────
    const finalStatus = upsertErrors > 0 ? "failed" : "success";
    await finalizeRun(finalStatus as "success" | "failed", rows.length, 1, upsertErrors > 0 ? `${upsertErrors} upsert batch(es) failed` : undefined);

    return jsonResponse({
      status: "updated",
      symbol,
      timeframe,
      candles: rows.length,
      outputsize,
      incremental: newestCandleTime > 0,
      runId,
    });
  } catch (err) {
    console.error("fetch-candles error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

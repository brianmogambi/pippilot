// supabase/functions/fetch-market-data/index.ts
// Fetches live forex quotes from Twelve Data and upserts into market_data_cache.
// Invoke manually: supabase functions invoke fetch-market-data
// Or schedule via pg_cron / external cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const TWELVE_DATA_BASE = "https://api.twelvedata.com";

// All 15 instruments from the instruments table.
// Twelve Data uses slash-less symbols for forex (EUR/USD → EUR/USD works in query param).
const SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY",
  "CHF/JPY", "EUR/AUD", "GBP/AUD", "EUR/CAD", "USD/CHF",
  "XAU/USD",
];

// ── Twelve Data response types ──────────────────────────────────

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  previous_close: string;
  change: string;
  percent_change: string;
  is_market_open: boolean;
}

// ── Helper: determine active trading session from UTC hour ──────

function getActiveSession(hour: number): string {
  // Approximate session times (UTC):
  // Asia:     00:00 – 09:00
  // London:   07:00 – 16:00
  // New York: 12:00 – 21:00
  // Overlap handled by priority: London > New York > Asia
  if (hour >= 7 && hour < 16) return "London";
  if (hour >= 12 && hour < 21) return "New York";
  if (hour >= 0 && hour < 9) return "Asia";
  return "Closed";
}

// ── Helper: classify volatility from daily range ────────────────

function classifyVolatility(high: number, low: number, price: number): string {
  if (price <= 0) return "Low";
  const rangePct = ((high - low) / price) * 100;
  if (rangePct >= 0.5) return "High";
  if (rangePct >= 0.2) return "Med";
  return "Low";
}

// ── Helper: estimate spread based on pair type ──────────────────

function estimateSpread(symbol: string): number {
  // Rough estimates for typical retail spreads
  if (symbol === "EUR/USD") return 0.8;
  if (symbol === "USD/JPY") return 0.9;
  if (symbol === "GBP/USD") return 1.1;
  if (symbol === "AUD/USD" || symbol === "USD/CAD" || symbol === "NZD/USD" || symbol === "USD/CHF") return 1.3;
  if (symbol.includes("JPY")) return 1.8;
  if (symbol === "XAU/USD") return 3.5;
  return 1.5; // crosses
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TWELVE_DATA_API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startedAt = new Date();

    // ── Create generation run record ─────────────────────────────
    const { data: runRow, error: runInsertErr } = await supabase
      .from("generation_runs")
      .insert({
        function_name: "fetch-market-data",
        pairs_processed: SYMBOLS,
        started_at: startedAt.toISOString(),
        status: "running",
      })
      .select("id")
      .single();

    if (runInsertErr) console.error("Failed to create generation run:", runInsertErr.message);
    const runId: string | null = runRow?.id ?? null;

    async function finalizeRun(
      status: "success" | "partial" | "failed",
      apiCredits: number,
      errorMsg?: string,
    ) {
      if (!runId) return;
      const finished = new Date();
      await supabase.from("generation_runs").update({
        finished_at: finished.toISOString(),
        duration_ms: finished.getTime() - startedAt.getTime(),
        status,
        api_credits_used: apiCredits,
        error_message: errorMsg ?? null,
      }).eq("id", runId);
    }

    // Twelve Data free tier: 8 API credits/min (1 credit per symbol in batch).
    // Split into batches of 8 with a 61-second pause between batches.
    const BATCH_SIZE = 8;
    const quotes: Record<string, TwelveDataQuote> = {};
    let totalApiCredits = 0;

    for (let i = 0; i < SYMBOLS.length; i += BATCH_SIZE) {
      if (i > 0) {
        // Wait 61 seconds for rate limit to reset
        await new Promise((resolve) => setTimeout(resolve, 61_000));
      }

      const batch = SYMBOLS.slice(i, i + BATCH_SIZE);
      const symbolParam = batch.join(",");
      const quoteUrl = `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbolParam)}&apikey=${apiKey}`;

      const response = await fetch(quoteUrl);
      if (!response.ok) {
        console.error(`Twelve Data API error for batch ${i / BATCH_SIZE}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Single symbol returns the quote directly; batch returns keyed object
      if (batch.length === 1) {
        if (data && !data.code) quotes[batch[0]] = data;
      } else {
        for (const sym of batch) {
          if (data[sym] && !data[sym].code) quotes[sym] = data[sym];
        }
      }
      totalApiCredits += batch.length;
    }

    const now = new Date();
    const utcHour = now.getUTCHours();
    const activeSession = getActiveSession(utcHour);

    const rows = [];

    for (const symbol of SYMBOLS) {
      const q = quotes[symbol];
      if (!q || q.close === undefined) {
        console.warn(`No quote data for ${symbol}, skipping`);
        continue;
      }

      const price = parseFloat(q.close);
      const high = parseFloat(q.high);
      const low = parseFloat(q.low);
      const prevClose = parseFloat(q.previous_close);
      const change = parseFloat(q.change);
      const changePct = parseFloat(q.percent_change);

      // Use daily range as rough ATR proxy (single-day ATR)
      const atr = high - low;

      rows.push({
        symbol,
        price,
        spread: estimateSpread(symbol),
        daily_change: change,
        daily_change_pct: changePct,
        atr: parseFloat(atr.toFixed(symbol.includes("JPY") || symbol.includes("XAU") ? 2 : 5)),
        volatility: classifyVolatility(high, low, price),
        // Trends default to neutral — Step 3 will compute real trends from OHLCV history
        trend_h1: "neutral",
        trend_h4: "neutral",
        trend_d1: changePct > 0.1 ? "bullish" : changePct < -0.1 ? "bearish" : "neutral",
        active_session: activeSession,
        news_risk: false, // Step 3 will integrate economic calendar
        support_level: low,
        resistance_level: high,
        session_high: high,
        session_low: low,
        prev_day_high: prevClose > 0 ? prevClose * 1.002 : high, // Approximate until we have real historical data
        prev_day_low: prevClose > 0 ? prevClose * 0.998 : low,
        market_structure: Math.abs(changePct) > 0.3 ? "trending" : "ranging",
        updated_at: now.toISOString(),
      });
    }

    if (rows.length === 0) {
      await finalizeRun("failed", totalApiCredits, "No valid quotes received");
      return new Response(JSON.stringify({ error: "No valid quotes received" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert all rows
    const { error } = await supabase
      .from("market_data_cache")
      .upsert(rows, { onConflict: "symbol" });

    if (error) {
      await finalizeRun("failed", totalApiCredits, error.message);
      throw new Error(`Supabase upsert error: ${error.message}`);
    }

    const runStatus = rows.length < SYMBOLS.length ? "partial" : "success";
    await finalizeRun(runStatus, totalApiCredits);

    // Phase 7: chain evaluate-alerts as fire-and-forget. Failures here
    // must never poison the fetch-market-data response.
    try {
      const evalUrl = `${supabaseUrl}/functions/v1/evaluate-alerts`;
      // Don't await — we want this to be best-effort.
      fetch(evalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ source: "fetch-market-data", runId }),
      }).catch((e) => console.warn("evaluate-alerts chain failed:", e));
    } catch (e) {
      console.warn("evaluate-alerts chain dispatch failed:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: rows.length,
        symbols: rows.map((r) => r.symbol),
        runId,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fetch-market-data error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

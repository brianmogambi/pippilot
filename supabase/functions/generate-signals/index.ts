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
import { analyzeForSignal, type OHLCV, type TimeframeData, type SignalOutput } from "../_shared/signal-engine.ts";

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

// ── AI explanation layer ───────────────────────────────────────
// Enhances SignalOutput text fields with Claude-generated explanations.
// NEVER modifies scores, confidence, verdict, or numerical outputs.
// Falls back to template text (already on SignalOutput) on any failure.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const AI_MODEL = "claude-haiku-4-5-20251001";
const AI_MAX_TOKENS = 512;
const AI_TIMEOUT_MS = 10_000;

const AI_SYSTEM_PROMPT = `You are a forex trading analyst for PipPilot AI. You explain trading signals clearly and accurately.

RULES:
- You EXPLAIN signals. You never modify scores, confidence, verdict, or trade levels.
- Beginner explanation: 2-4 sentences. Plain language, no jargon. Explain the pattern and why it matters.
- Expert explanation: 2-4 sentences. Reference indicator values, multi-timeframe alignment, key levels, market structure.
- Reasons for: 3-6 bullet points supporting the trade direction.
- Reasons against: 2-4 bullet points identifying risks or counter-signals.
- No-trade reason (only if verdict is no_trade): 1-2 sentences explaining why.

Respond in EXACTLY this format:
BEGINNER:
<text>
EXPERT:
<text>
REASONS_FOR:
- <reason>
- <reason>
REASONS_AGAINST:
- <reason>
- <reason>
NO_TRADE_REASON:
<text or N/A>`;

interface AIExplanation {
  beginner: string;
  expert: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  noTradeReason: string | null;
}

async function callClaudeAPI(context: Record<string, unknown>, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(context) }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error(`Anthropic API error: ${res.status} ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const block = data?.content?.[0];
    if (!block || block.type !== "text") return null;
    return block.text as string;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Anthropic API call failed:", err);
    return null;
  }
}

function parseAIResponse(text: string): AIExplanation | null {
  try {
    const sections = {
      BEGINNER: "",
      EXPERT: "",
      REASONS_FOR: "",
      REASONS_AGAINST: "",
      NO_TRADE_REASON: "",
    };
    const markers = Object.keys(sections) as (keyof typeof sections)[];
    let current: keyof typeof sections | null = null;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      const marker = markers.find((m) => trimmed === `${m}:` || trimmed.startsWith(`${m}:`));
      if (marker) {
        current = marker;
        const inline = trimmed.slice(marker.length + 1).trim();
        if (inline) sections[marker] += inline + "\n";
        continue;
      }
      if (current) sections[current] += line + "\n";
    }

    const parseBullets = (raw: string): string[] =>
      raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("- ") || l.startsWith("• "))
        .map((l) => l.replace(/^[-•]\s*/, "").trim())
        .filter((l) => l.length > 0);

    const beginner = sections.BEGINNER.trim();
    const expert = sections.EXPERT.trim();
    const reasonsFor = parseBullets(sections.REASONS_FOR);
    const reasonsAgainst = parseBullets(sections.REASONS_AGAINST);
    const ntrRaw = sections.NO_TRADE_REASON.trim();
    const noTradeReason = ntrRaw && ntrRaw.toUpperCase() !== "N/A" ? ntrRaw : null;

    if (!beginner || !expert || reasonsFor.length === 0 || reasonsAgainst.length === 0) {
      console.warn("AI response missing required sections, falling back to template");
      return null;
    }
    return { beginner, expert, reasonsFor, reasonsAgainst, noTradeReason };
  } catch (err) {
    console.error("Failed to parse AI response:", err);
    return null;
  }
}

async function enhanceWithAI(signal: SignalOutput, apiKey: string): Promise<void> {
  const context = {
    pair: signal.pair,
    direction: signal.direction,
    setupType: signal.setupType,
    timeframe: signal.timeframe,
    confidence: signal.confidence,
    setupQuality: signal.setupQuality,
    verdict: signal.verdict,
    entryPrice: signal.entryPrice,
    entryZone: signal.entryZone,
    stopLoss: signal.stopLoss,
    tp1: signal.tp1,
    tp2: signal.tp2,
    tp3: signal.tp3,
    invalidation: signal.invalidation,
    trendH1: signal.trendH1,
    trendH4: signal.trendH4,
    trendD1: signal.trendD1,
    marketStructure: signal.marketStructure,
    supportLevel: signal.supportLevel,
    resistanceLevel: signal.resistanceLevel,
  };
  const text = await callClaudeAPI(context, apiKey);
  if (!text) return;
  const parsed = parseAIResponse(text);
  if (!parsed) return;
  signal.beginnerExplanation = parsed.beginner;
  signal.expertExplanation = parsed.expert;
  signal.reasonsFor = parsed.reasonsFor;
  signal.reasonsAgainst = parsed.reasonsAgainst;
  if (signal.verdict === "no_trade" && parsed.noTradeReason) {
    signal.noTradeReason = parsed.noTradeReason;
  }
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

    const now = new Date();
    const utcHour = now.getUTCHours();
    const isSessionActive = getActiveSession(utcHour);

    // Determine which pairs to process
    const url = new URL(req.url);
    const batchParam = url.searchParams.get("batch");
    let symbols: string[];

    if (batchParam !== null) {
      const batchIdx = parseInt(batchParam, 10);
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

    console.log(`Fetching OHLCV for ${symbols.length} pairs across 3 timeframes...`);
    const ohlcvData = await fetchAllOHLCV(symbols, apiKey);

    const signalOutputs: SignalOutput[] = [];
    const skipped: string[] = [];

    for (const symbol of symbols) {
      const h1 = ohlcvData.get(`${symbol}|1h`);
      const h4 = ohlcvData.get(`${symbol}|4h`);
      const d1 = ohlcvData.get(`${symbol}|1day`);

      if (!h1 || !h4 || !d1) {
        console.warn(`Missing OHLCV data for ${symbol}, skipping`);
        skipped.push(symbol);
        continue;
      }

      const tfData: TimeframeData = { h1, h4, d1 };
      const result = analyzeForSignal(symbol, tfData, isSessionActive);

      if (result) {
        if (anthropicKey) {
          await enhanceWithAI(result, anthropicKey);
        }
        signalOutputs.push(result);
      } else {
        console.log(`No setup detected for ${symbol}`);
      }
    }

    if (signalOutputs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No setups detected", skipped, pairs: symbols }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Expire old active signals for pairs that have new signals
    const pairsWithNewSignals = signalOutputs.map((s) => s.pair);
    const { error: expireError } = await supabase
      .from("signals")
      .update({ status: "expired", updated_at: now.toISOString() })
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
      ai_reasoning: s.expertExplanation,
      created_by_ai: true,
      invalidation_reason: s.invalidation,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }));

    const { data: insertedSignals, error: signalError } = await supabase
      .from("signals")
      .insert(signalRows)
      .select("id, pair");

    if (signalError) throw new Error(`Signal insert error: ${signalError.message}`);

    const signalIdMap = new Map<string, string>();
    for (const sig of insertedSignals ?? []) {
      signalIdMap.set(sig.pair, sig.id);
    }

    // Insert pair_analyses
    const analysisRows = signalOutputs.map((s) => ({
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
      invalidation: s.invalidation,
      beginner_explanation: s.beginnerExplanation,
      expert_explanation: s.expertExplanation,
      reasons_for: s.reasonsFor,
      reasons_against: s.reasonsAgainst,
      no_trade_reason: s.noTradeReason,
      verdict: s.verdict,
      created_at: now.toISOString(),
    }));

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
      updated_at: now.toISOString(),
    }));

    const { error: trendError } = await supabase
      .from("market_data_cache")
      .upsert(trendUpdates, { onConflict: "symbol" });

    if (trendError) console.error("market_data_cache trend update error:", trendError.message);

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
        timestamp: now.toISOString(),
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

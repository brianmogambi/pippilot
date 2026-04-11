import { describe, it, expect, vi } from "vitest";
import {
  PROMPT_VERSION,
  AI_MODEL_ID,
  AI_TIMEOUT_MS,
  AI_SYSTEM_PROMPT_V1,
  buildPromptContext,
  buildSystemPrompt,
  parseAIResponse,
  generateExplanation,
  type ExplanationInputs,
  type ExplanationFallback,
} from "../explanation-service";

const baseInputs: ExplanationInputs = {
  pair: "EUR/USD",
  direction: "long",
  setupType: "trend_pullback",
  timeframe: "H1",
  confidence: 78,
  setupQuality: "A",
  verdict: "trade",
  entryPrice: 1.1000,
  entryZone: [1.0995, 1.1005],
  stopLoss: 1.0950,
  tp1: 1.1050,
  tp2: 1.1100,
  tp3: 1.1150,
  invalidation: "H1 close below 1.0945",
  trendH1: "bullish",
  trendH4: "bullish",
  trendD1: "bullish",
  marketStructure: "trending",
  supportLevel: 1.0980,
  resistanceLevel: 1.1080,
};

const baseFallback: ExplanationFallback = {
  beginnerExplanation: "TEMPLATE BEGINNER",
  expertExplanation: "TEMPLATE EXPERT",
  reasonsFor: ["template for 1", "template for 2"],
  reasonsAgainst: ["template against 1"],
  noTradeReason: null,
};

const FIXED_NOW = new Date("2026-04-13T12:00:00.000Z");
const fixedNow = () => FIXED_NOW;

const validAIBody = `BEGINNER:
This is a bullish trend pullback on EUR/USD. The price has retraced to support and is showing signs of resuming the uptrend.
EXPERT:
H1 EMA20 above EMA50 with RSI 58 and positive MACD histogram. Multi-timeframe alignment with H4 and D1 bullish.
REASONS_FOR:
- H4 trend bullish
- RSI in healthy zone
- MACD confirms direction
REASONS_AGAINST:
- Approaching weekly resistance
- News risk later today
NO_TRADE_REASON:
N/A`;

function makeOkResponse(text: string): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("constants", () => {
  it("PROMPT_VERSION is v1", () => {
    expect(PROMPT_VERSION).toBe("v1");
  });
  it("AI_MODEL_ID is the documented model", () => {
    expect(AI_MODEL_ID).toBe("claude-haiku-4-5-20251001");
  });
  it("AI_TIMEOUT_MS is 10s", () => {
    expect(AI_TIMEOUT_MS).toBe(10_000);
  });
});

describe("buildPromptContext", () => {
  it("returns the 20 deterministic fields", () => {
    const ctx = buildPromptContext(baseInputs);
    expect(Object.keys(ctx).sort()).toEqual(
      [
        "confidence",
        "direction",
        "entryPrice",
        "entryZone",
        "invalidation",
        "marketStructure",
        "pair",
        "resistanceLevel",
        "setupQuality",
        "setupType",
        "stopLoss",
        "supportLevel",
        "timeframe",
        "tp1",
        "tp2",
        "tp3",
        "trendD1",
        "trendH1",
        "trendH4",
        "verdict",
      ].sort(),
    );
    expect(ctx.pair).toBe("EUR/USD");
    expect(ctx.entryZone).toEqual([1.0995, 1.1005]);
  });
});

describe("buildSystemPrompt", () => {
  it("returns the v1 prompt by default", () => {
    expect(buildSystemPrompt()).toBe(AI_SYSTEM_PROMPT_V1);
  });
  it("contains the five section markers", () => {
    const prompt = buildSystemPrompt();
    for (const m of [
      "BEGINNER:",
      "EXPERT:",
      "REASONS_FOR:",
      "REASONS_AGAINST:",
      "NO_TRADE_REASON:",
    ]) {
      expect(prompt).toContain(m);
    }
  });
  it("falls through to v1 for unknown versions", () => {
    expect(buildSystemPrompt("v999")).toBe(AI_SYSTEM_PROMPT_V1);
  });
});

describe("parseAIResponse", () => {
  it("parses a valid five-section response", () => {
    const out = parseAIResponse(validAIBody);
    expect(out).not.toBeNull();
    expect(out!.beginner).toContain("bullish trend pullback");
    expect(out!.expert).toContain("EMA20");
    expect(out!.reasonsFor).toHaveLength(3);
    expect(out!.reasonsAgainst).toHaveLength(2);
    expect(out!.noTradeReason).toBeNull();
  });

  it("parses bullets with both - and • prefixes", () => {
    const text = validAIBody.replace("- H4 trend bullish", "• H4 trend bullish");
    const out = parseAIResponse(text);
    expect(out!.reasonsFor).toContain("H4 trend bullish");
  });

  it("returns null when BEGINNER is missing", () => {
    const text = validAIBody.replace(/BEGINNER:[\s\S]*?EXPERT:/, "EXPERT:");
    expect(parseAIResponse(text)).toBeNull();
  });

  it("returns null when REASONS_FOR has no bullets", () => {
    const text = validAIBody.replace(
      /REASONS_FOR:[\s\S]*?REASONS_AGAINST:/,
      "REASONS_FOR:\n\nREASONS_AGAINST:",
    );
    expect(parseAIResponse(text)).toBeNull();
  });

  it("treats NO_TRADE_REASON: N/A as null", () => {
    const out = parseAIResponse(validAIBody);
    expect(out!.noTradeReason).toBeNull();
  });

  it("returns the no-trade reason text when supplied", () => {
    const text = validAIBody.replace("N/A", "Spread too wide right now.");
    const out = parseAIResponse(text);
    expect(out!.noTradeReason).toBe("Spread too wide right now.");
  });
});

describe("generateExplanation", () => {
  it("ai_skipped when apiKey is null — returns fallback verbatim", async () => {
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: null,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_skipped");
    expect(result.source).toBe("template");
    expect(result.errorCode).toBe("missing_api_key");
    expect(result.model).toBeNull();
    expect(result.promptVersion).toBe("v1");
    expect(result.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(result.beginnerExplanation).toBe(baseFallback.beginnerExplanation);
    expect(result.expertExplanation).toBe(baseFallback.expertExplanation);
    expect(result.reasonsFor).toBe(baseFallback.reasonsFor);
    expect(result.reasonsAgainst).toBe(baseFallback.reasonsAgainst);
  });

  it("ai_success when fetch returns a valid body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(makeOkResponse(validAIBody));
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_success");
    expect(result.source).toBe("ai");
    expect(result.model).toBe(AI_MODEL_ID);
    expect(result.promptVersion).toBe("v1");
    expect(result.errorCode).toBeNull();
    expect(result.beginnerExplanation).toContain("bullish trend pullback");
    expect(result.reasonsFor).toHaveLength(3);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("ai_failed http_429 when fetch returns 429", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_failed");
    expect(result.errorCode).toBe("http_429");
    expect(result.beginnerExplanation).toBe(baseFallback.beginnerExplanation);
  });

  it("ai_failed timeout when fetch throws AbortError", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const fetchFn = vi.fn().mockRejectedValue(abortErr);
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_failed");
    expect(result.errorCode).toBe("timeout");
  });

  it("ai_failed network_error on a non-abort throw", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_failed");
    expect(result.errorCode).toBe("network_error");
  });

  it("ai_failed parse_failed on a malformed body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      makeOkResponse("garbage with no markers"),
    );
    const result = await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: "sk-test",
      fetchFn: fetchFn as unknown as typeof fetch,
      now: fixedNow,
    });
    expect(result.status).toBe("ai_failed");
    expect(result.errorCode).toBe("parse_failed");
    expect(result.beginnerExplanation).toBe(baseFallback.beginnerExplanation);
  });

  it("logger is called exactly once with status + errorCode + pair", async () => {
    const logger = vi.fn();
    await generateExplanation({
      inputs: baseInputs,
      fallback: baseFallback,
      apiKey: null,
      now: fixedNow,
      logger,
    });
    expect(logger).toHaveBeenCalledTimes(1);
    const [msg, meta] = logger.mock.calls[0];
    expect(msg).toMatch(/ai_skipped/);
    expect(meta).toMatchObject({
      status: "ai_skipped",
      errorCode: "missing_api_key",
      pair: "EUR/USD",
    });
  });

  it("does not mutate the fallback object on failure", async () => {
    const fb: ExplanationFallback = {
      beginnerExplanation: "FB B",
      expertExplanation: "FB E",
      reasonsFor: ["a", "b"],
      reasonsAgainst: ["c"],
      noTradeReason: null,
    };
    const snapshot = JSON.parse(JSON.stringify(fb));
    await generateExplanation({
      inputs: baseInputs,
      fallback: fb,
      apiKey: null,
      now: fixedNow,
    });
    expect(fb).toEqual(snapshot);
  });
});

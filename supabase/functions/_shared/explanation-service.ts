// supabase/functions/_shared/explanation-service.ts
//
// Deno mirror of src/lib/explanation-service.ts — keep in sync. There are
// no relative imports so this is a true verbatim copy. Document the
// dual-location TODO alongside the existing risk-engine / alert-engine
// TODOs.

// ── Constants ───────────────────────────────────────────────────

export const PROMPT_VERSION = "v1";
export const AI_MODEL_ID = "claude-haiku-4-5-20251001";
export const AI_MAX_TOKENS = 512;
export const AI_TIMEOUT_MS = 10_000;
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ── Versioned prompts ───────────────────────────────────────────

export const AI_SYSTEM_PROMPT_V1 = `You are a forex trading analyst for PipPilot AI. You explain trading signals clearly and accurately.

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

// ── Types ───────────────────────────────────────────────────────

export type ExplanationStatus =
  | "ai_success"
  | "ai_failed"
  | "ai_skipped"
  | "template_only";

export type ExplanationSource = "ai" | "template";

export interface ExplanationInputs {
  pair: string;
  direction: "long" | "short";
  setupType: string;
  timeframe: string;
  confidence: number;
  setupQuality: string;
  verdict: "trade" | "no_trade";
  entryPrice: number;
  entryZone: [number, number];
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  invalidation: string;
  trendH1: string;
  trendH4: string;
  trendD1: string;
  marketStructure: string;
  supportLevel: number;
  resistanceLevel: number;
}

export interface ExplanationFallback {
  beginnerExplanation: string;
  expertExplanation: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  noTradeReason: string | null;
}

export interface ExplanationResult {
  beginnerExplanation: string;
  expertExplanation: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  noTradeReason: string | null;
  source: ExplanationSource;
  status: ExplanationStatus;
  model: string | null;
  promptVersion: string;
  generatedAt: string;
  errorCode: string | null;
}

export interface ParsedAIResponse {
  beginner: string;
  expert: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  noTradeReason: string | null;
}

export type ExplanationLogger = (
  msg: string,
  meta?: Record<string, unknown>,
) => void;

// ── Pure helpers ────────────────────────────────────────────────

export function buildPromptContext(
  inputs: ExplanationInputs,
): Record<string, unknown> {
  return {
    pair: inputs.pair,
    direction: inputs.direction,
    setupType: inputs.setupType,
    timeframe: inputs.timeframe,
    confidence: inputs.confidence,
    setupQuality: inputs.setupQuality,
    verdict: inputs.verdict,
    entryPrice: inputs.entryPrice,
    entryZone: inputs.entryZone,
    stopLoss: inputs.stopLoss,
    tp1: inputs.tp1,
    tp2: inputs.tp2,
    tp3: inputs.tp3,
    invalidation: inputs.invalidation,
    trendH1: inputs.trendH1,
    trendH4: inputs.trendH4,
    trendD1: inputs.trendD1,
    marketStructure: inputs.marketStructure,
    supportLevel: inputs.supportLevel,
    resistanceLevel: inputs.resistanceLevel,
  };
}

export function buildSystemPrompt(version: string = PROMPT_VERSION): string {
  switch (version) {
    case "v1":
      return AI_SYSTEM_PROMPT_V1;
    default:
      return AI_SYSTEM_PROMPT_V1;
  }
}

export function parseAIResponse(text: string): ParsedAIResponse | null {
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
      const marker = markers.find(
        (m) => trimmed === `${m}:` || trimmed.startsWith(`${m}:`),
      );
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
    const noTradeReason =
      ntrRaw && ntrRaw.toUpperCase() !== "N/A" ? ntrRaw : null;

    if (
      !beginner ||
      !expert ||
      reasonsFor.length === 0 ||
      reasonsAgainst.length === 0
    ) {
      return null;
    }
    return { beginner, expert, reasonsFor, reasonsAgainst, noTradeReason };
  } catch {
    return null;
  }
}

// ── Internal builders ───────────────────────────────────────────

function fallbackResult(
  fallback: ExplanationFallback,
  status: ExplanationStatus,
  errorCode: string | null,
  generatedAt: string,
): ExplanationResult {
  return {
    beginnerExplanation: fallback.beginnerExplanation,
    expertExplanation: fallback.expertExplanation,
    reasonsFor: fallback.reasonsFor,
    reasonsAgainst: fallback.reasonsAgainst,
    noTradeReason: fallback.noTradeReason,
    source: "template",
    status,
    model: null,
    promptVersion: PROMPT_VERSION,
    generatedAt,
    errorCode,
  };
}

function successResult(
  parsed: ParsedAIResponse,
  fallback: ExplanationFallback,
  generatedAt: string,
): ExplanationResult {
  return {
    beginnerExplanation: parsed.beginner,
    expertExplanation: parsed.expert,
    reasonsFor: parsed.reasonsFor,
    reasonsAgainst: parsed.reasonsAgainst,
    noTradeReason: parsed.noTradeReason ?? fallback.noTradeReason,
    source: "ai",
    status: "ai_success",
    model: AI_MODEL_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt,
    errorCode: null,
  };
}

// ── Single entry point ──────────────────────────────────────────

export async function generateExplanation(args: {
  inputs: ExplanationInputs;
  fallback: ExplanationFallback;
  apiKey: string | null;
  fetchFn?: typeof fetch;
  now?: () => Date;
  logger?: ExplanationLogger;
}): Promise<ExplanationResult> {
  const {
    inputs,
    fallback,
    apiKey,
    fetchFn = fetch,
    now = () => new Date(),
    logger,
  } = args;

  const log = (msg: string, meta?: Record<string, unknown>) => {
    if (logger) logger(msg, { pair: inputs.pair, ...meta });
  };

  const generatedAt = now().toISOString();

  if (!apiKey) {
    const result = fallbackResult(
      fallback,
      "ai_skipped",
      "missing_api_key",
      generatedAt,
    );
    log("explanation: ai_skipped", {
      status: result.status,
      errorCode: result.errorCode,
    });
    return result;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetchFn(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL_ID,
        max_tokens: AI_MAX_TOKENS,
        system: buildSystemPrompt(),
        messages: [
          { role: "user", content: JSON.stringify(buildPromptContext(inputs)) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorCode = `http_${res.status}`;
      const result = fallbackResult(
        fallback,
        "ai_failed",
        errorCode,
        generatedAt,
      );
      log("explanation: ai_failed", {
        status: result.status,
        errorCode,
      });
      return result;
    }

    const data = await res.json();
    const block = data?.content?.[0];
    if (!block || block.type !== "text" || typeof block.text !== "string") {
      const result = fallbackResult(
        fallback,
        "ai_failed",
        "parse_failed",
        generatedAt,
      );
      log("explanation: ai_failed", {
        status: result.status,
        errorCode: result.errorCode,
      });
      return result;
    }

    const parsed = parseAIResponse(block.text);
    if (!parsed) {
      const result = fallbackResult(
        fallback,
        "ai_failed",
        "parse_failed",
        generatedAt,
      );
      log("explanation: ai_failed", {
        status: result.status,
        errorCode: result.errorCode,
      });
      return result;
    }

    const result = successResult(parsed, fallback, generatedAt);
    log("explanation: ai_success", {
      status: result.status,
      errorCode: null,
      model: result.model,
      promptVersion: result.promptVersion,
    });
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));
    const errorCode = isAbort ? "timeout" : "network_error";
    const result = fallbackResult(
      fallback,
      "ai_failed",
      errorCode,
      generatedAt,
    );
    log("explanation: ai_failed", {
      status: result.status,
      errorCode,
    });
    return result;
  }
}

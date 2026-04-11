import { describe, it, expect } from "vitest";
import {
  SEVERITY_BY_KIND,
  detectSetupForming,
  detectEntryReached,
  detectConfirmationReached,
  detectTpReached,
  detectInvalidation,
  detectRiskBreach,
  evaluateSignalAlerts,
  evaluateRiskAlert,
  dedupeAlerts,
  type SignalState,
  type PriceState,
  type AlertCandidate,
  type AlertEventKind,
  type RiskContext,
} from "../alert-engine";

const baseSignal: SignalState = {
  id: "sig-1",
  pair: "EUR/USD",
  direction: "long",
  status: "monitoring",
  verdict: "trade",
  setup_type: "Trend Pullback",
  entry_price: 1.1000,
  stop_loss: 1.0950,
  take_profit_1: 1.1050,
  take_profit_2: 1.1100,
  take_profit_3: 1.1150,
  invalidation_reason: null,
};

const noFired = { fired: new Set<AlertEventKind>() };

describe("detectSetupForming", () => {
  it("true for trade verdict + monitoring status", () => {
    expect(detectSetupForming(baseSignal)).toBe(true);
  });
  it("false for no_trade verdict", () => {
    expect(detectSetupForming({ ...baseSignal, verdict: "no_trade" })).toBe(false);
  });
  it("false for closed status", () => {
    expect(detectSetupForming({ ...baseSignal, status: "closed" })).toBe(false);
  });
});

describe("detectEntryReached", () => {
  it("long: price within 5-pip band of entry → true", () => {
    expect(detectEntryReached(baseSignal, { pair: "EUR/USD", price: 1.10003 })).toBe(true);
  });
  it("long: price outside band → false", () => {
    expect(detectEntryReached(baseSignal, { pair: "EUR/USD", price: 1.0980 })).toBe(false);
  });
  it("short: same band logic", () => {
    const s = { ...baseSignal, direction: "short" as const, entry_price: 1.1000 };
    expect(detectEntryReached(s, { pair: "EUR/USD", price: 1.10004 })).toBe(true);
  });
  it("widens band with ATR when supplied", () => {
    // 0.05 × 0.02 = 0.001 → wider than 5 pips (0.0005)
    expect(detectEntryReached(baseSignal, { pair: "EUR/USD", price: 1.1009, atr: 0.02 })).toBe(true);
  });
  it("returns false when entry_price is null", () => {
    expect(detectEntryReached({ ...baseSignal, entry_price: null }, { pair: "EUR/USD", price: 1.1 })).toBe(false);
  });
});

describe("detectConfirmationReached", () => {
  it("fires on monitoring → ready flip", () => {
    const prior = { ...baseSignal, status: "monitoring" };
    const next = { ...baseSignal, status: "ready" };
    expect(detectConfirmationReached(next, prior)).toBe(true);
  });
  it("does not fire without prior", () => {
    expect(detectConfirmationReached(baseSignal, null)).toBe(false);
  });
  it("does not fire if still monitoring", () => {
    expect(detectConfirmationReached(baseSignal, baseSignal)).toBe(false);
  });
});

describe("detectTpReached", () => {
  it("long: price >= tp1 → true", () => {
    expect(detectTpReached(baseSignal, { pair: "EUR/USD", price: 1.1051 }, 1)).toBe(true);
  });
  it("long: price < tp1 → false", () => {
    expect(detectTpReached(baseSignal, { pair: "EUR/USD", price: 1.1049 }, 1)).toBe(false);
  });
  it("short: price <= tp1 → true", () => {
    const s = { ...baseSignal, direction: "short" as const };
    expect(detectTpReached(s, { pair: "EUR/USD", price: 1.1049 }, 1)).toBe(true);
  });
  it("returns false when tp column is null", () => {
    expect(detectTpReached({ ...baseSignal, take_profit_3: null }, { pair: "EUR/USD", price: 99 }, 3)).toBe(false);
  });
});

describe("detectInvalidation", () => {
  it("long: price <= stop_loss → true", () => {
    expect(detectInvalidation(baseSignal, { pair: "EUR/USD", price: 1.0949 })).toBe(true);
  });
  it("long: price > stop_loss → false", () => {
    expect(detectInvalidation(baseSignal, { pair: "EUR/USD", price: 1.0951 })).toBe(false);
  });
  it("short: price >= stop_loss → true", () => {
    const s = { ...baseSignal, direction: "short" as const, stop_loss: 1.1050 };
    expect(detectInvalidation(s, { pair: "EUR/USD", price: 1.1051 })).toBe(true);
  });
  it("returns true when invalidation_reason is set, regardless of price", () => {
    expect(detectInvalidation({ ...baseSignal, invalidation_reason: "structure broken" }, { pair: "EUR/USD", price: 1.2 })).toBe(true);
  });
});

describe("detectRiskBreach", () => {
  const baseCtx: RiskContext = {
    balance: 10_000,
    openPositions: [],
    realizedLossUSD: 0,
    maxDailyLossPct: 3,
  };

  it("returns open_risk_safety when openRisk > 5%", () => {
    const ctx: RiskContext = {
      ...baseCtx,
      openPositions: [
        { pair: "EUR/USD", lotSize: 1.5, entry: 1.10, stopLoss: 1.0950, pipValueUSD: 10 }, // 50 × 10 × 1.5 = 750 → 7.5%
      ],
    };
    expect(detectRiskBreach(ctx)).toEqual({ breached: true, reason: "open_risk_safety" });
  });

  it("returns daily_loss_profile when realized loss > maxDailyLossPct", () => {
    const ctx: RiskContext = { ...baseCtx, realizedLossUSD: 400 }; // 4% > 3%
    expect(detectRiskBreach(ctx)).toEqual({ breached: true, reason: "daily_loss_profile" });
  });

  it("returns no breach when all clear", () => {
    expect(detectRiskBreach(baseCtx)).toEqual({ breached: false, reason: null });
  });

  it("returns no breach when balance is 0", () => {
    expect(detectRiskBreach({ ...baseCtx, balance: 0 })).toEqual({ breached: false, reason: null });
  });
});

describe("evaluateSignalAlerts", () => {
  const price = (p: number): PriceState => ({ pair: "EUR/USD", price: p });

  it("at fair value mid-zone → only setup_forming", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.1020), // away from entry
      prior: noFired,
      analysisRunId: null,
    });
    expect(out.map((c) => c.event_kind)).toEqual(["setup_forming"]);
  });

  it("at entry → setup_forming + entry_reached", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.1000),
      prior: noFired,
      analysisRunId: null,
    });
    expect(out.map((c) => c.event_kind).sort()).toEqual(["entry_reached", "setup_forming"]);
  });

  it("price > tp1 < tp2 → tp1_reached only", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.1060),
      prior: { fired: new Set<AlertEventKind>(["setup_forming"]) },
      analysisRunId: null,
    });
    expect(out.map((c) => c.event_kind)).toEqual(["tp1_reached"]);
  });

  it("price below SL → invalidation, no tp", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.0900),
      prior: { fired: new Set<AlertEventKind>(["setup_forming"]) },
      analysisRunId: null,
    });
    expect(out.map((c) => c.event_kind)).toEqual(["invalidation"]);
  });

  it("suppresses already-fired kinds", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.1000),
      prior: { fired: new Set<AlertEventKind>(["setup_forming", "entry_reached"]) },
      analysisRunId: null,
    });
    expect(out).toEqual([]);
  });

  it("includes analysis_run_id and dedupe_key on each candidate", () => {
    const out = evaluateSignalAlerts({
      signal: baseSignal,
      priorSignal: null,
      price: price(1.1000),
      prior: noFired,
      analysisRunId: "run-123",
    });
    for (const c of out) {
      expect(c.analysis_run_id).toBe("run-123");
      expect(c.dedupe_key).toBe(`${baseSignal.id}:${c.event_kind}`);
      expect(c.severity).toBe(SEVERITY_BY_KIND[c.event_kind]);
    }
  });
});

describe("evaluateRiskAlert", () => {
  const ctx: RiskContext = {
    balance: 10_000,
    openPositions: [
      { pair: "EUR/USD", lotSize: 1.5, entry: 1.10, stopLoss: 1.0950, pipValueUSD: 10 },
    ],
    realizedLossUSD: 0,
    maxDailyLossPct: 3,
  };

  it("returns a risk_breach candidate when threshold crossed", () => {
    const out = evaluateRiskAlert({
      ctx,
      prior: noFired,
      signalIdForBreach: "sig-1",
      pair: "EUR/USD",
    });
    expect(out).not.toBeNull();
    expect(out!.event_kind).toBe("risk_breach");
    expect(out!.severity).toBe("critical");
    expect(out!.dedupe_key).toBe("sig-1:risk_breach");
  });

  it("returns null when already fired", () => {
    const out = evaluateRiskAlert({
      ctx,
      prior: { fired: new Set<AlertEventKind>(["risk_breach"]) },
      signalIdForBreach: "sig-1",
      pair: "EUR/USD",
    });
    expect(out).toBeNull();
  });

  it("returns null when no breach", () => {
    const out = evaluateRiskAlert({
      ctx: { ...ctx, openPositions: [] },
      prior: noFired,
      signalIdForBreach: "sig-1",
      pair: "EUR/USD",
    });
    expect(out).toBeNull();
  });
});

describe("dedupeAlerts", () => {
  const a: AlertCandidate = {
    signal_id: "s1",
    pair: "EUR/USD",
    event_kind: "entry_reached",
    severity: "info",
    title: "t",
    message: "m",
    dedupe_key: "s1:entry_reached",
    analysis_run_id: null,
  };
  const b: AlertCandidate = { ...a, event_kind: "tp1_reached", dedupe_key: "s1:tp1_reached" };

  it("drops candidates whose key already exists", () => {
    const out = dedupeAlerts([a, b], new Set(["s1:entry_reached"]));
    expect(out).toEqual([b]);
  });

  it("drops in-batch duplicates", () => {
    const out = dedupeAlerts([a, a, b], new Set());
    expect(out).toEqual([a, b]);
  });

  it("preserves order", () => {
    const out = dedupeAlerts([b, a], new Set());
    expect(out.map((c) => c.event_kind)).toEqual(["tp1_reached", "entry_reached"]);
  });
});

describe("SEVERITY_BY_KIND", () => {
  it("matches the documented severity table", () => {
    expect(SEVERITY_BY_KIND).toEqual({
      setup_forming: "info",
      entry_reached: "info",
      confirmation_reached: "info",
      tp1_reached: "info",
      tp2_reached: "info",
      tp3_reached: "info",
      invalidation: "warning",
      risk_breach: "critical",
    });
  });
});

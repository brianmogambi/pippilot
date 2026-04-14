import { describe, it, expect } from "vitest";
import {
  buildExecutedTradeFromSignal,
  buildManualExecutedTrade,
  type TakeTradeFormInputs,
} from "@/lib/trade-build/build-executed-trade";
import type {
  EnrichedSignal,
  Signal,
  TradingAccount,
} from "@/types/trading";

// Phase 18.9: guards the "signal snapshot correctness" contract
// that the TakeTradeDialog relies on and that the Phase 18.5 rule
// engine reads back at close time. A regression in either this
// helper or the signal shape would show up as wrong planned_*
// values on the persisted executed_trades row, which in turn
// would make the post-trade analysis lie.

// ── fixtures ────────────────────────────────────────────────────

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig-1",
    pair: "EUR/USD",
    direction: "long",
    timeframe: "H1",
    entry_price: 1.0805,
    stop_loss: 1.0760,
    take_profit_1: 1.0905,
    take_profit_2: 1.0945,
    take_profit_3: null,
    confidence: 78,
    setup_type: "bullish_flag_breakout",
    ai_reasoning: "H1 bull flag forming after impulsive move.",
    verdict: "trade",
    status: "active",
    created_by_ai: true,
    invalidation_reason: null,
    review_tag: null,
    review_notes: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T10:00:00Z",
    ...overrides,
  } as Signal;
}

function makeEnriched(overrides: Partial<EnrichedSignal> = {}): EnrichedSignal {
  const base = makeSignal();
  return {
    ...base,
    analysis: null,
    riskReward: 2,
    ...overrides,
  } as EnrichedSignal;
}

function makeAccount(
  overrides: Partial<TradingAccount> = {},
): Pick<TradingAccount, "id" | "account_mode"> {
  return {
    id: "acct-1",
    account_mode: "real",
    ...overrides,
  } as TradingAccount;
}

const baseForm: TakeTradeFormInputs = {
  symbol: "EUR/USD",
  direction: "long",
  actualEntryPrice: 1.0808,
  actualStopLoss: 1.0760,
  actualTakeProfit: 1.0905,
  lotSize: 0.1,
  notes: null,
};

// ── signal snapshot correctness ─────────────────────────────────

describe("buildExecutedTradeFromSignal — snapshot correctness", () => {
  it("copies every planned_* field verbatim from the signal at call time", () => {
    const signal = makeSignal();
    const account = makeAccount();
    const out = buildExecutedTradeFromSignal(signal, baseForm, account);

    // signal_id locked to the live signal
    expect(out.signal_id).toBe(signal.id);
    // Planned zone collapses to the point entry_price when no PairAnalysis
    expect(out.planned_entry_low).toBe(signal.entry_price);
    expect(out.planned_entry_high).toBe(signal.entry_price);
    // SL / TP1 / TP2 / confidence / setup / timeframe / reasoning all snapshotted
    expect(out.planned_stop_loss).toBe(signal.stop_loss);
    expect(out.planned_take_profit_1).toBe(signal.take_profit_1);
    expect(out.planned_take_profit_2).toBe(signal.take_profit_2);
    expect(out.planned_confidence).toBe(signal.confidence);
    expect(out.planned_setup_type).toBe(signal.setup_type);
    expect(out.planned_timeframe).toBe(signal.timeframe);
    expect(out.planned_reasoning_snapshot).toBe(signal.ai_reasoning);
  });

  it("uses the EnrichedSignal entry zone when the analysis row exists", () => {
    const enriched = makeEnriched({
      analysis: {
        setupType: "bullish_flag_breakout",
        direction: "long",
        entryZone: [1.0795, 1.0815],
        stopLoss: 1.076,
        tp1: 1.0905,
        tp2: 1.0945,
        tp3: 1.098,
        confidence: 78,
        setupQuality: "A",
        invalidation: "H1 close below 1.0760",
        beginnerExplanation: "",
        expertExplanation: "",
        reasonsFor: [],
        reasonsAgainst: [],
        noTradeReason: null,
        verdict: "trade",
      },
    });
    const out = buildExecutedTradeFromSignal(enriched, baseForm, makeAccount());
    expect(out.planned_entry_low).toBe(1.0795);
    expect(out.planned_entry_high).toBe(1.0815);
  });

  it("snapshots actual execution fields verbatim from the form", () => {
    const out = buildExecutedTradeFromSignal(
      makeSignal(),
      {
        ...baseForm,
        actualEntryPrice: 1.0820,
        actualStopLoss: 1.0755,
        actualTakeProfit: 1.0900,
        lotSize: 0.25,
        notes: "Slipped on news spike",
      },
      makeAccount(),
    );
    expect(out.actual_entry_price).toBe(1.0820);
    expect(out.actual_stop_loss).toBe(1.0755);
    expect(out.actual_take_profit).toBe(1.0900);
    expect(out.lot_size).toBe(0.25);
    expect(out.notes).toBe("Slipped on news spike");
  });

  it("seeds result_status as 'open' — a brand new trade is never closed", () => {
    const out = buildExecutedTradeFromSignal(makeSignal(), baseForm, makeAccount());
    expect(out.result_status).toBe("open");
  });

  it("drops later signal edits — re-running the helper with a mutated signal does not rewrite an earlier trade", () => {
    const signal = makeSignal();
    const tradeA = buildExecutedTradeFromSignal(signal, baseForm, makeAccount());

    // Signal is later edited (confidence dropped, reasoning updated)
    signal.confidence = 30;
    signal.ai_reasoning = "Setup invalidated — pattern broke down.";
    signal.stop_loss = 1.0700;

    // A second trade built from the mutated signal gets the new values…
    const tradeB = buildExecutedTradeFromSignal(signal, baseForm, makeAccount());
    expect(tradeB.planned_confidence).toBe(30);
    expect(tradeB.planned_stop_loss).toBe(1.0700);

    // …but the first trade's snapshotted payload is unchanged,
    // because the helper did not hold a reference, it copied.
    expect(tradeA.planned_confidence).toBe(78);
    expect(tradeA.planned_stop_loss).toBe(1.0760);
  });
});

// ── account mode separation ─────────────────────────────────────

describe("buildExecutedTradeFromSignal — account mode", () => {
  it("denormalizes the account's mode onto the trade row", () => {
    const real = buildExecutedTradeFromSignal(
      makeSignal(),
      baseForm,
      makeAccount({ account_mode: "real" } as TradingAccount),
    );
    expect(real.account_mode).toBe("real");

    const demo = buildExecutedTradeFromSignal(
      makeSignal(),
      baseForm,
      makeAccount({ account_mode: "demo" } as TradingAccount),
    );
    expect(demo.account_mode).toBe("demo");
  });

  it("falls back to 'demo' when the account has no mode (legacy row)", () => {
    const out = buildExecutedTradeFromSignal(makeSignal(), baseForm, {
      id: "acct-legacy",
      account_mode: null as unknown as string,
    });
    expect(out.account_mode).toBe("demo");
  });
});

// ── manual trade variant ────────────────────────────────────────

describe("buildManualExecutedTrade", () => {
  it("returns null for every planned_* field and no signal_id", () => {
    const out = buildManualExecutedTrade(baseForm, makeAccount());
    expect(out.signal_id).toBeNull();
    expect(out.planned_entry_low).toBeNull();
    expect(out.planned_entry_high).toBeNull();
    expect(out.planned_stop_loss).toBeNull();
    expect(out.planned_take_profit_1).toBeNull();
    expect(out.planned_take_profit_2).toBeNull();
    expect(out.planned_confidence).toBeNull();
    expect(out.planned_setup_type).toBeNull();
    expect(out.planned_timeframe).toBeNull();
    expect(out.planned_reasoning_snapshot).toBeNull();
  });

  it("still carries actual execution + account fields through", () => {
    const out = buildManualExecutedTrade(baseForm, makeAccount({ account_mode: "real" } as TradingAccount));
    expect(out.account_id).toBe("acct-1");
    expect(out.account_mode).toBe("real");
    expect(out.actual_entry_price).toBe(baseForm.actualEntryPrice);
    expect(out.result_status).toBe("open");
  });
});

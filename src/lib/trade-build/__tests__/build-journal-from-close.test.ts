import { describe, it, expect } from "vitest";
import { buildJournalFromClose } from "@/lib/trade-build/build-journal-from-close";
import type { ExecutedTrade } from "@/types/trading";
import type { TradePnlOutput } from "@/lib/trade-pnl";

// Phase 18.9: guards the "journal auto-prefill" contract. A
// regression in this helper would let close-dialog review inputs
// drift from what the user actually sees in their journal after
// clicking Close & Journal, which is a data quality bug.

function makeTrade(overrides: Partial<ExecutedTrade> = {}): ExecutedTrade {
  return {
    id: "trade-1",
    user_id: "u",
    account_id: "acct-1",
    account_mode: "real",
    signal_id: "sig-1",
    symbol: "EUR/USD",
    direction: "long",
    planned_entry_low: 1.0800,
    planned_entry_high: 1.0810,
    planned_stop_loss: 1.0760,
    planned_take_profit_1: 1.0905,
    planned_take_profit_2: 1.0945,
    planned_confidence: 78,
    planned_setup_type: "bullish_flag_breakout",
    planned_timeframe: "H1",
    planned_reasoning_snapshot: "H1 bull flag after impulsive move.",
    actual_entry_price: 1.0808,
    actual_stop_loss: 1.0760,
    actual_take_profit: 1.0905,
    actual_exit_price: null,
    lot_size: 0.1,
    position_size: null,
    opened_at: "2026-04-10T10:00:00Z",
    closed_at: null,
    result_status: "open",
    pnl: null,
    pnl_percent: null,
    broker_position_id: null,
    notes: null,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T10:00:00Z",
    ...overrides,
  };
}

const cleanReview = {
  followedPlan: true,
  lessonLearned: "",
  emotionBefore: "",
  emotionAfter: "",
  setupRating: 0,
  executionRating: 0,
  disciplineRating: 0,
  mistakeTags: [],
  screenshotBefore: "",
  screenshotAfter: "",
  closeNotes: "",
};

const winPnl: TradePnlOutput = {
  pips: 97,
  pnlUsd: 97,
  pnlPercent: 0.01,
  resultStatus: "win",
};

describe("buildJournalFromClose — snapshot correctness", () => {
  it("copies every planned_* field from the trade into the journal", () => {
    const trade = makeTrade();
    const out = buildJournalFromClose({
      trade,
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });

    expect(out.executed_trade_id).toBe("trade-1");
    expect(out.pair).toBe(trade.symbol);
    expect(out.direction).toBe(trade.direction);
    expect(out.setup_type).toBe(trade.planned_setup_type);
    expect(out.confidence).toBe(trade.planned_confidence);
    expect(out.setup_reasoning).toBe(trade.planned_reasoning_snapshot);
  });

  it("copies actual execution fields from the trade (not the form)", () => {
    const trade = makeTrade({
      actual_entry_price: 1.0808,
      actual_stop_loss: 1.0760,
      actual_take_profit: 1.0905,
      lot_size: 0.1,
    });
    const out = buildJournalFromClose({
      trade,
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.entry_price).toBe(1.0808);
    expect(out.stop_loss).toBe(1.0760);
    expect(out.take_profit).toBe(1.0905);
    expect(out.lot_size).toBe(0.1);
  });

  it("persists the exit price that was just entered at close time", () => {
    const out = buildJournalFromClose({
      trade: makeTrade(),
      review: cleanReview,
      actualExitPrice: 1.0912,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.exit_price).toBe(1.0912);
  });

  it("rounds result_pips to 1 decimal and result_amount to 2 decimals", () => {
    const out = buildJournalFromClose({
      trade: makeTrade(),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: {
        pips: 97.8421,
        pnlUsd: 97.84213,
        pnlPercent: 0.01,
        resultStatus: "win",
      },
    });
    expect(out.result_pips).toBe(97.8);
    expect(out.result_amount).toBe(97.84);
  });

  it("propagates status='closed' and both timestamps", () => {
    const out = buildJournalFromClose({
      trade: makeTrade({ opened_at: "2026-04-10T10:00:00Z" }),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.status).toBe("closed");
    expect(out.opened_at).toBe("2026-04-10T10:00:00Z");
    expect(out.closed_at).toBe("2026-04-10T14:30:00Z");
  });
});

describe("buildJournalFromClose — review field propagation", () => {
  it("carries structured review fields into the journal row", () => {
    const out = buildJournalFromClose({
      trade: makeTrade(),
      review: {
        followedPlan: false,
        lessonLearned: "Wait for the retest next time.",
        emotionBefore: "anxious",
        emotionAfter: "frustrated",
        setupRating: 4,
        executionRating: 2,
        disciplineRating: 3,
        mistakeTags: ["fomo_entry", "moved_stop_loss"],
        screenshotBefore: "https://s3/before.png",
        screenshotAfter: "https://s3/after.png",
        closeNotes: "Price overshot before retracing.",
      },
      actualExitPrice: 1.0760,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: {
        pips: -48,
        pnlUsd: -48,
        pnlPercent: -0.005,
        resultStatus: "loss",
      },
    });

    expect(out.followed_plan).toBe(false);
    expect(out.lesson_learned).toBe("Wait for the retest next time.");
    expect(out.emotion_before).toBe("anxious");
    expect(out.emotion_after).toBe("frustrated");
    expect(out.setup_rating).toBe(4);
    expect(out.execution_rating).toBe(2);
    expect(out.discipline_rating).toBe(3);
    expect(out.mistake_tags).toEqual(["fomo_entry", "moved_stop_loss"]);
    expect(out.screenshot_before).toBe("https://s3/before.png");
    expect(out.screenshot_after).toBe("https://s3/after.png");
    expect(out.notes).toBe("Price overshot before retracing.");
  });

  it("normalizes empty-string text fields to null", () => {
    const out = buildJournalFromClose({
      trade: makeTrade(),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.lesson_learned).toBeNull();
    expect(out.emotion_before).toBeNull();
    expect(out.emotion_after).toBeNull();
    expect(out.screenshot_before).toBeNull();
    expect(out.screenshot_after).toBeNull();
    expect(out.notes).toBeNull();
  });

  it("normalizes zero ratings to null so null stars beat zero stars", () => {
    const out = buildJournalFromClose({
      trade: makeTrade(),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.setup_rating).toBeNull();
    expect(out.execution_rating).toBeNull();
    expect(out.discipline_rating).toBeNull();
  });
});

describe("buildJournalFromClose — account mode + linking", () => {
  it("propagates the trade's account_mode snapshot into the journal row", () => {
    const demo = buildJournalFromClose({
      trade: makeTrade({ account_mode: "demo" }),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(demo.account_mode).toBe("demo");

    const real = buildJournalFromClose({
      trade: makeTrade({ account_mode: "real" }),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(real.account_mode).toBe("real");
  });

  it("links the journal entry to the executed trade via executed_trade_id", () => {
    const out = buildJournalFromClose({
      trade: makeTrade({ id: "trade-xyz" }),
      review: cleanReview,
      actualExitPrice: 1.0905,
      closedAt: "2026-04-10T14:30:00Z",
      pnl: winPnl,
    });
    expect(out.executed_trade_id).toBe("trade-xyz");
  });
});

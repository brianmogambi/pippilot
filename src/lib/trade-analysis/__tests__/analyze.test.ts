import { describe, it, expect } from "vitest";
import { analyzeTrade } from "@/lib/trade-analysis/analyze";
import type { TradeAnalysisInput } from "@/lib/trade-analysis/types";

/**
 * Build a "canonical plan-following long trade on EUR/USD" that we
 * can perturb one field at a time to exercise each rule. The base
 * scenario has:
 *   planned zone: 1.0800–1.0810
 *   planned SL:   1.0760  (50-pip risk from midpoint 1.0805)
 *   planned TP1:  1.0905  (2R target)
 *   actual entry: 1.0805  (inside zone)
 *   actual SL:    1.0760  (exactly plan)
 *   actual TP:    1.0905  (exactly plan)
 *   result:       open    (override in each test)
 *   signal:       linked, plannedConfidence 75
 */
function baseLong(overrides: Partial<TradeAnalysisInput> = {}): TradeAnalysisInput {
  return {
    direction: "long",
    pair: "EUR/USD",
    plannedEntryLow: 1.0800,
    plannedEntryHigh: 1.0810,
    plannedStopLoss: 1.0760,
    plannedTakeProfit1: 1.0905,
    plannedConfidence: 75,
    actualEntry: 1.0805,
    actualStopLoss: 1.0760,
    actualTakeProfit: 1.0905,
    actualExit: null,
    resultStatus: "open",
    signalLinked: true,
    followedPlan: null,
    mistakeTags: [],
    liveSignalStatus: "active",
    ...overrides,
  };
}

describe("analyzeTrade — base scenarios", () => {
  it("clean win matching the plan is classified won_per_plan with high scores", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "win",
        actualExit: 1.0905,
        followedPlan: true,
      }),
    );
    expect(out.primaryOutcomeReason).toBe("won_per_plan");
    expect(out.flags).toContain("followed_plan");
    expect(out.flags).not.toContain("deviated_from_plan");
    expect(out.executionQualityScore).toBe(100);
    expect(out.signalQualityScore).toBeGreaterThanOrEqual(80);
  });

  it("clean loss matching the plan is setup_failed_normally, not a mistake", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: true,
      }),
    );
    expect(out.primaryOutcomeReason).toBe("lost_per_plan");
    expect(out.flags).toContain("setup_failed_normally");
    expect(out.flags).not.toContain("probable_execution_error");
    // Execution was perfect despite the loss
    expect(out.executionQualityScore).toBe(100);
    // Signal takes a hit for failing on its own merits
    expect(out.signalQualityScore).toBeLessThan(75);
  });

  it("open trades are classified trade_not_yet_closed with no comparison flags", () => {
    const out = analyzeTrade(baseLong({ resultStatus: "open" }));
    expect(out.primaryOutcomeReason).toBe("trade_not_yet_closed");
    expect(out.flags).not.toContain("late_entry");
    expect(out.flags).not.toContain("setup_failed_normally");
  });

  it("breakeven trades use the breakeven outcome bucket", () => {
    const out = analyzeTrade(
      baseLong({ resultStatus: "breakeven", actualExit: 1.0805 }),
    );
    expect(out.primaryOutcomeReason).toBe("breakeven");
  });

  it("cancelled trades short-circuit outcome classification", () => {
    const out = analyzeTrade(baseLong({ resultStatus: "cancelled" }));
    expect(out.primaryOutcomeReason).toBe("cancelled");
  });
});

describe("analyzeTrade — entry drift rules", () => {
  it("fires late_entry on a long when the fill is well above the planned zone high", () => {
    // Planned risk ≈ 0.0045; 20% of that ≈ 0.0009. Drift 0.0030 > tolerance.
    const out = analyzeTrade(
      baseLong({
        actualEntry: 1.0840,
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: false,
      }),
    );
    expect(out.flags).toContain("late_entry");
    expect(out.flags).toContain("deviated_from_plan");
    expect(out.primaryOutcomeReason).toBe("lost_to_execution_drift");
    // probable_execution_error should also fire on a losing late entry
    expect(out.flags).toContain("probable_execution_error");
    expect(out.executionQualityScore).toBeLessThan(100);
  });

  it("fires late_entry on a short when the fill is well below the planned zone low", () => {
    const out = analyzeTrade({
      ...baseLong(),
      direction: "short",
      plannedEntryLow: 1.2700,
      plannedEntryHigh: 1.2710,
      plannedStopLoss: 1.2760,
      plannedTakeProfit1: 1.2600,
      actualEntry: 1.2670,
      actualStopLoss: 1.2760,
      actualTakeProfit: 1.2600,
      resultStatus: "loss",
      actualExit: 1.2760,
    });
    expect(out.flags).toContain("late_entry");
  });

  it("fires early_entry when a long fills below the planned zone low", () => {
    const out = analyzeTrade(
      baseLong({
        actualEntry: 1.0780,
        resultStatus: "win",
        actualExit: 1.0905,
      }),
    );
    expect(out.flags).toContain("early_entry");
  });

  it("does not fire late_entry for fills inside the planned zone", () => {
    const out = analyzeTrade(baseLong({ actualEntry: 1.0807 }));
    expect(out.flags).not.toContain("late_entry");
    expect(out.flags).not.toContain("early_entry");
  });

  it("does not fire entry drift rules on manual trades without a plan", () => {
    const out = analyzeTrade({
      direction: "long",
      pair: "EUR/USD",
      plannedEntryLow: null,
      plannedEntryHigh: null,
      plannedStopLoss: null,
      plannedTakeProfit1: null,
      plannedConfidence: null,
      actualEntry: 1.0900,
      actualStopLoss: 1.0850,
      actualTakeProfit: 1.1000,
      actualExit: 1.1000,
      resultStatus: "win",
      signalLinked: false,
    });
    expect(out.flags).not.toContain("late_entry");
    expect(out.flags).not.toContain("early_entry");
    expect(out.primaryOutcomeReason).toBe("manual_no_signal");
    expect(out.signalQualityScore).toBeNull();
  });
});

describe("analyzeTrade — stop distance rules", () => {
  it("fires tighter_stop_than_plan when actual SL is much closer to entry than planned", () => {
    // Planned risk distance 0.0045; actual 0.0015 is <80% of plan.
    const out = analyzeTrade(
      baseLong({
        actualStopLoss: 1.0790,
        resultStatus: "loss",
        actualExit: 1.0790,
      }),
    );
    expect(out.flags).toContain("tighter_stop_than_plan");
  });

  it("fires wider_stop_than_plan when actual SL sits well beyond planned SL", () => {
    const out = analyzeTrade(
      baseLong({
        actualStopLoss: 1.0700,
        resultStatus: "loss",
        actualExit: 1.0700,
      }),
    );
    expect(out.flags).toContain("wider_stop_than_plan");
    // Risk management score should drop
    expect(out.riskManagementScore).toBeLessThan(100);
  });

  it("treats a sell trade's tighter stop correctly (stop closer than plan above entry)", () => {
    const out = analyzeTrade({
      ...baseLong(),
      direction: "short",
      plannedEntryLow: 1.2700,
      plannedEntryHigh: 1.2710,
      plannedStopLoss: 1.2760,
      plannedTakeProfit1: 1.2600,
      actualEntry: 1.2705,
      actualStopLoss: 1.2720,
      actualTakeProfit: 1.2600,
      resultStatus: "loss",
      actualExit: 1.2720,
    });
    expect(out.flags).toContain("tighter_stop_than_plan");
  });
});

describe("analyzeTrade — R:R rules", () => {
  it("fires reduced_rr when actual TP is much closer than planned TP", () => {
    // Planned RR ≈ 2; cutting TP in half gives actualRR ≈ 1.
    const out = analyzeTrade(
      baseLong({
        actualTakeProfit: 1.0855,
        resultStatus: "win",
        actualExit: 1.0855,
      }),
    );
    expect(out.flags).toContain("reduced_rr");
  });

  it("fires improved_rr when actual TP is pushed much further than planned", () => {
    const out = analyzeTrade(
      baseLong({
        actualTakeProfit: 1.1000,
        resultStatus: "win",
        actualExit: 1.1000,
      }),
    );
    expect(out.flags).toContain("improved_rr");
  });
});

describe("analyzeTrade — plan adherence + outcome classification", () => {
  it("won_despite_execution_drift when a late-entry trade still wins", () => {
    const out = analyzeTrade(
      baseLong({
        actualEntry: 1.0845,
        resultStatus: "win",
        actualExit: 1.0905,
      }),
    );
    expect(out.flags).toContain("late_entry");
    expect(out.primaryOutcomeReason).toBe("won_despite_execution_drift");
  });

  it("signal_invalidated takes precedence over plan-based classification", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        liveSignalStatus: "invalidated",
      }),
    );
    expect(out.flags).toContain("signal_invalidated");
    expect(out.primaryOutcomeReason).toBe("signal_invalidated");
    // setup_failed_normally must NOT fire on an invalidated signal
    expect(out.flags).not.toContain("setup_failed_normally");
  });

  it("deviates when the trader self-reports followed_plan=false even with no drift flags", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "win",
        actualExit: 1.0905,
        followedPlan: false,
      }),
    );
    expect(out.flags).toContain("deviated_from_plan");
    expect(out.flags).not.toContain("followed_plan");
  });
});

describe("analyzeTrade — scoring", () => {
  it("discipline score drops with self-reported deviation and mistake tags", () => {
    const clean = analyzeTrade(
      baseLong({ resultStatus: "win", actualExit: 1.0905, followedPlan: true }),
    );
    const messy = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: false,
        mistakeTags: ["fomo_entry", "oversized"],
      }),
    );
    expect(clean.disciplineScore).toBe(100);
    expect(messy.disciplineScore).toBeLessThan(60);
  });

  it("risk management score drops when risk rules are ignored", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualStopLoss: 1.0700, // 100 pips — much wider than the 45-pip plan
        actualExit: 1.0700,
        mistakeTags: ["oversized", "ignored_risk_rules"],
      }),
    );
    // wider_stop (-25) + oversized (-15) + ignored_risk_rules (-20) = -60
    expect(out.flags).toContain("wider_stop_than_plan");
    expect(out.riskManagementScore).toBeLessThanOrEqual(40);
  });

  it("manual trades return null for signal and execution quality scores", () => {
    const out = analyzeTrade({
      direction: "long",
      pair: "EUR/USD",
      plannedEntryLow: null,
      plannedEntryHigh: null,
      plannedStopLoss: null,
      plannedTakeProfit1: null,
      plannedConfidence: null,
      actualEntry: 1.0900,
      actualStopLoss: 1.0850,
      actualTakeProfit: 1.1000,
      actualExit: 1.1000,
      resultStatus: "win",
      signalLinked: false,
    });
    expect(out.signalQualityScore).toBeNull();
    expect(out.executionQualityScore).toBeNull();
    // discipline + risk management still scored
    expect(out.disciplineScore).not.toBeNull();
    expect(out.riskManagementScore).not.toBeNull();
  });
});

describe("analyzeTrade — improvement actions", () => {
  it("produces late-entry coaching text on a losing late entry", () => {
    const out = analyzeTrade(
      baseLong({
        actualEntry: 1.0840,
        resultStatus: "loss",
        actualExit: 1.0760,
      }),
    );
    expect(out.improvementActions.join(" ")).toContain("entry zone");
  });

  it("produces no-change coaching text for an in-plan loss", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: true,
      }),
    );
    expect(out.improvementActions.join(" ")).toContain("in-plan loss");
  });

  it("includes mistake-tag-driven coaching when the user flagged revenge trading", () => {
    const out = analyzeTrade(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        mistakeTags: ["revenge_trade"],
      }),
    );
    expect(out.improvementActions.join(" ")).toContain("revenge");
  });
});

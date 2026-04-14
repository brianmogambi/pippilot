import { describe, it, expect } from "vitest";
import { analyzeTrade } from "@/lib/trade-analysis/analyze";
import {
  describeDriftFlags,
  describeSignalQuality,
  summarizeAnalysis,
  summarizeAnalysisOutput,
  type SummarizeAnalysisInput,
} from "@/lib/trade-analysis/summarize";
import type { TradeAnalysisInput } from "@/lib/trade-analysis/types";

// Reuse the same canonical EUR/USD long fixture from the engine
// tests. Keeping the two test suites independent means a regression
// in the rule engine surfaces in analyze.test.ts and a regression
// in the summarizer surfaces here.
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

describe("describeDriftFlags", () => {
  it("returns empty string when no drift flags are present", () => {
    expect(describeDriftFlags([])).toBe("");
  });

  it("renders a single flag as a single clause", () => {
    expect(describeDriftFlags(["late_entry"])).toContain(
      "executed entry was worse",
    );
  });

  it("joins two flags with 'and'", () => {
    const out = describeDriftFlags(["late_entry", "tighter_stop_than_plan"]);
    expect(out).toContain("executed entry was worse");
    expect(out).toContain("stop loss was tighter");
    expect(out).toContain(" and ");
  });

  it("uses Oxford-comma style for three or more flags", () => {
    const out = describeDriftFlags([
      "late_entry",
      "tighter_stop_than_plan",
      "reduced_rr",
    ]);
    expect(out.match(/,/g)?.length).toBeGreaterThanOrEqual(1);
    expect(out).toContain(", and ");
  });

  it("ignores non-drift flags such as followed_plan", () => {
    expect(describeDriftFlags(["followed_plan", "late_entry"])).toContain(
      "executed entry was worse",
    );
    expect(describeDriftFlags(["followed_plan"])).toBe("");
  });
});

describe("describeSignalQuality", () => {
  it("returns null for manual trades", () => {
    expect(describeSignalQuality(null)).toBeNull();
  });

  it("classifies into three confidence tiers", () => {
    expect(describeSignalQuality(85)).toBe("high-confidence");
    expect(describeSignalQuality(60)).toBe("moderate-confidence");
    expect(describeSignalQuality(30)).toBe("low-confidence");
  });
});

describe("summarizeAnalysis — outcome buckets", () => {
  function summaryFor(input: TradeAnalysisInput) {
    return summarizeAnalysisOutput(analyzeTrade(input));
  }

  it("produces a clean-win summary for a fully plan-following winner", () => {
    const s = summaryFor(
      baseLong({
        resultStatus: "win",
        actualExit: 1.0905,
        followedPlan: true,
      }),
    );
    expect(s.headline).toContain("Clean win");
    expect(s.body).toContain("matched the plan");
    // No execution-drift coaching when the trade was clean
    expect(s.body).not.toContain("worse than the planned entry");
  });

  it("produces a 'won despite drift' summary when a late entry still wins", () => {
    const s = summaryFor(
      baseLong({
        actualEntry: 1.0840,
        resultStatus: "win",
        actualExit: 1.0905,
      }),
    );
    expect(s.headline).toContain("Won despite execution drift");
    expect(s.body).toContain("executed entry was worse");
  });

  it("produces an in-plan-loss summary that explicitly says no execution change is needed", () => {
    const s = summaryFor(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: true,
      }),
    );
    expect(s.headline).toContain("In-plan loss");
    expect(s.body).toContain("normal in-plan loss");
    expect(s.body).toContain("no change is needed");
  });

  it("produces an execution-drift loss summary that pins the cause on the user, not the signal", () => {
    const s = summaryFor(
      baseLong({
        actualEntry: 1.0840,
        resultStatus: "loss",
        actualExit: 1.0760,
        followedPlan: false,
      }),
    );
    expect(s.headline).toContain("driven by execution");
    expect(s.body).toContain("signal itself was reasonable");
    expect(s.body).toContain("executed entry was worse");
  });

  it("produces a signal-invalidated summary when liveSignalStatus is invalidated", () => {
    const s = summaryFor(
      baseLong({
        resultStatus: "loss",
        actualExit: 1.0760,
        liveSignalStatus: "invalidated",
      }),
    );
    expect(s.headline).toContain("invalidated");
    expect(s.body).toContain("invalidation condition");
  });

  it("produces a breakeven summary that does not scold", () => {
    const s = summaryFor(
      baseLong({ resultStatus: "breakeven", actualExit: 1.0805 }),
    );
    expect(s.headline).toContain("Breakeven");
    expect(s.body).toContain("No execution change is needed");
  });

  it("produces a manual-trade summary when no signal was linked", () => {
    const s = summaryFor({
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
    expect(s.headline).toContain("Manual");
    expect(s.body).toContain("discretionary");
    // No "this signal" claims for a manual trade
    expect(s.body).not.toContain("this signal");
  });

  it("produces an open-trade summary with no review yet", () => {
    const s = summaryFor(baseLong({ resultStatus: "open" }));
    expect(s.headline).toContain("still open");
    expect(s.body).toContain("once you close");
  });

  it("produces a cancelled summary that does not raise concerns", () => {
    const s = summaryFor(baseLong({ resultStatus: "cancelled" }));
    expect(s.headline).toContain("cancelled");
    expect(s.body).toContain("No execution review");
  });
});

describe("summarizeAnalysis — nextAction", () => {
  it("returns the first improvement action when present", () => {
    const out = analyzeTrade(
      baseLong({
        actualEntry: 1.0840,
        resultStatus: "loss",
        actualExit: 1.0760,
      }),
    );
    const s = summarizeAnalysisOutput(out);
    expect(s.nextAction).not.toBeNull();
    expect(s.nextAction).toBe(out.improvementActions[0]);
  });

  it("returns null when no improvement actions exist (clean win)", () => {
    const s = summarizeAnalysisOutput(
      analyzeTrade(
        baseLong({
          resultStatus: "win",
          actualExit: 1.0905,
          followedPlan: true,
        }),
      ),
    );
    // A clean win has no coaching actions
    expect(s.nextAction).toBeNull();
  });
});

describe("summarizeAnalysis — confidence tier framing", () => {
  it("describes a high-confidence signal as such", () => {
    const input: SummarizeAnalysisInput = {
      flags: ["followed_plan"],
      primaryOutcomeReason: "won_per_plan",
      signalQualityScore: 85,
      executionQualityScore: 100,
      improvementActions: [],
    };
    const s = summarizeAnalysis(input);
    expect(s.body).toContain("high-confidence");
  });

  it("describes a moderate-confidence signal as such", () => {
    const input: SummarizeAnalysisInput = {
      flags: ["followed_plan"],
      primaryOutcomeReason: "won_per_plan",
      signalQualityScore: 60,
      executionQualityScore: 100,
      improvementActions: [],
    };
    const s = summarizeAnalysis(input);
    expect(s.body).toContain("moderate-confidence");
  });

  it("omits the confidence tier entirely when null (manual trade)", () => {
    const input: SummarizeAnalysisInput = {
      flags: [],
      primaryOutcomeReason: "manual_no_signal",
      signalQualityScore: null,
      executionQualityScore: null,
      improvementActions: [],
    };
    const s = summarizeAnalysis(input);
    expect(s.body).not.toMatch(/(high|moderate|low)-confidence/);
  });
});

describe("summarizeAnalysis — fake-certainty discipline", () => {
  it("hedges loss attribution with 'appears' or 'likely', never absolute", () => {
    const s = summarizeAnalysisOutput(
      analyzeTrade(
        baseLong({
          actualEntry: 1.0840,
          resultStatus: "loss",
          actualExit: 1.0760,
        }),
      ),
    );
    const body = s.body.toLowerCase();
    // Every loss-attribution sentence we generate should hedge.
    const hedged =
      body.includes("appears") || body.includes("likely") || body.includes("suggests");
    expect(hedged).toBe(true);
    // And it should never claim the trade "definitely" or "certainly" lost
    // because of execution.
    expect(body).not.toMatch(/(definitely|certainly|always|never)/);
  });

  it("frames an in-plan loss as 'not an execution mistake' rather than scolding", () => {
    const s = summarizeAnalysisOutput(
      analyzeTrade(
        baseLong({
          resultStatus: "loss",
          actualExit: 1.0760,
          followedPlan: true,
        }),
      ),
    );
    // Body must explicitly negate the "you made a mistake" framing.
    expect(s.body).toContain("rather than an execution mistake");
    // And must not contain accusatory verbs like "you did wrong"
    // or "you should have".
    expect(s.body.toLowerCase()).not.toContain("you should have");
    expect(s.body.toLowerCase()).not.toContain("you did wrong");
  });
});

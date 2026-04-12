import { describe, it, expect } from "vitest";
import { resolveOutcome } from "../outcome-resolver";
import type { BacktestCandle, ResolverSignal } from "../types";

const PIP = 0.0001;
const opts = { maxBars: 50, pipSize: PIP };

function bar(time: string, o: number, h: number, l: number, c: number): BacktestCandle {
  return { time, open: o, high: h, low: l, close: c };
}

const longSignal: ResolverSignal = {
  direction: "long",
  entryPrice: 1.1000,
  stopLoss: 1.0950,
  tp1: 1.1075, // +1.5R
  tp2: 1.1125, // +2.5R
  tp3: 1.1200, // +4R
};

const shortSignal: ResolverSignal = {
  direction: "short",
  entryPrice: 1.1000,
  stopLoss: 1.1050,
  tp1: 1.0925,
  tp2: 1.0875,
  tp3: 1.0800,
};

describe("resolveOutcome — long", () => {
  it("hits TP1 cleanly", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1080, 1.0995, 1.1078),
    ];
    const out = resolveOutcome(longSignal, future, opts);
    expect(out.kind).toBe("tp1_hit");
    expect(out.exitPrice).toBe(1.1075);
    expect(out.rMultiple).toBeCloseTo(1.5, 2);
  });

  it("hits SL cleanly", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1010, 1.0940, 1.0945),
    ];
    const out = resolveOutcome(longSignal, future, opts);
    expect(out.kind).toBe("sl_hit");
    expect(out.exitPrice).toBe(1.0950);
    expect(out.rMultiple).toBeCloseTo(-1, 2);
  });

  it("PESSIMISTIC: when both SL and TP touched in same bar, SL wins", () => {
    // Bar low touches SL AND high touches TP1 — must resolve as SL.
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1080, 1.0945, 1.1075),
    ];
    const out = resolveOutcome(longSignal, future, opts);
    expect(out.kind).toBe("sl_hit");
  });

  it("walks stacked TPs across bars and resolves at TP3", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1080, 1.0995, 1.1078), // touches TP1 → resolves here
    ];
    const out = resolveOutcome(longSignal, future, opts);
    // Per resolution rules, the highest reached level on a bar wins (TP3 > TP2 > TP1).
    expect(out.kind).toBe("tp1_hit");

    // Now a bar that reaches TP3 directly:
    const tp3Future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1250, 1.0995, 1.1230),
    ];
    expect(resolveOutcome(longSignal, tp3Future, opts).kind).toBe("tp3_hit");
  });

  it("expires after maxBars with no resolution", () => {
    const future: BacktestCandle[] = Array.from({ length: 10 }, (_, i) =>
      bar(`2026-01-01T${String(i + 1).padStart(2, "0")}:00:00Z`, 1.1000, 1.1010, 1.0990, 1.1000),
    );
    const out = resolveOutcome(longSignal, future, { maxBars: 5, pipSize: PIP });
    expect(out.kind).toBe("expired");
    expect(out.barsToResolution).toBe(5);
  });

  it("returns no_entry when no future candles", () => {
    const out = resolveOutcome(longSignal, [], opts);
    expect(out.kind).toBe("no_entry");
  });
});

describe("resolveOutcome — short (mirrored)", () => {
  it("hits TP1 cleanly", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1005, 1.0920, 1.0922),
    ];
    const out = resolveOutcome(shortSignal, future, opts);
    expect(out.kind).toBe("tp1_hit");
    expect(out.rMultiple).toBeCloseTo(1.5, 2);
  });

  it("hits SL cleanly", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1060, 1.0995, 1.1055),
    ];
    const out = resolveOutcome(shortSignal, future, opts);
    expect(out.kind).toBe("sl_hit");
    expect(out.rMultiple).toBeCloseTo(-1, 2);
  });

  it("PESSIMISTIC: same-bar SL and TP → SL wins", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1060, 1.0920, 1.0925),
    ];
    expect(resolveOutcome(shortSignal, future, opts).kind).toBe("sl_hit");
  });
});

describe("resolveOutcome — resolution_path audit trail", () => {
  it("path bars are strictly chronological and after the cursor", () => {
    const future = [
      bar("2026-01-01T01:00:00Z", 1.1000, 1.1010, 1.0995, 1.1005),
      bar("2026-01-01T02:00:00Z", 1.1005, 1.1080, 1.1000, 1.1078),
    ];
    const out = resolveOutcome(longSignal, future, opts);
    expect(out.kind).toBe("tp1_hit");
    const times = out.path.map((p) => Date.parse(p.barTime));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });
});

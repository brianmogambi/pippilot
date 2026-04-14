import { describe, it, expect } from "vitest";
import { computeTradePnl } from "@/lib/trade-pnl";

describe("computeTradePnl", () => {
  describe("pip math", () => {
    it("computes positive pips for a winning long trade on a non-JPY pair", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0850,
      });
      expect(Math.round(out.pips * 10) / 10).toBe(50);
      expect(out.resultStatus).toBe("win");
    });

    it("computes positive pips for a winning short trade on a non-JPY pair", () => {
      const out = computeTradePnl({
        direction: "short",
        pair: "GBP/USD",
        entryPrice: 1.2700,
        exitPrice: 1.2680,
      });
      expect(Math.round(out.pips * 10) / 10).toBe(20);
      expect(out.resultStatus).toBe("win");
    });

    it("computes negative pips for a losing long trade", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0750,
      });
      expect(Math.round(out.pips * 10) / 10).toBe(-50);
      expect(out.resultStatus).toBe("loss");
    });

    it("uses JPY pip multiplier for JPY pairs", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "USD/JPY",
        entryPrice: 150.00,
        exitPrice: 150.50,
      });
      expect(Math.round(out.pips * 10) / 10).toBe(50);
    });
  });

  describe("result_status classification", () => {
    it("classifies a clean breakeven exit as breakeven, not loss", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0800,
      });
      expect(out.pips).toBe(0);
      expect(out.resultStatus).toBe("breakeven");
    });

    it("classifies a 0.05-pip drift as breakeven, not loss", () => {
      // Tolerance is 0.1 pip; 0.05 pip drift should not flip classification.
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.08000,
        exitPrice: 1.079995,
      });
      expect(Math.abs(out.pips)).toBeLessThan(0.1);
      expect(out.resultStatus).toBe("breakeven");
    });
  });

  describe("pnlUsd / pnlPercent", () => {
    it("computes pnl_usd when lot size and pip value are provided", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0850,
        lotSize: 0.1,
        pipValueUsdPerLot: 10,
      });
      // 50 pips * 0.1 lots * $10/pip/lot = $50
      expect(out.pnlUsd).toBeCloseTo(50, 5);
    });

    it("returns null pnl_usd when lot size is missing", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0850,
        pipValueUsdPerLot: 10,
      });
      expect(out.pnlUsd).toBeNull();
    });

    it("computes pnl_percent when balance is provided", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0850,
        lotSize: 0.1,
        pipValueUsdPerLot: 10,
        accountBalance: 10000,
      });
      // $50 / $10000 = 0.005 = 0.5%
      expect(out.pnlPercent).toBeCloseTo(0.005, 5);
    });

    it("returns null pnl_percent when balance is zero", () => {
      const out = computeTradePnl({
        direction: "long",
        pair: "EUR/USD",
        entryPrice: 1.0800,
        exitPrice: 1.0850,
        lotSize: 0.1,
        pipValueUsdPerLot: 10,
        accountBalance: 0,
      });
      expect(out.pnlPercent).toBeNull();
    });
  });
});

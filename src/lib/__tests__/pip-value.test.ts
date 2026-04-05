import { describe, it, expect } from "vitest";
import { calculatePipValueUSD, getDefaultPipValueUSD, pipMultiplier, isJpyPair } from "../pip-value";

const prices: Record<string, number> = {
  "EUR/USD": 1.0872,
  "GBP/USD": 1.2715,
  "AUD/USD": 0.6300,
  "NZD/USD": 0.5700,
  "USD/JPY": 154.82,
  "USD/CAD": 1.3642,
  "USD/CHF": 0.8845,
  "EUR/GBP": 0.8552,
  "GBP/JPY": 196.78,
  "EUR/JPY": 168.30,
  "AUD/JPY": 97.54,
  "CHF/JPY": 175.04,
  "EUR/AUD": 1.7257,
  "GBP/AUD": 2.0183,
  "EUR/CAD": 1.4832,
  "USD/CHF": 0.8845,
  "XAU/USD": 2350.00,
};

describe("pipMultiplier", () => {
  it("returns 100 for JPY pairs", () => {
    expect(pipMultiplier("USD/JPY")).toBe(100);
    expect(pipMultiplier("GBP/JPY")).toBe(100);
    expect(pipMultiplier("EUR/JPY")).toBe(100);
  });

  it("returns 10000 for non-JPY pairs", () => {
    expect(pipMultiplier("EUR/USD")).toBe(10000);
    expect(pipMultiplier("GBP/USD")).toBe(10000);
    expect(pipMultiplier("EUR/GBP")).toBe(10000);
  });
});

describe("isJpyPair", () => {
  it("detects JPY pairs", () => {
    expect(isJpyPair("USD/JPY")).toBe(true);
    expect(isJpyPair("EUR/USD")).toBe(false);
    expect(isJpyPair("XAU/USD")).toBe(false);
  });
});

describe("calculatePipValueUSD", () => {
  it("USD-quoted pairs return exactly $10", () => {
    expect(calculatePipValueUSD("EUR/USD", prices)).toBe(10);
    expect(calculatePipValueUSD("GBP/USD", prices)).toBe(10);
    expect(calculatePipValueUSD("AUD/USD", prices)).toBe(10);
    expect(calculatePipValueUSD("NZD/USD", prices)).toBe(10);
  });

  it("USD/JPY pip value is ~$6.46", () => {
    const value = calculatePipValueUSD("USD/JPY", prices)!;
    // 0.01 * 100000 / 154.82 ≈ 6.459
    expect(value).toBeCloseTo(6.46, 1);
  });

  it("USD/CAD pip value is ~$7.33", () => {
    const value = calculatePipValueUSD("USD/CAD", prices)!;
    // 0.0001 * 100000 / 1.3642 ≈ 7.33
    expect(value).toBeCloseTo(7.33, 1);
  });

  it("USD/CHF pip value is ~$11.31", () => {
    const value = calculatePipValueUSD("USD/CHF", prices)!;
    // 0.0001 * 100000 / 0.8845 ≈ 11.31
    expect(value).toBeCloseTo(11.31, 1);
  });

  it("JPY crosses use USD/JPY rate for conversion", () => {
    const gbpjpy = calculatePipValueUSD("GBP/JPY", prices)!;
    const eurjpy = calculatePipValueUSD("EUR/JPY", prices)!;
    const audjpy = calculatePipValueUSD("AUD/JPY", prices)!;
    // All JPY crosses: 0.01 * 100000 / 154.82 ≈ 6.46
    expect(gbpjpy).toBeCloseTo(6.46, 1);
    expect(eurjpy).toBeCloseTo(6.46, 1);
    expect(audjpy).toBeCloseTo(6.46, 1);
  });

  it("EUR/GBP uses GBP/USD rate", () => {
    const value = calculatePipValueUSD("EUR/GBP", prices)!;
    // 0.0001 * 100000 * 1.2715 = 12.715
    expect(value).toBeCloseTo(12.72, 1);
  });

  it("AUD-quoted crosses use AUD/USD rate", () => {
    const euraud = calculatePipValueUSD("EUR/AUD", prices)!;
    // 0.0001 * 100000 * 0.6300 = 6.30
    expect(euraud).toBeCloseTo(6.30, 1);
  });

  it("CAD-quoted crosses use USD/CAD inverse", () => {
    const eurcad = calculatePipValueUSD("EUR/CAD", prices)!;
    // 0.0001 * 100000 / 1.3642 ≈ 7.33
    expect(eurcad).toBeCloseTo(7.33, 1);
  });

  it("XAU/USD always returns $1.00", () => {
    expect(calculatePipValueUSD("XAU/USD", prices)).toBe(1.0);
    expect(calculatePipValueUSD("XAU/USD", {})).toBe(1.0);
  });

  it("returns null when required prices are missing", () => {
    expect(calculatePipValueUSD("EUR/GBP", {})).toBeNull();
    expect(calculatePipValueUSD("USD/JPY", {})).toBeNull();
  });
});

describe("getDefaultPipValueUSD", () => {
  it("returns $10 for USD-quoted pairs", () => {
    expect(getDefaultPipValueUSD("EUR/USD")).toBe(10);
    expect(getDefaultPipValueUSD("GBP/USD")).toBe(10);
  });

  it("returns reasonable estimates for other pairs", () => {
    expect(getDefaultPipValueUSD("USD/JPY")).toBeGreaterThan(0);
    expect(getDefaultPipValueUSD("USD/JPY")).toBeLessThan(20);
    expect(getDefaultPipValueUSD("XAU/USD")).toBe(1.0);
  });

  it("returns $10 for unknown pairs as fallback", () => {
    expect(getDefaultPipValueUSD("UNKNOWN/PAIR")).toBe(10);
  });
});

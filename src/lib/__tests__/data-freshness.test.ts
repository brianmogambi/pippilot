import { describe, it, expect } from "vitest";
import { freshnessOf, STALE_THRESHOLD_MS } from "../data-freshness";

describe("freshnessOf", () => {
  const fixedNow = new Date("2026-04-11T12:00:00Z");
  const now = () => fixedNow;

  it("returns 'fallback' when hasData is false regardless of timestamp", () => {
    expect(freshnessOf(fixedNow.toISOString(), false, now)).toBe("fallback");
    expect(freshnessOf(null, false, now)).toBe("fallback");
    expect(freshnessOf(undefined, false, now)).toBe("fallback");
  });

  it("returns 'cached' when hasData is true but updatedAt is missing", () => {
    expect(freshnessOf(null, true, now)).toBe("cached");
    expect(freshnessOf(undefined, true, now)).toBe("cached");
  });

  it("returns 'live' for a recent timestamp (1 min old)", () => {
    const oneMinAgo = new Date(fixedNow.getTime() - 60 * 1000).toISOString();
    expect(freshnessOf(oneMinAgo, true, now)).toBe("live");
  });

  it("returns 'cached' for an old timestamp (1 hour old)", () => {
    const oneHourAgo = new Date(fixedNow.getTime() - 60 * 60 * 1000).toISOString();
    expect(freshnessOf(oneHourAgo, true, now)).toBe("cached");
  });

  it("treats the threshold boundary as cached", () => {
    const exactlyThreshold = new Date(fixedNow.getTime() - STALE_THRESHOLD_MS).toISOString();
    expect(freshnessOf(exactlyThreshold, true, now)).toBe("cached");
  });

  it("accepts a Date instance for updatedAt", () => {
    const recent = new Date(fixedNow.getTime() - 30 * 1000);
    expect(freshnessOf(recent, true, now)).toBe("live");
  });
});

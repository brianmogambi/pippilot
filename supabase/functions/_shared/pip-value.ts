// Pip value calculations for forex pairs.
// Pip value = pipSize * lotSize * quoteToUSDRate
//
// Deno mirror of src/lib/pip-value.ts — keep in sync. See
// docs/ALERT_ENGINE_V2.md for the dual-location rationale.

const STANDARD_LOT = 100_000;
const XAU_LOT = 100; // 100 troy ounces

export const INSTRUMENT_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY",
  "CHF/JPY", "EUR/AUD", "GBP/AUD", "EUR/CAD", "USD/CHF",
  "XAU/USD",
] as const;

export function isJpyPair(pair: string): boolean {
  return pair.includes("JPY");
}

export function pipMultiplier(pair: string): number {
  return isJpyPair(pair) ? 100 : 10000;
}

function pipSize(pair: string): number {
  return isJpyPair(pair) ? 0.01 : 0.0001;
}

function parsePair(pair: string): { base: string; quote: string } {
  const [base, quote] = pair.split("/");
  return { base, quote };
}

function quoteToUSDRate(currency: string, prices: Record<string, number>): number | null {
  if (currency === "USD") return 1;
  const direct = prices[`${currency}/USD`];
  if (direct && direct > 0) return direct;
  const inverse = prices[`USD/${currency}`];
  if (inverse && inverse > 0) return 1 / inverse;
  return null;
}

export function calculatePipValueUSD(
  pair: string,
  prices: Record<string, number>,
): number | null {
  if (pair === "XAU/USD") return 1.0;
  const { quote } = parsePair(pair);
  const rate = quoteToUSDRate(quote, prices);
  if (rate === null) return null;
  return pipSize(pair) * STANDARD_LOT * rate;
}

const DEFAULT_PIP_VALUES: Record<string, number> = {
  "EUR/USD": 10,
  "GBP/USD": 10,
  "AUD/USD": 10,
  "NZD/USD": 10,
  "USD/JPY": 6.45,
  "USD/CAD": 7.33,
  "USD/CHF": 11.30,
  "GBP/JPY": 6.45,
  "EUR/JPY": 6.45,
  "AUD/JPY": 6.45,
  "CHF/JPY": 6.45,
  "EUR/GBP": 12.72,
  "EUR/AUD": 6.30,
  "GBP/AUD": 6.30,
  "EUR/CAD": 7.33,
  "XAU/USD": 1.0,
};

export function getDefaultPipValueUSD(pair: string): number {
  return DEFAULT_PIP_VALUES[pair] ?? 10;
}

// Pip value calculations for forex pairs.
// Pip value = pipSize * lotSize * quoteToUSDRate

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

/**
 * Convert 1 unit of a currency to USD using available prices.
 * Returns null if the required price is not available.
 */
function quoteToUSDRate(currency: string, prices: Record<string, number>): number | null {
  if (currency === "USD") return 1;

  // Try direct: {currency}/USD (e.g. GBP/USD, AUD/USD, NZD/USD, EUR/USD)
  const direct = prices[`${currency}/USD`];
  if (direct && direct > 0) return direct;

  // Try inverse: USD/{currency} (e.g. USD/JPY, USD/CAD, USD/CHF)
  const inverse = prices[`USD/${currency}`];
  if (inverse && inverse > 0) return 1 / inverse;

  return null;
}

/**
 * Calculate pip value in USD per standard lot from live prices.
 * Returns null if required prices are unavailable.
 */
export function calculatePipValueUSD(
  pair: string,
  prices: Record<string, number>,
): number | null {
  // XAU/USD special case: 100 oz * $0.01 pip = $1.00
  if (pair === "XAU/USD") return 1.0;

  const { quote } = parsePair(pair);
  const rate = quoteToUSDRate(quote, prices);
  if (rate === null) return null;

  return pipSize(pair) * STANDARD_LOT * rate;
}

/**
 * Static fallback pip values (approximate) when live data is unavailable.
 * Based on typical market rates as of early 2026.
 */
const DEFAULT_PIP_VALUES: Record<string, number> = {
  // USD-quoted: always $10
  "EUR/USD": 10,
  "GBP/USD": 10,
  "AUD/USD": 10,
  "NZD/USD": 10,
  // USD-base: depends on rate
  "USD/JPY": 6.45,
  "USD/CAD": 7.33,
  "USD/CHF": 11.30,
  // JPY crosses: same rate as USD/JPY conversion
  "GBP/JPY": 6.45,
  "EUR/JPY": 6.45,
  "AUD/JPY": 6.45,
  "CHF/JPY": 6.45,
  // GBP-quoted
  "EUR/GBP": 12.72,
  // AUD-quoted
  "EUR/AUD": 6.30,
  "GBP/AUD": 6.30,
  // CAD-quoted
  "EUR/CAD": 7.33,
  // Gold
  "XAU/USD": 1.0,
};

export function getDefaultPipValueUSD(pair: string): number {
  return DEFAULT_PIP_VALUES[pair] ?? 10;
}

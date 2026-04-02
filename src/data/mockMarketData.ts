export type TrendDirection = "bullish" | "bearish" | "neutral";
export type VolatilityLevel = "Low" | "Med" | "High";
export type SessionName = "London" | "New York" | "Asia" | "Closed";

export interface MarketData {
  symbol: string;
  price: number;
  spread: number;
  dailyChange: number;
  dailyChangePct: number;
  atr: number;
  volatility: VolatilityLevel;
  trendH1: TrendDirection;
  trendH4: TrendDirection;
  trendD1: TrendDirection;
  activeSession: SessionName;
  newsRisk: boolean;
}

export const mockMarketData: Record<string, MarketData> = {
  "EUR/USD": { symbol: "EUR/USD", price: 1.0872, spread: 0.8, dailyChange: 0.0023, dailyChangePct: 0.21, atr: 0.0068, volatility: "Med", trendH1: "bullish", trendH4: "bullish", trendD1: "neutral", activeSession: "London", newsRisk: true },
  "GBP/USD": { symbol: "GBP/USD", price: 1.2715, spread: 1.1, dailyChange: -0.0031, dailyChangePct: -0.24, atr: 0.0092, volatility: "High", trendH1: "bearish", trendH4: "bearish", trendD1: "bearish", activeSession: "London", newsRisk: false },
  "USD/JPY": { symbol: "USD/JPY", price: 154.82, spread: 0.9, dailyChange: 0.45, dailyChangePct: 0.29, atr: 0.85, volatility: "Med", trendH1: "bullish", trendH4: "bullish", trendD1: "bullish", activeSession: "Asia", newsRisk: true },
  "USD/CHF": { symbol: "USD/CHF", price: 0.8845, spread: 1.2, dailyChange: -0.0012, dailyChangePct: -0.14, atr: 0.0055, volatility: "Low", trendH1: "neutral", trendH4: "bearish", trendD1: "neutral", activeSession: "London", newsRisk: false },
  "AUD/USD": { symbol: "AUD/USD", price: 0.6523, spread: 1.0, dailyChange: 0.0018, dailyChangePct: 0.28, atr: 0.0061, volatility: "Med", trendH1: "bullish", trendH4: "neutral", trendD1: "bearish", activeSession: "Asia", newsRisk: false },
  "NZD/USD": { symbol: "NZD/USD", price: 0.5987, spread: 1.4, dailyChange: -0.0008, dailyChangePct: -0.13, atr: 0.0052, volatility: "Low", trendH1: "bearish", trendH4: "neutral", trendD1: "neutral", activeSession: "Asia", newsRisk: false },
  "USD/CAD": { symbol: "USD/CAD", price: 1.3642, spread: 1.3, dailyChange: 0.0035, dailyChangePct: 0.26, atr: 0.0074, volatility: "Med", trendH1: "bullish", trendH4: "bullish", trendD1: "neutral", activeSession: "New York", newsRisk: true },
  "EUR/GBP": { symbol: "EUR/GBP", price: 0.8552, spread: 1.0, dailyChange: 0.0015, dailyChangePct: 0.18, atr: 0.0048, volatility: "Low", trendH1: "bullish", trendH4: "neutral", trendD1: "bullish", activeSession: "London", newsRisk: false },
  "EUR/JPY": { symbol: "EUR/JPY", price: 168.35, spread: 1.5, dailyChange: -0.72, dailyChangePct: -0.43, atr: 1.12, volatility: "High", trendH1: "bearish", trendH4: "bearish", trendD1: "neutral", activeSession: "London", newsRisk: true },
  "GBP/JPY": { symbol: "GBP/JPY", price: 196.78, spread: 2.0, dailyChange: 1.15, dailyChangePct: 0.59, atr: 1.45, volatility: "High", trendH1: "bullish", trendH4: "bullish", trendD1: "bullish", activeSession: "London", newsRisk: false },
  "AUD/JPY": { symbol: "AUD/JPY", price: 100.95, spread: 1.6, dailyChange: -0.38, dailyChangePct: -0.38, atr: 0.92, volatility: "Med", trendH1: "bearish", trendH4: "neutral", trendD1: "bearish", activeSession: "Asia", newsRisk: false },
  "EUR/AUD": { symbol: "EUR/AUD", price: 1.6668, spread: 1.8, dailyChange: 0.0042, dailyChangePct: 0.25, atr: 0.0098, volatility: "Med", trendH1: "bullish", trendH4: "bullish", trendD1: "neutral", activeSession: "London", newsRisk: false },
  "GBP/AUD": { symbol: "GBP/AUD", price: 1.9493, spread: 2.2, dailyChange: -0.0067, dailyChangePct: -0.34, atr: 0.0125, volatility: "High", trendH1: "bearish", trendH4: "bearish", trendD1: "neutral", activeSession: "London", newsRisk: true },
  "EUR/CHF": { symbol: "EUR/CHF", price: 0.9618, spread: 1.3, dailyChange: 0.0005, dailyChangePct: 0.05, atr: 0.0042, volatility: "Low", trendH1: "neutral", trendH4: "neutral", trendD1: "bearish", activeSession: "London", newsRisk: false },
  "XAU/USD": { symbol: "XAU/USD", price: 2348.50, spread: 3.5, dailyChange: 12.80, dailyChangePct: 0.55, atr: 28.5, volatility: "High", trendH1: "bullish", trendH4: "bullish", trendD1: "bullish", activeSession: "New York", newsRisk: true },
};

export function getMarketData(symbol: string): MarketData {
  return mockMarketData[symbol] ?? {
    symbol,
    price: 0,
    spread: 0,
    dailyChange: 0,
    dailyChangePct: 0,
    atr: 0,
    volatility: "Low" as VolatilityLevel,
    trendH1: "neutral" as TrendDirection,
    trendH4: "neutral" as TrendDirection,
    trendD1: "neutral" as TrendDirection,
    activeSession: "Closed" as SessionName,
    newsRisk: false,
  };
}

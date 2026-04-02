export type Signal = {
  id: string;
  pair: string;
  timeframe: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  confidence: number;
  ai_reasoning: string;
  verdict: "trade" | "no_trade";
  status: "active" | "closed" | "expired";
  created_at: string;
};

export const mockSignals: Signal[] = [
  {
    id: "1",
    pair: "EUR/USD",
    timeframe: "4H",
    direction: "long",
    entry_price: 1.0865,
    stop_loss: 1.0820,
    take_profit_1: 1.0920,
    take_profit_2: 1.0960,
    confidence: 82,
    ai_reasoning: "Price bounced off the 200 EMA on the 4H timeframe with a bullish engulfing candle. RSI is recovering from oversold territory (32). Volume increased on the bounce, confirming buyer interest. The daily trend remains bullish with higher highs and higher lows.",
    verdict: "trade",
    status: "active",
    created_at: "2026-04-02T08:30:00Z",
  },
  {
    id: "2",
    pair: "GBP/JPY",
    timeframe: "1H",
    direction: "short",
    entry_price: 191.450,
    stop_loss: 192.100,
    take_profit_1: 190.500,
    take_profit_2: 189.800,
    confidence: 75,
    ai_reasoning: "Double top pattern formed at resistance level 191.50. MACD showing bearish divergence on the 1H chart. The pair is overextended after a 300-pip rally. Risk-reward ratio is favorable at 1:1.5 for TP1.",
    verdict: "trade",
    status: "active",
    created_at: "2026-04-02T06:15:00Z",
  },
  {
    id: "3",
    pair: "USD/CAD",
    timeframe: "D",
    direction: "long",
    entry_price: 1.3580,
    stop_loss: 1.3520,
    take_profit_1: 1.3650,
    take_profit_2: 1.3700,
    confidence: 45,
    ai_reasoning: "Price is near support at 1.3580 but the setup lacks confirmation. RSI is neutral at 48, and there's no clear candlestick pattern. Volume is below average. Recommend waiting for a clearer signal before entering.",
    verdict: "no_trade",
    status: "active",
    created_at: "2026-04-02T00:00:00Z",
  },
  {
    id: "4",
    pair: "AUD/USD",
    timeframe: "4H",
    direction: "long",
    entry_price: 0.6520,
    stop_loss: 0.6485,
    take_profit_1: 0.6570,
    take_profit_2: 0.6610,
    confidence: 88,
    ai_reasoning: "Strong bullish pin bar at the 0.6500 psychological support level. This level aligns with the weekly 50 EMA. Stochastic is oversold and crossing up. Commodity currencies are showing broad strength today due to rising iron ore prices.",
    verdict: "trade",
    status: "active",
    created_at: "2026-04-01T22:00:00Z",
  },
  {
    id: "5",
    pair: "EUR/GBP",
    timeframe: "1H",
    direction: "short",
    entry_price: 0.8580,
    stop_loss: 0.8610,
    take_profit_1: 0.8545,
    take_profit_2: 0.8520,
    confidence: 38,
    ai_reasoning: "Choppy price action in a narrow range. No clear trend on the 1H or 4H charts. Bollinger Bands are squeezing, indicating low volatility. Best to wait for a breakout in either direction before taking a position.",
    verdict: "no_trade",
    status: "active",
    created_at: "2026-04-01T18:45:00Z",
  },
  {
    id: "6",
    pair: "USD/JPY",
    timeframe: "4H",
    direction: "long",
    entry_price: 151.200,
    stop_loss: 150.600,
    take_profit_1: 152.000,
    take_profit_2: 152.500,
    confidence: 71,
    ai_reasoning: "Trendline support holding on the 4H chart. US Treasury yields are rising, supporting dollar strength. However, BOJ intervention risk exists above 152.00, so position sizing should be conservative.",
    verdict: "trade",
    status: "active",
    created_at: "2026-04-01T14:00:00Z",
  },
];

export const watchlistPairs = ["EUR/USD", "GBP/JPY", "AUD/USD", "USD/JPY", "GBP/USD", "NZD/USD"];

export type Alert = {
  id: string;
  signal_id: string;
  pair: string;
  condition: string;
  status: "pending" | "triggered" | "expired";
  created_at: string;
  triggered_at?: string;
};

export const mockAlerts: Alert[] = [
  { id: "a1", signal_id: "1", pair: "EUR/USD", condition: "Price reaches entry at 1.0865", status: "pending", created_at: "2026-04-02T08:30:00Z" },
  { id: "a2", signal_id: "4", pair: "AUD/USD", condition: "Price reaches TP1 at 0.6570", status: "triggered", created_at: "2026-04-01T22:00:00Z", triggered_at: "2026-04-02T05:12:00Z" },
  { id: "a3", signal_id: "2", pair: "GBP/JPY", condition: "Price hits stop loss at 192.100", status: "pending", created_at: "2026-04-02T06:15:00Z" },
  { id: "a4", signal_id: "6", pair: "USD/JPY", condition: "Price reaches entry at 151.200", status: "expired", created_at: "2026-04-01T14:00:00Z" },
];

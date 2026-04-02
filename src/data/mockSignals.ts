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
    id: "1", pair: "EUR/USD", timeframe: "4H", direction: "long",
    entry_price: 1.0865, stop_loss: 1.0820, take_profit_1: 1.0920, take_profit_2: 1.0960,
    confidence: 82, verdict: "trade", status: "active", created_at: "2026-04-02T08:30:00Z",
    ai_reasoning: "Price bounced off the 200 EMA on the 4H timeframe with a bullish engulfing candle. RSI is recovering from oversold territory (32). Volume increased on the bounce, confirming buyer interest. The daily trend remains bullish with higher highs and higher lows.",
  },
  {
    id: "2", pair: "GBP/JPY", timeframe: "1H", direction: "short",
    entry_price: 191.450, stop_loss: 192.100, take_profit_1: 190.500, take_profit_2: 189.800,
    confidence: 75, verdict: "trade", status: "active", created_at: "2026-04-02T06:15:00Z",
    ai_reasoning: "Double top pattern formed at resistance level 191.50. MACD showing bearish divergence on the 1H chart. The pair is overextended after a 300-pip rally. Risk-reward ratio is favorable at 1:1.5 for TP1.",
  },
  {
    id: "3", pair: "USD/CAD", timeframe: "D", direction: "long",
    entry_price: 1.3580, stop_loss: 1.3520, take_profit_1: 1.3650, take_profit_2: 1.3700,
    confidence: 45, verdict: "no_trade", status: "active", created_at: "2026-04-02T00:00:00Z",
    ai_reasoning: "Price is near support at 1.3580 but the setup lacks confirmation. RSI is neutral at 48, and there's no clear candlestick pattern. Volume is below average. Recommend waiting for a clearer signal before entering.",
  },
  {
    id: "4", pair: "AUD/USD", timeframe: "4H", direction: "long",
    entry_price: 0.6520, stop_loss: 0.6485, take_profit_1: 0.6570, take_profit_2: 0.6610,
    confidence: 88, verdict: "trade", status: "active", created_at: "2026-04-01T22:00:00Z",
    ai_reasoning: "Strong bullish pin bar at the 0.6500 psychological support level. This level aligns with the weekly 50 EMA. Stochastic is oversold and crossing up. Commodity currencies are showing broad strength today due to rising iron ore prices.",
  },
  {
    id: "5", pair: "EUR/GBP", timeframe: "1H", direction: "short",
    entry_price: 0.8580, stop_loss: 0.8610, take_profit_1: 0.8545, take_profit_2: 0.8520,
    confidence: 38, verdict: "no_trade", status: "active", created_at: "2026-04-01T18:45:00Z",
    ai_reasoning: "Choppy price action in a narrow range. No clear trend on the 1H or 4H charts. Bollinger Bands are squeezing, indicating low volatility. Best to wait for a breakout in either direction before taking a position.",
  },
  {
    id: "6", pair: "USD/JPY", timeframe: "4H", direction: "long",
    entry_price: 151.200, stop_loss: 150.600, take_profit_1: 152.000, take_profit_2: 152.500,
    confidence: 71, verdict: "trade", status: "active", created_at: "2026-04-01T14:00:00Z",
    ai_reasoning: "Trendline support holding on the 4H chart. US Treasury yields are rising, supporting dollar strength. However, BOJ intervention risk exists above 152.00, so position sizing should be conservative.",
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

/* ── Account Stats ── */
export const mockAccountStats = {
  balance: 12480,
  equity: 12635,
  margin: 1250,
  dailyPnL: 155,
  dailyPnLPct: 1.24,
  dailyRiskUsed: 2.1,
  maxDailyRisk: 5,
};

/* ── Notifications ── */
export type Notification = {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
};

export const mockNotifications: Notification[] = [
  { id: "n1", message: "EUR/USD signal triggered — entry at 1.0865", read: false, timestamp: "2026-04-02T08:32:00Z" },
  { id: "n2", message: "AUD/USD TP1 hit — +50 pips", read: false, timestamp: "2026-04-02T05:12:00Z" },
  { id: "n3", message: "New signal available: GBP/JPY short", read: true, timestamp: "2026-04-02T06:15:00Z" },
  { id: "n4", message: "Daily risk limit at 42%", read: true, timestamp: "2026-04-02T01:00:00Z" },
];

/* ── Journal Entries ── */
export type JournalEntry = {
  id: string;
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  pnl: number;
  rr: number;
  notes: string;
  date: string;
};

export const mockJournalEntries: JournalEntry[] = [
  { id: "j1", pair: "EUR/USD", direction: "long", entry_price: 1.0810, exit_price: 1.0875, pnl: 65, rr: 1.8, notes: "Clean bounce off 200 EMA. Held through minor retracement.", date: "2026-04-01" },
  { id: "j2", pair: "GBP/USD", direction: "short", entry_price: 1.2640, exit_price: 1.2590, pnl: 50, rr: 1.4, notes: "Rejection at daily resistance. Took TP1 only.", date: "2026-03-31" },
  { id: "j3", pair: "USD/JPY", direction: "long", entry_price: 150.800, exit_price: 150.500, pnl: -30, rr: -0.5, notes: "Stopped out. BOJ rhetoric caused sudden yen strength.", date: "2026-03-30" },
  { id: "j4", pair: "AUD/USD", direction: "long", entry_price: 0.6480, exit_price: 0.6545, pnl: 65, rr: 2.1, notes: "Perfect setup. Iron ore rally supported move.", date: "2026-03-29" },
  { id: "j5", pair: "EUR/GBP", direction: "short", entry_price: 0.8610, exit_price: 0.8580, pnl: 30, rr: 1.0, notes: "Small winner. Range-bound but caught the dip.", date: "2026-03-28" },
];

/* ── Market Summary ── */
export type MarketPair = {
  pair: string;
  price: number;
  change: number;
  changePct: number;
  sentiment: "bullish" | "bearish" | "neutral";
};

export const mockMarketSummary: MarketPair[] = [
  { pair: "EUR/USD", price: 1.0868, change: 0.0023, changePct: 0.21, sentiment: "bullish" },
  { pair: "GBP/USD", price: 1.2635, change: -0.0018, changePct: -0.14, sentiment: "bearish" },
  { pair: "USD/JPY", price: 151.25, change: 0.45, changePct: 0.30, sentiment: "bullish" },
  { pair: "AUD/USD", price: 0.6532, change: 0.0015, changePct: 0.23, sentiment: "bullish" },
  { pair: "USD/CAD", price: 1.3575, change: -0.0012, changePct: -0.09, sentiment: "neutral" },
  { pair: "NZD/USD", price: 0.5985, change: 0.0008, changePct: 0.13, sentiment: "neutral" },
];

/* ── Watchlist Detail ── */
export type WatchlistPair = {
  pair: string;
  price: number;
  dailyChange: number;
  dailyChangePct: number;
  signalStatus: "active" | "none";
};

export const mockWatchlistData: WatchlistPair[] = [
  { pair: "EUR/USD", price: 1.0868, dailyChange: 0.0023, dailyChangePct: 0.21, signalStatus: "active" },
  { pair: "GBP/JPY", price: 191.42, dailyChange: -0.38, dailyChangePct: -0.20, signalStatus: "active" },
  { pair: "AUD/USD", price: 0.6532, dailyChange: 0.0015, dailyChangePct: 0.23, signalStatus: "active" },
  { pair: "USD/JPY", price: 151.25, dailyChange: 0.45, dailyChangePct: 0.30, signalStatus: "active" },
  { pair: "GBP/USD", price: 1.2635, dailyChange: -0.0018, dailyChangePct: -0.14, signalStatus: "none" },
  { pair: "NZD/USD", price: 0.5985, dailyChange: 0.0008, dailyChangePct: 0.13, signalStatus: "none" },
];

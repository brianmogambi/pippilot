export type Signal = {
  id: string;
  pair: string;
  timeframe: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;
  confidence: number;
  ai_reasoning: string;
  verdict: "trade" | "no_trade";
  status: "active" | "closed" | "expired";
  setup_type?: string;
  created_at: string;
};

export const mockSignals: Signal[] = [
  {
    id: "1", pair: "EUR/USD", timeframe: "H4", direction: "long",
    entry_price: 1.0865, stop_loss: 1.0820, take_profit_1: 1.0920, take_profit_2: 1.0960, take_profit_3: 1.1010,
    confidence: 82, verdict: "trade", status: "active", setup_type: "trend_pullback",
    created_at: "2026-04-03T08:30:00Z",
    ai_reasoning: "Price bounced off the 200 EMA on the 4H timeframe with a bullish engulfing candle. RSI recovering from oversold at 32. Volume increased on the bounce confirming buyer interest. Daily trend remains bullish with higher highs and higher lows. The 1.0820 level provides a clean invalidation point below the swing low.",
  },
  {
    id: "2", pair: "GBP/JPY", timeframe: "H1", direction: "short",
    entry_price: 191.450, stop_loss: 192.100, take_profit_1: 190.500, take_profit_2: 189.800,
    confidence: 75, verdict: "trade", status: "active", setup_type: "sr_rejection",
    created_at: "2026-04-03T06:15:00Z",
    ai_reasoning: "Double top pattern formed at the 191.50 resistance level which has held three times this month. MACD showing bearish divergence on the 1H chart. The pair is overextended after a 300-pip rally without a meaningful pullback. Risk-reward is favorable at 1:1.5 for TP1.",
  },
  {
    id: "3", pair: "USD/CAD", timeframe: "D1", direction: "long",
    entry_price: 1.3580, stop_loss: 1.3520, take_profit_1: 1.3650, take_profit_2: 1.3700,
    confidence: 45, verdict: "no_trade", status: "active", setup_type: "range_reversal",
    created_at: "2026-04-03T00:00:00Z",
    ai_reasoning: "Price is near support at 1.3580 but the setup lacks confirmation. RSI is neutral at 48 and there is no clear candlestick pattern. Volume is below the 20-day average. The range between 1.3520 and 1.3700 has been respected but without a catalyst a breakout is unlikely. Recommend waiting for a clearer signal.",
  },
  {
    id: "4", pair: "AUD/USD", timeframe: "H4", direction: "long",
    entry_price: 0.6520, stop_loss: 0.6485, take_profit_1: 0.6570, take_profit_2: 0.6610, take_profit_3: 0.6650,
    confidence: 88, verdict: "trade", status: "active", setup_type: "breakout_retest",
    created_at: "2026-04-02T22:00:00Z",
    ai_reasoning: "Strong bullish pin bar at the 0.6500 psychological support level. This level aligns with the weekly 50 EMA and the ascending trendline from February lows. Stochastic is oversold and crossing up. Commodity currencies showing broad strength today due to rising iron ore prices.",
  },
  {
    id: "5", pair: "EUR/GBP", timeframe: "H1", direction: "short",
    entry_price: 0.8580, stop_loss: 0.8610, take_profit_1: 0.8545, take_profit_2: 0.8520,
    confidence: 38, verdict: "no_trade", status: "active", setup_type: "range_reversal",
    created_at: "2026-04-02T18:45:00Z",
    ai_reasoning: "Choppy price action in a narrow range between 0.8550 and 0.8610. No clear trend on the 1H or 4H charts. Bollinger Bands are squeezing indicating low volatility and an imminent expansion. Best to wait for a breakout in either direction before committing capital.",
  },
  {
    id: "6", pair: "USD/JPY", timeframe: "H4", direction: "long",
    entry_price: 151.200, stop_loss: 150.600, take_profit_1: 152.000, take_profit_2: 152.500, take_profit_3: 153.000,
    confidence: 71, verdict: "trade", status: "active", setup_type: "momentum_breakout",
    created_at: "2026-04-02T14:00:00Z",
    ai_reasoning: "Trendline support holding on the 4H chart with a hammer candle at the retest. US Treasury yields are rising supporting dollar strength against the yen. However BOJ intervention risk exists above 152.00 so position sizing should be conservative.",
  },
  {
    id: "7", pair: "GBP/USD", timeframe: "H4", direction: "short",
    entry_price: 1.2640, stop_loss: 1.2695, take_profit_1: 1.2580, take_profit_2: 1.2530, take_profit_3: 1.2480,
    confidence: 79, verdict: "trade", status: "closed", setup_type: "trend_pullback",
    created_at: "2026-04-01T10:00:00Z",
    ai_reasoning: "Bearish flag pattern on the 4H chart after a strong sell-off from 1.2720. Price rejected the 38.2% Fibonacci retracement at 1.2645. The 50 EMA is turning down and acting as dynamic resistance. UK GDP data disappointed expectations supporting further downside. TP1 reached with +60 pips.",
  },
  {
    id: "8", pair: "XAU/USD", timeframe: "H1", direction: "long",
    entry_price: 2345.00, stop_loss: 2338.00, take_profit_1: 2355.00, take_profit_2: 2365.00, take_profit_3: 2380.00,
    confidence: 84, verdict: "trade", status: "active", setup_type: "momentum_breakout",
    created_at: "2026-04-03T09:30:00Z",
    ai_reasoning: "Gold breaking above the consolidation range at 2342-2348 with strong momentum. Real yields are declining as markets price in rate cuts. The 1H chart shows a clear ascending triangle breakout with volume confirmation. Geopolitical risk premium remains elevated supporting safe-haven demand.",
  },
];

export const watchlistPairs = ["EUR/USD", "GBP/JPY", "AUD/USD", "USD/JPY", "GBP/USD", "NZD/USD", "XAU/USD"];

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
  { id: "a1", signal_id: "1", pair: "EUR/USD", condition: "Price approaching entry zone at 1.0865 — trend pullback forming on H4", status: "pending", created_at: "2026-04-03T08:30:00Z" },
  { id: "a2", signal_id: "4", pair: "AUD/USD", condition: "TP1 hit at 0.6570 — breakout retest played out perfectly (+50 pips)", status: "triggered", created_at: "2026-04-02T22:00:00Z", triggered_at: "2026-04-03T05:12:00Z" },
  { id: "a3", signal_id: "2", pair: "GBP/JPY", condition: "Price within 15 pips of stop loss at 192.100 — monitor closely", status: "pending", created_at: "2026-04-03T06:15:00Z" },
  { id: "a4", signal_id: "6", pair: "USD/JPY", condition: "Entry zone reached at 151.200 — signal now active", status: "triggered", created_at: "2026-04-02T14:00:00Z", triggered_at: "2026-04-02T15:45:00Z" },
  { id: "a5", signal_id: "7", pair: "GBP/USD", condition: "Signal expired — price moved beyond invalidation level at 1.2695", status: "expired", created_at: "2026-04-01T10:00:00Z" },
  { id: "a6", signal_id: "8", pair: "XAU/USD", condition: "Gold breakout confirmed above 2348 — momentum entry triggered", status: "triggered", created_at: "2026-04-03T09:30:00Z", triggered_at: "2026-04-03T09:42:00Z" },
  { id: "a7", signal_id: "1", pair: "EUR/USD", condition: "Daily risk usage at 3.2% — approaching 5% limit", status: "pending", created_at: "2026-04-03T07:00:00Z" },
];

/* ── Account Stats ── */
export const mockAccountStats = {
  balance: 12480,
  equity: 12635,
  margin: 1250,
  dailyPnL: 155,
  dailyPnLPct: 1.24,
  dailyRiskUsed: 3.2,
  maxDailyRisk: 5,
  weeklyPnL: 420,
  weeklyPnLPct: 3.45,
  openTrades: 3,
  winStreak: 4,
};

/* ── Notifications ── */
export type Notification = {
  id: string;
  message: string;
  read: boolean;
  timestamp: string;
};

export const mockNotifications: Notification[] = [
  { id: "n1", message: "EUR/USD trend pullback signal — entry zone at 1.0865", read: false, timestamp: "2026-04-03T08:32:00Z" },
  { id: "n2", message: "AUD/USD TP1 hit — +50 pips on breakout retest", read: false, timestamp: "2026-04-03T05:12:00Z" },
  { id: "n3", message: "XAU/USD breakout confirmed — momentum entry at 2345.00", read: false, timestamp: "2026-04-03T09:42:00Z" },
  { id: "n4", message: "GBP/JPY short signal active — S/R rejection at 191.45", read: true, timestamp: "2026-04-03T06:15:00Z" },
  { id: "n5", message: "Daily risk at 3.2% — 1.8% remaining before limit", read: true, timestamp: "2026-04-03T07:00:00Z" },
  { id: "n6", message: "GBP/USD TP1 reached — closed +60 pips", read: true, timestamp: "2026-04-01T16:30:00Z" },
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
  setup_type?: string;
  confidence?: number;
  followed_plan?: boolean;
  lot_size?: number;
  stop_loss?: number;
  take_profit?: number;
};

export const mockJournalEntries: JournalEntry[] = [
  {
    id: "j1", pair: "EUR/USD", direction: "long", entry_price: 1.0810, exit_price: 1.0875,
    pnl: 65, rr: 1.8, stop_loss: 1.0774, take_profit: 1.0875, lot_size: 0.5,
    setup_type: "trend_pullback", confidence: 4, followed_plan: true,
    notes: "Clean bounce off 200 EMA. Held through minor retracement. Exited at TP1 — could have held for TP2 but followed plan.",
    date: "2026-04-02",
  },
  {
    id: "j2", pair: "GBP/USD", direction: "short", entry_price: 1.2640, exit_price: 1.2580,
    pnl: 60, rr: 1.5, stop_loss: 1.2680, take_profit: 1.2580, lot_size: 0.3,
    setup_type: "trend_pullback", confidence: 4, followed_plan: true,
    notes: "Bearish flag on H4 played out. UK GDP miss confirmed the bias. Took TP1 only — TP2 would have hit too.",
    date: "2026-04-01",
  },
  {
    id: "j3", pair: "USD/JPY", direction: "long", entry_price: 150.800, exit_price: 150.500,
    pnl: -30, rr: -0.5, stop_loss: 150.200, take_profit: 151.600, lot_size: 0.2,
    setup_type: "momentum_breakout", confidence: 3, followed_plan: false,
    notes: "Stopped out early — moved SL tighter than plan because of BOJ rhetoric fear. Should have trusted the original SL. Lesson: don't adjust SL based on emotion.",
    date: "2026-03-31",
  },
  {
    id: "j4", pair: "AUD/USD", direction: "long", entry_price: 0.6480, exit_price: 0.6545,
    pnl: 65, rr: 2.1, stop_loss: 0.6449, take_profit: 0.6545, lot_size: 0.5,
    setup_type: "breakout_retest", confidence: 5, followed_plan: true,
    notes: "Perfect setup. Iron ore rally supported the move. Entry at retest of breakout level, held to TP2. Best trade of the week.",
    date: "2026-03-30",
  },
  {
    id: "j5", pair: "EUR/GBP", direction: "short", entry_price: 0.8610, exit_price: 0.8580,
    pnl: 30, rr: 1.0, stop_loss: 0.8640, take_profit: 0.8580, lot_size: 0.2,
    setup_type: "range_reversal", confidence: 3, followed_plan: true,
    notes: "Small winner at range top. Tight range made it difficult but R:R was acceptable. Not the cleanest trade.",
    date: "2026-03-29",
  },
  {
    id: "j6", pair: "XAU/USD", direction: "long", entry_price: 2320.00, exit_price: 2358.00,
    pnl: 380, rr: 2.7, stop_loss: 2306.00, take_profit: 2360.00, lot_size: 0.1,
    setup_type: "momentum_breakout", confidence: 5, followed_plan: true,
    notes: "Gold breakout above consolidation. Held through a 10-point pullback which was uncomfortable but within plan. Massive R:R. Best gold trade this month.",
    date: "2026-03-28",
  },
  {
    id: "j7", pair: "GBP/JPY", direction: "long", entry_price: 190.200, exit_price: 189.800,
    pnl: -40, rr: -0.8, stop_loss: 189.700, take_profit: 191.200, lot_size: 0.2,
    setup_type: "sr_rejection", confidence: 2, followed_plan: true,
    notes: "Took the trade despite low confidence — should have skipped. Support didn't hold, clean stop out. Lesson: only trade high-confidence setups on volatile crosses.",
    date: "2026-03-27",
  },
  {
    id: "j8", pair: "USD/CAD", direction: "short", entry_price: 1.3620, exit_price: 1.3620,
    pnl: 0, rr: 0, stop_loss: 1.3660, take_profit: 1.3560, lot_size: 0.3,
    setup_type: "range_reversal", confidence: 3, followed_plan: false,
    notes: "Closed at breakeven after 4 hours of nothing. Market was dead — should have waited for NY session for better liquidity. Breakeven is fine, patience was the issue.",
    date: "2026-03-26",
  },
  {
    id: "j9", pair: "EUR/USD", direction: "short", entry_price: 1.0920, exit_price: 1.0945,
    pnl: -25, rr: -0.6, stop_loss: 1.0960, take_profit: 1.0860, lot_size: 0.3,
    setup_type: "sr_rejection", confidence: 3, followed_plan: true,
    notes: "Resistance rejection looked valid but NFP surprise pushed price through. News risk was flagged — should have reduced size or waited. Stop was hit cleanly.",
    date: "2026-03-25",
  },
  {
    id: "j10", pair: "AUD/USD", direction: "long", entry_price: 0.6510, exit_price: 0.6555,
    pnl: 45, rr: 1.5, stop_loss: 0.6480, take_profit: 0.6555, lot_size: 0.4,
    setup_type: "trend_pullback", confidence: 4, followed_plan: true,
    notes: "Textbook H4 pullback to 20 EMA. Entered on the bounce candle close. Clean execution, exited at TP1. Consistent setup that works well on AUD.",
    date: "2026-03-24",
  },
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
  { pair: "EUR/USD", price: 1.0872, change: 0.0023, changePct: 0.21, sentiment: "bullish" },
  { pair: "GBP/USD", price: 1.2715, change: -0.0031, changePct: -0.24, sentiment: "bearish" },
  { pair: "USD/JPY", price: 154.82, change: 0.45, changePct: 0.29, sentiment: "bullish" },
  { pair: "AUD/USD", price: 0.6523, change: 0.0018, changePct: 0.28, sentiment: "bullish" },
  { pair: "USD/CAD", price: 1.3642, change: 0.0035, changePct: 0.26, sentiment: "neutral" },
  { pair: "NZD/USD", price: 0.5987, change: -0.0008, changePct: -0.13, sentiment: "neutral" },
  { pair: "XAU/USD", price: 2348.50, change: 12.80, changePct: 0.55, sentiment: "bullish" },
  { pair: "GBP/JPY", price: 196.78, change: 1.15, changePct: 0.59, sentiment: "bullish" },
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
  { pair: "EUR/USD", price: 1.0872, dailyChange: 0.0023, dailyChangePct: 0.21, signalStatus: "active" },
  { pair: "GBP/JPY", price: 196.78, dailyChange: 1.15, dailyChangePct: 0.59, signalStatus: "active" },
  { pair: "AUD/USD", price: 0.6523, dailyChange: 0.0018, dailyChangePct: 0.28, signalStatus: "active" },
  { pair: "USD/JPY", price: 154.82, dailyChange: 0.45, dailyChangePct: 0.29, signalStatus: "active" },
  { pair: "GBP/USD", price: 1.2715, dailyChange: -0.0031, dailyChangePct: -0.24, signalStatus: "active" },
  { pair: "NZD/USD", price: 0.5987, dailyChange: -0.0008, dailyChangePct: -0.13, signalStatus: "none" },
  { pair: "XAU/USD", price: 2348.50, dailyChange: 12.80, dailyChangePct: 0.55, signalStatus: "active" },
];

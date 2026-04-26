// src/lib/glossary.ts
//
// Phase 3 (improvement plan): a typed glossary of trading terms used
// across the UI. Each entry has a `short` label (1-line tooltip
// preview) and a `long` description (full explanation). Plain English,
// jargon-free where possible. Used by `<TermTooltip>` in headers,
// signal cards, and the calculator.

export interface GlossaryEntry {
  /** 1-line tooltip preview. Plain English. */
  short: string;
  /** Longer explanation surfaced in beginner-mode contexts. */
  long: string;
}

export const GLOSSARY = {
  pip: {
    short: "Smallest standard price move in a forex pair.",
    long: "A pip is the smallest standard price move for a currency pair. For most pairs it's the 4th decimal (0.0001); for JPY pairs it's the 2nd (0.01). Pip moves convert to dollars based on lot size and the pair's pip value.",
  },
  lot: {
    short: "Trade size unit — Standard 1.0, Mini 0.1, Micro 0.01.",
    long: "A lot is how trade size is measured. 1 standard lot = 100,000 units of the base currency. Mini lot = 0.10 (10,000 units). Micro lot = 0.01 (1,000 units). Smaller lots = smaller dollar risk per pip.",
  },
  spread: {
    short: "Difference between buy and sell price — your immediate cost.",
    long: "The spread is the gap between the bid (sell) and ask (buy) price. You pay it on every trade. Tight spreads (e.g. 0.5–1 pip on EUR/USD) keep costs low; wide spreads at illiquid times eat into profit.",
  },
  leverage: {
    short: "Borrowed buying power — amplifies both gains and losses.",
    long: "Leverage lets you control a position larger than your account balance — e.g. 1:30 means $1 controls $30. It magnifies profits AND losses equally. High leverage is the #1 reason beginners blow up accounts; risk-based sizing matters far more than the leverage cap your broker offers.",
  },
  margin: {
    short: "Capital your broker locks up to keep a position open.",
    long: "Margin is the portion of your balance held as collateral for an open trade. If margin used gets close to balance, you risk a margin call (forced close). Trading at low risk-per-trade keeps margin usage low and stress manageable.",
  },
  drawdown: {
    short: "Peak-to-trough drop in your account during a losing streak.",
    long: "Drawdown is the largest dip from a recent high in your equity curve. A 20% drawdown means recovering 25% just to break even. Sustainable strategies aim to keep drawdown under 10–15%; anything more is psychologically punishing.",
  },
  stop_loss: {
    short: "Automatic exit price that caps your loss on a trade.",
    long: "A stop loss is a pre-set price where your trade closes automatically if the market moves against you. It defines your maximum risk on the trade. Never trade without one — discretionary 'I'll exit if it gets bad' rarely survives real markets.",
  },
  take_profit: {
    short: "Automatic exit price that locks in your gain.",
    long: "A take profit is a pre-set price where your trade closes automatically when the market moves in your favor. PipPilot suggests 3 levels (TP1/TP2/TP3) so you can scale out — close part at TP1 to lock in profit, let the rest run.",
  },
  risk_reward: {
    short: "Ratio of potential reward to risk on the trade.",
    long: "Risk-to-reward (R:R) is the distance from entry to TP1 divided by the distance from entry to stop loss. A 2R trade means you stand to make 2× what you risk. With R:R ≥ 2, you can be wrong more than half the time and still be profitable.",
  },
  risk_pct: {
    short: "% of your balance you're willing to lose if the SL hits.",
    long: "Risk-per-trade percent is the slice of your account you're willing to lose on a single trade. The industry consensus for sustainable trading is 0.5%–2% per trade. At 1%, you'd need 100 consecutive losers to lose half your account — far longer than most strategies' worst streaks.",
  },
  confidence: {
    short: "PipPilot's 0–100 score for how strongly the setup confluences.",
    long: "Confidence is the deterministic engine's 0–100 score for how many factors align in the trade's favor — multi-timeframe trend, RSI/MACD confirmation, structure-pattern match, key levels. 70%+ is strong; below 50% the setup is marginal and usually filtered to no-trade.",
  },
  setup_quality: {
    short: "Letter grade summarising the setup's strength.",
    long: "Setup quality grades the signal: A+ (80–100 confidence) is the strongest, A is strong, B is moderate, C is weak. Beginners should default to A+/A signals only — letting B/C grades go is one of the highest-leverage habits you can build.",
  },
  volatility: {
    short: "How much the pair is moving — High/Med/Low buckets.",
    long: "Volatility measures recent price range. High volatility means bigger pip moves but also wider stops and more whipsaw. Low volatility means tighter stops but slower trades. Match your timeframe and risk to current volatility.",
  },
  atr: {
    short: "Average True Range — typical bar size, used to size stops.",
    long: "ATR (Average True Range, 14-period) measures the average size of recent price bars. PipPilot uses ATR×1.5 to size stops so the SL adapts to current volatility instead of being a fixed pip distance. Higher ATR = wider stops, smaller lots.",
  },
  ema: {
    short: "Exponential Moving Average — recent-weighted trend line.",
    long: "EMA (Exponential Moving Average) is a smoothed price line that weights recent bars more than older ones, so it reacts faster than a simple average. PipPilot tracks EMA 20/50/200 — when they stack price>20>50>200, that's a strong bullish trend.",
  },
  rsi: {
    short: "Relative Strength Index — 0–100 momentum gauge.",
    long: "RSI (Relative Strength Index, 14-period) ranges 0–100 and measures momentum. Above 70 is overbought (often near short setups); below 30 is oversold (often near long setups). Mid-range (35–65) is neutral and best for trend-continuation entries.",
  },
  session: {
    short: "London / New York / Asia — when liquidity is highest.",
    long: "Forex trades 24/5 across three sessions: Asia (Tokyo/Sydney), London, and New York. London and NY overlap is the most liquid window — tight spreads, clean structure, high volume. Trading the dead Asia session on USD pairs often gets messy fills.",
  },
  trend: {
    short: "Current direction across a timeframe — bullish, bearish, neutral.",
    long: "Trend is whether price is structurally rising, falling, or chopping on a given timeframe. PipPilot reports H1/H4/D1 trends separately — when all three agree, signals are strongest. Counter-trend trades are higher-risk and usually filtered to no-trade.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryTerm = keyof typeof GLOSSARY;

export function getGlossaryEntry(term: GlossaryTerm): GlossaryEntry {
  return GLOSSARY[term];
}

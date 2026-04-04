# PipPilot AI — User Guide

> This guide is written for beginner traders. If you're new to forex trading, start here.

---

## What Is PipPilot AI?

PipPilot AI is a trading analysis tool that helps you make better-informed trading decisions. It uses AI to analyze forex markets and suggest potential trade setups — but **it does not trade for you**.

Think of it as a knowledgeable assistant that:
- Watches the markets and highlights opportunities
- Explains why a trade setup might work (and why it might not)
- Helps you calculate the right position size to manage risk
- Tracks your trades so you can learn from your results

**⚠️ Important: PipPilot AI is not financial advice. Always do your own research and never risk money you can't afford to lose.**

---

## Getting Started

### 1. Sign Up
Create an account with your email address. You'll receive a verification email — click the link to confirm your account.

### 2. Onboarding
After your first login, you'll go through a quick setup wizard:
- Set your experience level (Beginner, Intermediate, Advanced)
- Choose your preferred currency pairs
- Select trading sessions you're active during
- Configure basic risk parameters

### 3. Dashboard
After onboarding, you'll land on the Dashboard — your home base.

---

## Page-by-Page Guide

### Dashboard

Your command center. At a glance you see:

| Section | What It Shows |
|---------|---------------|
| **Account Overview** | Balance, equity, daily P/L, risk used today, risk remaining |
| **Active Trade Ideas** | Latest AI-generated signals with pair, direction, entry, SL, TP, confidence |
| **Alerts** | Recent alert notifications with severity indicators |
| **Market Watch** | Quick view of your watchlist pairs with price, change, volatility, sentiment |
| **Journal Snapshot** | Your recent trades with total count, win rate, and average P/L |
| **Trading Tip** | A rotating daily tip for building good trading habits (dismissable) |

**Tip:** The risk cards at the top show how much of your daily risk budget you've used. If "Risk Remaining" is low, consider waiting until tomorrow.

---

### Market Watch (Watchlist)

A table of all available forex instruments with real-time market data.

**Columns explained:**
| Column | Meaning |
|--------|---------|
| ⭐ Star | Click to add/remove from your personal watchlist (favorites) |
| **Pair** | The currency pair (e.g., EUR/USD) |
| **Price** | Current market price |
| **Spread** | Difference between bid and ask price (lower is better) |
| **Change** | How much the price has moved today (in percentage) |
| **Volatility** | Low / Med / High — how much the price is swinging |
| **Session** | Which trading session is currently active (London, New York, Asia, Closed) |
| **Trend** | Three arrows showing trend direction on H1, H4, and D1 timeframes |
| **Signal** | Whether an active AI signal exists for this pair |
| ⚠️ Icon | Warning triangle = high-impact news risk for this pair |

**Filters:** Search by pair name, filter by favorites only, signal status, session, trend direction, and volatility level.

**Click any row** to open the Pair Detail page.

---

### Pair Detail

A deep-dive view for a specific currency pair. Sections include:

- **Price header** with current price, daily change, and spread
- **Key Levels** — Support, resistance, session high/low, previous day high/low
- **Multi-Timeframe Trend** — Visual trend indicators for H1, H4, and D1
- **Market Structure** — Whether the pair is trending, ranging, or breaking out
- **AI Analysis** — Full setup explanation with beginner and expert views
- **Reasons For / Against** — Bullet-point pros and cons for the trade
- **Signal History** — Previous signals generated for this pair
- **Your Journal Entries** — Your past trades on this pair
- **Chart placeholder** — Reserved for future charting integration

---

### Signals (Signal Explorer)

Browse all AI-generated trade signals. Each signal contains:

| Field | What It Means |
|-------|---------------|
| **Pair** | Which currency pair |
| **Direction** | Long (buy) or Short (sell) — or "Skip" for no-trade signals |
| **Timeframe** | The analysis timeframe (e.g., H1, H4) |
| **Setup** | The pattern type (e.g., "Bullish Flag Breakout", "Bearish Continuation") |
| **Entry** | Suggested entry price |
| **SL (Stop Loss)** | Price where you should exit if the trade goes against you — this limits your loss |
| **TP1** | First take-profit target |
| **R:R** | Risk-to-Reward ratio — how much you could gain vs. how much you risk. 2.0R means you could gain 2x what you risk |
| **Confidence** | AI's confidence in the setup (0–100%). Higher = more conviction |
| **Quality** | Setup grade: A+ (excellent), A (good), B (moderate), C (poor/skip) |
| **Status** | active, monitoring, triggered, invalidated, or closed |

**Filters available:** Search pair, timeframe, direction, quality grade, confidence range, status.

**Click any signal** to open a detail drawer with full AI reasoning, invalidation criteria, and beginner-friendly explanation.

---

### How to Interpret Signals

1. **Check the verdict first:** If it says "No Trade" — the AI recommends skipping this pair. Read the reason to understand why.
2. **Look at confidence:** 80%+ is high conviction. Below 60% means the setup is weak.
3. **Check quality:** A+ and A setups have the best risk/reward profiles. C-grade setups should generally be avoided.
4. **Read the reasoning:** The "Reasons For" and "Reasons Against" sections tell you exactly what the AI considered.
5. **Check risk/reward:** A minimum of 1:2 R:R is generally recommended. This means your potential profit is at least 2x your potential loss.

### What "No Trade" Means

"No Trade" is one of the most important signals PipPilot AI can give you. It means:
- Market conditions are unclear or conflicting
- There's no clean setup with favorable risk-to-reward
- Multiple timeframes disagree on direction
- Volatility is too low or too high for reliable entries

**The best trade is sometimes no trade at all.** Skipping bad setups protects your capital.

---

### Risk Calculator

The position size calculator helps you determine exactly how many lots to trade based on your risk parameters.

**Input fields:**
| Field | Description |
|-------|-------------|
| **Account Balance** | Your total account balance |
| **Account Equity** | Your current equity (balance + open P/L) |
| **Account Currency** | Your account's base currency |
| **Selected Pair** | The pair you want to trade |
| **Entry Price** | Your planned entry price |
| **Stop Loss** | Your planned stop loss price |
| **SL (pips)** | Stop loss distance in pips (auto-calculated from entry/SL, or enter manually) |
| **Risk % per Trade** | What percentage of your balance you want to risk (slider: 0.1% – 10%) |
| **Fixed Risk Amount** | Optional: override the percentage with a fixed dollar amount |
| **Current Open Risk** | Optional: how much risk you already have in open trades |

**Results:**
| Output | Meaning |
|--------|---------|
| **Max Risk** | Maximum dollar amount you'll risk on this trade |
| **Lot Size** | How many standard lots to trade (also shown in mini and micro lots) |
| **Pip Value** | Dollar value per pip movement per standard lot |
| **Exposure** | Total notional exposure in your account currency |

**Conservative Mode:** Toggle this ON to automatically halve your position size. Recommended for beginners.

**Warnings:**
- 🔴 Red warning: Total risk exceeds 5% of balance (dangerous)
- 🟡 Yellow warning: Total risk approaching 3% daily loss guideline
- 🔵 Blue info: Conservative mode is active

---

### Alerts Center

View notifications about your tracked pairs and signals.

**Alert properties:**
| Property | Description |
|----------|-------------|
| **Pair** | Which pair triggered the alert |
| **Title** | Brief description of what happened |
| **Severity** | info, warning, or critical |
| **Status** | pending, triggered, or dismissed |
| **Read/Unread** | Blue dot indicates unread alerts |

You can mark individual alerts as read or use "Mark all read" for bulk actions.

---

### Trade Journal

Your personal trading diary. Log every trade to track performance and identify patterns.

**Entry fields:**
| Field | Description |
|-------|-------------|
| **Pair** | Which pair you traded |
| **Direction** | Long or Short |
| **Entry Price** | Your actual entry price |
| **Stop Loss** | Where you placed your stop |
| **Take Profit** | Your target price |
| **Lot Size** | Position size |
| **Exit Price** | Your actual exit price (fill in when trade closes) |
| **Result (pips)** | Profit or loss in pips |
| **Result (amount)** | Profit or loss in dollars |
| **Followed Plan** | Did you stick to your original plan? (Yes/No) |
| **Confidence** | How confident were you at entry (1–100) |
| **Setup Type** | What pattern you traded |
| **Setup Reasoning** | Why you took the trade |
| **Emotional Notes** | How you felt (anxiety, FOMO, confidence, etc.) |
| **Lesson Learned** | What you'd do differently |

**Stats displayed:**
- Total trades, wins, win rate
- Average pips per trade, average R multiple
- Best and worst performing pairs

**Tip:** Review your journal weekly. Look for patterns in your emotions, your best/worst pairs, and whether you're following your plans.

---

### Settings

Configure your trading profile and preferences.

**Sections:**
1. **Profile** — Display name, email, experience level, trading style
2. **Trading Preferences** — Default timeframe, preferred pairs (majors/minors), preferred sessions
3. **Strategy Preferences** — Enable/disable strategies the AI should prioritize (Trend Pullback, Breakout Retest, Range Reversal, Momentum Breakout, S/R Rejection)
4. **Risk Preferences** — Account balance/equity, currency, broker name, default risk %, max daily loss %, conservative mode
5. **Notification Preferences** — Toggle notifications on/off, select alert channels (in-app only for V1)
6. **Appearance** — Timezone selection

---

## How to Manage Risk

### The 1% Rule
Never risk more than 1–2% of your account balance on a single trade. If your account is $10,000, your maximum risk per trade should be $100–$200.

### Daily Loss Limit
Set a maximum daily loss (default: 5%). If you hit this limit, stop trading for the day. This prevents revenge trading and emotional decision-making.

### Position Sizing
Always use the Risk Calculator to determine your lot size. Never "eyeball" it.

### Conservative Mode
If you're a beginner, enable Conservative Mode. It automatically halves your position size, giving you more room for error while you learn.

---

## Common Beginner Mistakes

1. **Trading without a stop loss** — Always define your exit before entering
2. **Risking too much per trade** — Stick to 1–2% maximum
3. **Revenge trading** — After a loss, don't immediately try to "win it back"
4. **Ignoring "No Trade" signals** — If the AI says skip, there's usually a good reason
5. **Not journaling** — Without records, you can't identify what's working and what isn't
6. **Overtrading** — Quality over quantity. 2–3 good setups per week beats 20 mediocre ones
7. **Trading during news** — High-impact news events can cause wild price spikes. The ⚠️ icon warns you about this

---

## Disclaimers

- PipPilot AI provides **AI-assisted analysis only** — it is **not financial advice**
- Past performance does not guarantee future results
- Trading forex carries significant risk of loss
- Never trade with money you cannot afford to lose
- Always do your own research before entering any trade
- The developers of PipPilot AI are not liable for any trading losses

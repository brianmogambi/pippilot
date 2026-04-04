# PipPilot AI — Signal Engine Specification

> **Status:** Not yet implemented. This document describes the intended architecture and logic for the AI signal generation engine. Currently, signals are static DB rows inserted manually by admins.

---

## Overview

The signal engine is the core analysis system that will scan forex instruments, perform multi-timeframe technical analysis, detect trade setups, score confluence, and output structured signal objects with full reasoning.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Market Data API │────▶│  Signal Engine    │────▶│  signals table   │
│  (OHLCV feed)    │     │  (Edge Function)  │     │  (PostgreSQL)    │
└──────────────────┘     │                    │     └──────────────────┘
                         │  1. Data ingestion │             │
                         │  2. MTF analysis   │             ▼
                         │  3. Setup detect   │     ┌──────────────────┐
                         │  4. Confluence     │     │  alerts table    │
                         │  5. Signal output  │     │  (auto-created)  │
                         └──────────────────┘     └──────────────────┘
```

### Execution Model
- **Trigger:** Scheduled cron job (every 15 minutes during active sessions) or on-demand via admin
- **Runtime:** Supabase Edge Function (Deno)
- **Scope:** All active instruments in the `instruments` table

---

## Inputs

### 1. OHLCV Data (from market data API)
For each instrument, fetch candle data across multiple timeframes:

| Timeframe | Candles Needed | Purpose |
|-----------|---------------|---------|
| M5 | 100 | Entry timing, momentum confirmation |
| M15 | 100 | Setup pattern identification |
| H1 | 200 | Primary analysis timeframe |
| H4 | 100 | Trend direction, structure |
| D1 | 60 | Higher timeframe bias |

Each candle:
```typescript
interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### 2. Derived Indicators (calculated from OHLCV)
| Indicator | Timeframes | Parameters |
|-----------|-----------|------------|
| EMA (Exponential Moving Average) | H1, H4, D1 | 20, 50, 200 |
| ATR (Average True Range) | H1, H4, D1 | 14-period |
| RSI (Relative Strength Index) | H1, H4 | 14-period |
| MACD | H1, H4 | 12, 26, 9 |
| Bollinger Bands | H1 | 20, 2σ |
| Volume Profile | H1 | 20-period lookback |

### 3. Key Levels (calculated from price action)
| Level Type | Method |
|------------|--------|
| Support | Swing lows, round numbers, EMA confluence |
| Resistance | Swing highs, round numbers, EMA confluence |
| Session High/Low | Current session extremes |
| Previous Day High/Low | Prior day's range |
| Weekly Open | Monday's opening price |

### 4. Context Data
| Data | Source |
|------|--------|
| Active session | Calculated from UTC time (London, New York, Asia) |
| News risk | Economic calendar API (high-impact events within 2 hours) |
| Spread | Current bid-ask spread from data feed |
| Instrument metadata | `instruments` table (pip_value, type) |

---

## Multi-Timeframe Analysis Logic

### Step 1: Trend Determination (per timeframe)
For each of H1, H4, D1:
```
IF close > EMA_50 AND EMA_20 > EMA_50 → "bullish"
IF close < EMA_50 AND EMA_20 < EMA_50 → "bearish"
ELSE → "neutral"
```

### Step 2: Market Structure Classification
```
IF making higher highs AND higher lows (last 3 swings) → "trending"
IF price bouncing between support and resistance → "ranging"
IF price breaking through key level with momentum → "breakout"
```

### Step 3: Timeframe Alignment Score
```
all_bullish = H1 bullish AND H4 bullish AND D1 bullish → alignment = 1.0
two_aligned = any two agree → alignment = 0.7
mixed = all disagree → alignment = 0.3
```

---

## Setup Detection Types

### 1. Trend Pullback
**Conditions:**
- H4 or D1 trending
- H1 retracing to EMA_20 or EMA_50
- RSI between 40–60 (not overbought/oversold)
- Price at or near support (for longs) / resistance (for shorts)

### 2. Breakout Retest
**Conditions:**
- Price broke through key level in last 5–10 candles
- Price returned to retest the broken level
- Volume on breakout was above average
- Level now acting as support (previously resistance) or vice versa

### 3. Range Reversal
**Conditions:**
- Market structure is "ranging"
- Price at range boundary (support or resistance)
- RSI showing divergence or overbought/oversold
- Rejection candle pattern (pin bar, engulfing)

### 4. Momentum Breakout
**Conditions:**
- Strong directional candle (body > 70% of range)
- Volume spike (> 1.5x average)
- Breaking through key level
- ATR expanding

### 5. S/R Rejection
**Conditions:**
- Price touching key support or resistance level
- Rejection candle pattern
- Alignment with higher timeframe trend
- RSI confirmation

---

## Confluence Scoring

Each signal starts with a base confidence of 50 and adjusts based on confluence factors:

| Factor | Points | Condition |
|--------|--------|-----------|
| Timeframe alignment | +15 | All three timeframes agree |
| Timeframe alignment | +8 | Two timeframes agree |
| Clean structure | +10 | Clear HH/HL or LL/LH pattern |
| EMA confluence | +5 | Price at EMA_20 or EMA_50 |
| RSI confirmation | +5 | RSI supports direction |
| Volume confirmation | +5 | Above-average volume |
| Key level proximity | +5 | Within 10 pips of S/R level |
| Candle pattern | +5 | Rejection or engulfing pattern present |
| Session quality | +3 | London or NY session (high liquidity) |
| News risk | -10 | High-impact news within 2 hours |
| Overextension | -8 | RSI > 80 or < 20 |
| Wide spread | -5 | Spread > 2x average |
| Low volatility | -5 | ATR below 0.5x average |
| Conflicting signals | -10 | Timeframes disagree |

**Final confidence = clamp(base + sum_of_factors, 0, 100)**

---

## "No Trade" Logic

A signal receives `verdict: "no_trade"` when ANY of:
1. Final confidence < 45
2. Timeframe alignment score < 0.5
3. Market structure is "ranging" with no clear pattern at boundary
4. News risk is present AND no strong confluence to override
5. ATR is below 0.3x of 30-day average (dead market)
6. Multiple conflicting "reasons against" outweigh "reasons for"
7. Risk-to-reward ratio < 1:1

**Even "no_trade" signals are saved** — they help users understand why NOT to trade and provide learning value.

---

## Output Structure

### Signal Object (DB row)
```typescript
interface SignalOutput {
  pair: string;              // "EUR/USD"
  direction: "long" | "short";
  timeframe: string;         // Primary analysis TF, e.g. "H1"
  entry_price: number;       // Mid-point of entry zone
  stop_loss: number;         // Below/above key structure level
  take_profit_1: number;     // Conservative target (1:1 R:R minimum)
  take_profit_2: number;     // Extended target (2:1 R:R)
  take_profit_3: number;     // Stretch target (3:1 R:R)
  confidence: number;        // 0–100
  setup_type: string;        // "Bullish Flag Breakout", etc.
  ai_reasoning: string;      // Full analysis text
  verdict: "trade" | "no_trade";
  status: "active";
  created_by_ai: true;
  invalidation_reason: string | null;
}
```

### AI Reasoning Text Format
The `ai_reasoning` field should be structured as:
```
**Setup:** {setup_type}
**Direction:** {direction} on {timeframe}
**Entry Zone:** {entry_low} – {entry_high}

**Beginner Explanation:**
{Plain English explanation of what's happening and why this setup exists}

**Expert Analysis:**
{Technical details with indicator values, structure analysis, and confluence}

**Reasons For:**
- {reason 1}
- {reason 2}
- ...

**Reasons Against:**
- {reason 1}
- {reason 2}
- ...

**Invalidation:**
{What would invalidate this setup — specific price level + condition}
```

---

## Example Signal JSON

```json
{
  "pair": "EUR/USD",
  "direction": "long",
  "timeframe": "H1",
  "entry_price": 1.0872,
  "stop_loss": 1.0830,
  "take_profit_1": 1.0910,
  "take_profit_2": 1.0945,
  "take_profit_3": 1.0980,
  "confidence": 78,
  "setup_type": "Bullish Flag Breakout",
  "ai_reasoning": "**Setup:** Bullish Flag Breakout\n**Direction:** Long on H1\n**Entry Zone:** 1.0865 – 1.0878\n\n**Beginner Explanation:**\nEUR/USD has been moving up and just pulled back slightly. This pullback looks like a healthy pause (called a 'flag') before the price continues higher.\n\n**Expert Analysis:**\nH1 bull flag forming after impulsive move from 1.0835 support. H4 bias is bullish with higher lows intact. D1 is neutral but leaning bullish with price above the 50 EMA.\n\n**Reasons For:**\n- H1 and H4 trends aligned bullish\n- Price holding above key support at 1.0835\n- Bull flag pattern with decreasing volume on pullback\n- London session — high liquidity\n\n**Reasons Against:**\n- D1 trend still neutral\n- High-impact news scheduled\n\n**Invalidation:**\nBreak below 1.0830 and close below the flag structure on H1.",
  "verdict": "trade",
  "status": "active",
  "created_by_ai": true,
  "invalidation_reason": null
}
```

---

## Implementation Notes for Claude Code

1. **Edge Function structure:** Create a single `analyze-markets` Edge Function that iterates over all active instruments
2. **Data provider:** Abstract the market data API behind an interface so providers can be swapped (e.g., Twelve Data, Alpha Vantage, OANDA)
3. **Indicator library:** Use a pure TypeScript indicator library (e.g., `technicalindicators` npm package or custom)
4. **Rate limiting:** Respect API rate limits — batch instrument analysis and cache OHLCV data
5. **Idempotency:** Don't create duplicate signals for the same setup — check for existing active signals on the same pair/timeframe
6. **Logging:** Log every analysis step for debugging (what was detected, why it passed/failed)
7. **The mock data in `src/data/mockMarketData.ts` defines the exact structure** — match it when implementing real data ingestion

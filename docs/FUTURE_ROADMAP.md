# PipPilot AI — Future Roadmap

---

## Phase 2: Real Signal Engine & Live Data

**Goal:** Replace mock data with real market data and automated AI signal generation.

### Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Market Data Integration | Connect to a market data API (Twelve Data, Alpha Vantage, or OANDA) for real-time OHLCV data | P0 |
| Signal Engine Edge Function | Scheduled Edge Function that analyzes all active instruments and generates signals | P0 |
| Technical Indicators Library | Calculate EMA, RSI, MACD, ATR, Bollinger Bands from raw OHLCV data | P0 |
| Multi-Timeframe Analysis | Analyze H1, H4, D1 simultaneously for trend alignment and confluence | P0 |
| Setup Pattern Detection | Implement detection for: trend pullback, breakout retest, range reversal, momentum breakout, S/R rejection | P0 |
| Confidence Scoring | Weighted scoring system based on confluence factors | P0 |
| Live Price Display | Replace static mock prices with real-time or near-real-time prices via WebSocket or polling | P1 |
| Chart Integration | Embed TradingView widget or build custom candlestick charts with Recharts | P1 |
| Accurate Pip Values | Calculate real pip values using live exchange rates for cross-currency accounts | P1 |
| Signal Performance Tracking | Track whether TP1/TP2/TP3 were hit after signal generation | P2 |

### Technical Requirements
- Market data API key management (via secrets)
- Cron scheduling for Edge Function (every 15 min during active sessions)
- OHLCV data caching to reduce API calls
- Idempotent signal creation (no duplicates)

---

## Phase 3: Advanced Analytics & Alert Automation

**Goal:** Provide deeper performance insights and automate alert delivery.

### Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Equity Curve Chart | Plot account equity over time based on journal entries | P0 |
| Monthly/Weekly P&L Breakdown | Tabular and chart view of performance by time period | P0 |
| Drawdown Analysis | Maximum drawdown, current drawdown, recovery tracking | P0 |
| Win Rate by Pair/Setup/Session | Breakdown of performance across dimensions | P1 |
| Automated Alerts Engine | Edge Function that monitors prices and triggers alerts automatically | P0 |
| Email Notifications | Send alert emails via Supabase Edge Function + email service (Resend or SendGrid) | P1 |
| Push Notifications | Web Push API via service worker for browser notifications | P2 |
| Telegram Bot Integration | Deliver alerts via Telegram Bot API | P2 |
| Signal Accuracy Dashboard | Admin view showing historical signal accuracy, false positive rate, confidence calibration | P1 |
| Journal Export | Export trade journal to CSV/PDF | P1 |
| Screenshot Upload | Upload chart screenshots to Supabase Storage and attach to journal entries | P1 |

### Technical Requirements
- Supabase Storage bucket for screenshots
- Email service integration (secrets for API key)
- Telegram bot token management
- Performance calculation functions (possibly as DB functions for efficiency)

---

## Phase 4: Optional Broker Integration

**Goal:** Allow users to connect their broker accounts for automated position tracking (NOT auto-trading).

### Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Broker Account Connection | OAuth or API key connection to supported brokers (OANDA, MetaTrader, cTrader) | P0 |
| Live Balance/Equity Sync | Automatically update account balance and equity from broker | P0 |
| Open Position Tracking | Display current open positions with real-time P/L | P0 |
| Auto-Journal from Trades | Automatically create journal entries when broker trades close | P1 |
| Real-Time Risk Monitoring | Calculate actual risk exposure from live positions | P1 |
| One-Click Position Sizing | Pre-fill broker order form with calculated lot size from Risk Calculator | P2 |
| Trade Copier (Optional) | Allow users to manually approve and copy signals to their broker | P2 |

### Important Constraints
- **No auto-trading** — PipPilot AI is an analysis tool, not a trading bot
- Users must always manually confirm any trade execution
- Broker credentials stored securely via Supabase Vault
- Clear disclaimers that broker integration is for convenience, not recommendations

### Technical Requirements
- Broker API abstraction layer (interface for multiple brokers)
- OAuth flow for broker authentication
- Webhook handlers for trade events
- Secure credential storage

---

## Phase 5: AI Learning & Personalization

**Goal:** Use historical data to improve signal quality and personalize recommendations.

### Features
| Feature | Description | Priority |
|---------|-------------|----------|
| Signal Feedback Loop | Use admin review tags (good_signal, false_positive) to tune confidence scoring weights | P0 |
| Personalized Signal Filtering | Auto-prioritize signals based on user's preferred pairs, sessions, and strategies | P0 |
| AI Trade Review | Use LLM to analyze a user's journal entries and suggest improvements | P1 |
| Adaptive Risk Suggestions | Adjust risk recommendations based on user's win rate and recent performance | P1 |
| Pattern Recognition Improvement | Train setup detection on historical signal accuracy data | P2 |
| Market Regime Detection | Classify current market conditions (risk-on, risk-off, ranging, trending) and adjust strategy selection | P2 |
| Natural Language Queries | Allow users to ask questions like "What's the best setup for GBP/USD right now?" | P2 |
| Performance Predictions | Estimate probability of hitting TP based on historical similar setups | P2 |

### Technical Requirements
- LLM integration via Lovable AI (supported models: Gemini, GPT)
- Historical data aggregation and analysis pipeline
- User behavior tracking (which signals they view, follow, or ignore)
- A/B testing framework for scoring weight changes

---

## Phase Summary

| Phase | Focus | Timeline Target |
|-------|-------|----------------|
| **V1 (Current)** | Full MVP with mock data | ✅ Complete |
| **Phase 2** | Real data + signal engine | Next priority |
| **Phase 3** | Analytics + alert automation | After Phase 2 |
| **Phase 4** | Broker integration | Optional, market-driven |
| **Phase 5** | AI learning + personalization | Long-term |

---

## Guiding Principles for All Phases

1. **Risk-first:** Every new feature should reinforce capital preservation
2. **Transparency:** Never hide reasoning or create a "black box"
3. **Beginner-friendly:** Maintain educational elements at every level
4. **No auto-trading:** PipPilot AI assists decisions, never makes them
5. **Progressive disclosure:** Simple by default, detailed on demand
6. **Data privacy:** User trading data is private and never shared
7. **Iterate on feedback:** Admin review system feeds back into signal quality



# PipPilot AI — MVP Plan

## Product Summary
AI-assisted forex trading analysis platform. Dark-mode-first, premium SaaS UI. Helps traders analyze setups, size positions, and get alerts — without auto-trading.

---

## MVP Scope (V1)

### Pages

1. **Dashboard** — Overview: active watchlist, recent signals, market summary cards, risk snapshot
2. **Signal Explorer** — Browse AI-generated trade setups with filters (pair, timeframe, confidence). Each signal shows entry/exit zones, stop-loss, reasoning, and a "No Trade" verdict when conditions are poor
3. **Signal Detail** — Full breakdown of a single setup: chart placeholder, AI explanation (beginner-friendly), risk/reward ratio, position size calculator inline
4. **Position Size Calculator** — Standalone tool: input account size, risk %, stop-loss distance → outputs lot size and dollar risk
5. **Alerts** — List of user-configured alerts with status (pending/triggered/expired). Set alerts from signals
6. **Settings / Profile** — Account info, risk preferences (default risk %, account size), notification preferences
7. **Auth Pages** — Login, signup, password reset

### Core Database Entities (Supabase)

| Entity | Key Fields |
|---|---|
| **profiles** | user_id, display_name, account_size, default_risk_pct, experience_level |
| **signals** | id, pair, timeframe, direction, entry_price, stop_loss, take_profit_1/2, confidence, ai_reasoning, verdict (trade/no_trade), status, created_at |
| **user_watchlist** | user_id, pair |
| **alerts** | id, user_id, signal_id, condition, status (pending/triggered/expired), triggered_at |
| **user_roles** | id, user_id, role (enum) |

### UI Direction
- **Dark mode first** with deep navy/charcoal background (#0F172A range)
- Accent color: electric blue (#3B82F6) for actionable elements, green/red for bullish/bearish
- Card-based layout with subtle glassmorphism and soft borders
- Clean typography: Inter for body, bold geometric headings
- Minimal chrome — data-dense but uncluttered
- Mobile-responsive from day one

### Architecture Principles
- All signal data structured for future backend engine integration (signals table is engine-ready)
- Modular components: SignalCard, RiskCalculator, AlertRow reusable across pages
- React Query for data fetching, ready for real-time subscriptions later
- Supabase auth + RLS from the start
- AI reasoning stored as structured text, not hardcoded — ready for LLM integration

### What's NOT in V1
- No live chart integration (placeholder chart areas)
- No auto-trading or broker connection
- No payment/subscription (free tier only)
- No real-time price feeds (mock/static data for now)
- No mobile app

### Implementation Order
1. Auth + database schema + RLS policies
2. Dashboard layout + navigation shell
3. Signal Explorer + Signal Detail pages with mock data
4. Position Size Calculator
5. Alerts system
6. Settings/Profile page


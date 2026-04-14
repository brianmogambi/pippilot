# PipPilot AI — Database Schema

All tables are in the `public` schema with Row-Level Security (RLS) enabled.

---

## 1. `profiles`

### Purpose
Stores user profile information, trading preferences, and app settings. Auto-created on signup via the `handle_new_user` trigger.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | References `auth.users(id)` (no FK constraint) |
| `display_name` | text | Yes | — | User's display name |
| `experience_level` | text | Yes | `'beginner'` | beginner / intermediate / advanced |
| `trading_style` | text | Yes | `'intraday'` | scalping / intraday / swing |
| `default_timeframe` | text | Yes | `'H1'` | Preferred chart timeframe |
| `preferred_pairs` | text[] | Yes | `'{}'` | Array of preferred currency pairs |
| `preferred_sessions` | text[] | Yes | `'{}'` | Array of preferred trading sessions |
| `preferred_strategies` | text[] | Yes | `'{}'` | Array of enabled strategy types |
| `account_currency` | text | No | `'USD'` | Account base currency |
| `account_size` | numeric | Yes | `10000` | Account balance |
| `account_equity` | numeric | Yes | `10000` | Account equity |
| `default_risk_pct` | numeric | Yes | `1` | Default risk % per trade |
| `max_daily_loss_pct` | numeric | Yes | `5` | Maximum daily loss percentage |
| `broker_name` | text | Yes | — | User's broker name |
| `notifications_enabled` | boolean | Yes | `true` | Global notification toggle |
| `alert_channels` | text[] | Yes | `'{in_app}'` | Enabled notification channels |
| `onboarding_completed` | boolean | Yes | `false` | Whether user finished onboarding |
| `timezone` | text | Yes | `'UTC'` | User's timezone |
| `created_at` | timestamptz | No | `now()` | Record creation time |
| `updated_at` | timestamptz | No | `now()` | Last update time |

### RLS Policies
- SELECT: Users can view own profile (`user_id = auth.uid()`)
- UPDATE: Users can update own profile (`user_id = auth.uid()`)
- INSERT: Not allowed (auto-created by trigger)
- DELETE: Not allowed

### Example Record
```json
{
  "id": "a1b2c3d4-...",
  "user_id": "f5e6d7c8-...",
  "display_name": "John Trader",
  "experience_level": "beginner",
  "trading_style": "intraday",
  "default_timeframe": "H1",
  "preferred_pairs": ["EUR/USD", "GBP/USD"],
  "preferred_sessions": ["london", "new_york"],
  "preferred_strategies": ["trend_pullback", "breakout_retest"],
  "account_currency": "USD",
  "account_size": 10000,
  "account_equity": 10000,
  "default_risk_pct": 1,
  "max_daily_loss_pct": 5,
  "broker_name": null,
  "notifications_enabled": true,
  "alert_channels": ["in_app"],
  "onboarding_completed": true,
  "timezone": "America/New_York"
}
```

---

## 2. `trading_accounts`

### Purpose
Stores trading account details (balance, equity, leverage). Auto-created on signup. Supports multiple accounts per user with one default.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `account_name` | text | No | `'Primary'` | Account label |
| `account_currency` | text | No | `'USD'` | Base currency |
| `balance` | numeric | No | `10000` | Account balance |
| `equity` | numeric | No | `10000` | Account equity |
| `leverage` | numeric | Yes | — | Account leverage ratio |
| `broker_name` | text | Yes | — | Broker name |
| `is_default` | boolean | No | `true` | Whether this is the default account |
| `account_mode` | text | No | `'demo'` | Demo vs real (`'demo'` \| `'real'`). Phase 1. |
| `created_at` | timestamptz | No | `now()` | Created timestamp |
| `updated_at` | timestamptz | No | `now()` | Updated timestamp |

`account_mode` is the source of truth for demo-vs-real separation throughout the app. Rows created before Phase 1 default to `'demo'`.

### RLS Policies
- SELECT, INSERT, UPDATE, DELETE: Users can manage own accounts (`user_id = auth.uid()`)

### Example Record
```json
{
  "id": "b2c3d4e5-...",
  "user_id": "f5e6d7c8-...",
  "account_name": "Primary",
  "account_currency": "USD",
  "balance": 10000,
  "equity": 10250,
  "leverage": 100,
  "broker_name": "IC Markets",
  "is_default": true,
  "account_mode": "demo"
}
```

---

## 3. `user_risk_profiles`

### Purpose
Stores per-user risk management parameters. Auto-created on signup with conservative defaults.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `risk_per_trade_pct` | numeric | No | `1` | Default risk % per trade |
| `max_daily_loss_pct` | numeric | No | `5` | Max daily loss % |
| `max_total_open_risk_pct` | numeric | No | `10` | Max cumulative open risk % |
| `conservative_mode` | boolean | No | `false` | Halves position sizes when enabled |
| `created_at` | timestamptz | No | `now()` | Created timestamp |
| `updated_at` | timestamptz | No | `now()` | Updated timestamp |

### RLS Policies
- SELECT, INSERT, UPDATE: Users can manage own profile (`user_id = auth.uid()`)
- DELETE: Not allowed

### Example Record
```json
{
  "id": "c3d4e5f6-...",
  "user_id": "f5e6d7c8-...",
  "risk_per_trade_pct": 1,
  "max_daily_loss_pct": 5,
  "max_total_open_risk_pct": 10,
  "conservative_mode": false
}
```

---

## 4. `instruments`

### Purpose
Master list of tradeable instruments (forex pairs, commodities). Admin-managed.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `symbol` | text | No | — | Instrument symbol (e.g., "EUR/USD") |
| `base_currency` | text | No | — | Base currency code |
| `quote_currency` | text | No | — | Quote currency code |
| `instrument_type` | text | No | `'forex'` | Type (forex, commodity, etc.) |
| `pip_value` | numeric | Yes | — | Pip value per standard lot |
| `is_active` | boolean | No | `true` | Whether instrument is available |
| `created_at` | timestamptz | No | `now()` | Created timestamp |

### RLS Policies
- SELECT: All authenticated users can view
- INSERT, UPDATE: Admins only (`has_role(auth.uid(), 'admin')`)
- DELETE: Not allowed

### Example Record
```json
{
  "id": "d4e5f6g7-...",
  "symbol": "EUR/USD",
  "base_currency": "EUR",
  "quote_currency": "USD",
  "instrument_type": "forex",
  "pip_value": 10,
  "is_active": true
}
```

---

## 5. `user_watchlist`

### Purpose
Stores user's favorited instruments for quick access.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `pair` | text | No | — | Instrument symbol |
| `created_at` | timestamptz | No | `now()` | When added |

### RLS Policies
- SELECT: Users can view own watchlist (`user_id = auth.uid()`)
- INSERT: Users can add to own watchlist (`user_id = auth.uid()`)
- DELETE: Users can remove from own watchlist (`user_id = auth.uid()`)
- UPDATE: Not allowed

### Example Record
```json
{
  "id": "e5f6g7h8-...",
  "user_id": "f5e6d7c8-...",
  "pair": "EUR/USD",
  "created_at": "2026-04-01T10:30:00Z"
}
```

---

## 6. `signals`

### Purpose
AI-generated trade signals with full analysis data. Created by the AI engine or admin. Readable by all authenticated users.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `pair` | text | No | — | Currency pair |
| `direction` | text | No | — | "long" or "short" |
| `timeframe` | text | No | — | Analysis timeframe (e.g., "H1") |
| `entry_price` | numeric | No | — | Suggested entry price |
| `stop_loss` | numeric | No | — | Stop loss level |
| `take_profit_1` | numeric | No | — | First take profit target |
| `take_profit_2` | numeric | Yes | — | Second TP target |
| `take_profit_3` | numeric | Yes | — | Third TP target |
| `confidence` | integer | No | — | Confidence score (0–100) |
| `setup_type` | text | Yes | — | Pattern type name |
| `ai_reasoning` | text | No | — | Full AI analysis text |
| `verdict` | text | No | — | "trade" or "no_trade" |
| `status` | text | No | `'active'` | active / monitoring / triggered / invalidated / closed |
| `created_by_ai` | boolean | No | `true` | Whether auto-generated |
| `invalidation_reason` | text | Yes | — | Why signal was invalidated |
| `review_tag` | text | Yes | — | Admin review tag |
| `review_notes` | text | Yes | — | Admin review notes |
| `reviewed_at` | timestamptz | Yes | — | When reviewed |
| `reviewed_by` | uuid | Yes | — | Reviewer user ID |
| `created_at` | timestamptz | No | `now()` | Created timestamp |
| `updated_at` | timestamptz | No | `now()` | Updated timestamp |

### RLS Policies
- SELECT: All authenticated users can view all signals
- ALL (INSERT, UPDATE, DELETE): Admins only (`has_role(auth.uid(), 'admin')`)

### Example Record
```json
{
  "id": "f6g7h8i9-...",
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
  "ai_reasoning": "H1 bull flag forming after impulsive move...",
  "verdict": "trade",
  "status": "active",
  "created_by_ai": true,
  "review_tag": "good_signal",
  "review_notes": "Clean setup, well-identified pattern"
}
```

---

## 7. `alerts`

### Purpose
Notifications triggered by market conditions or signal events.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `signal_id` | uuid | No | — | Related signal |
| `pair` | text | No | — | Currency pair |
| `type` | text | No | `'price'` | Alert type |
| `condition` | text | No | — | Trigger condition description |
| `title` | text | Yes | — | Alert title |
| `message` | text | Yes | — | Detailed message |
| `severity` | text | No | `'info'` | info / warning / critical |
| `status` | text | No | `'pending'` | pending / triggered / dismissed |
| `is_read` | boolean | No | `false` | Read status |
| `timeframe` | text | Yes | — | Related timeframe |
| `triggered_at` | timestamptz | Yes | — | When triggered |
| `review_tag` | text | Yes | — | Admin review tag |
| `review_notes` | text | Yes | — | Admin review notes |
| `reviewed_at` | timestamptz | Yes | — | When reviewed |
| `reviewed_by` | uuid | Yes | — | Reviewer ID |
| `created_at` | timestamptz | No | `now()` | Created timestamp |

### RLS Policies
- SELECT, INSERT, UPDATE, DELETE: Users can manage own alerts (`user_id = auth.uid()`)
- ALL: Admins can manage all alerts (`has_role(auth.uid(), 'admin')`)

### Relationships
- `signal_id` → `signals(id)` (foreign key)

### Example Record
```json
{
  "id": "g7h8i9j0-...",
  "user_id": "f5e6d7c8-...",
  "signal_id": "f6g7h8i9-...",
  "pair": "EUR/USD",
  "type": "price",
  "condition": "EUR/USD crossed above 1.0900",
  "title": "EUR/USD TP1 Approaching",
  "message": "Price is within 10 pips of take profit 1",
  "severity": "info",
  "status": "triggered",
  "is_read": false,
  "triggered_at": "2026-04-03T14:22:00Z"
}
```

---

## 8. `trade_journal_entries`

### Purpose
User's personal trade diary for tracking performance and learning.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `pair` | text | No | — | Traded pair |
| `direction` | text | No | — | "long" or "short" |
| `entry_price` | numeric | No | — | Actual entry price |
| `exit_price` | numeric | Yes | — | Actual exit price |
| `stop_loss` | numeric | Yes | — | Stop loss level |
| `take_profit` | numeric | Yes | — | Take profit target |
| `lot_size` | numeric | Yes | — | Position size in lots |
| `result_pips` | numeric | Yes | — | P/L in pips |
| `result_amount` | numeric | Yes | — | P/L in account currency |
| `status` | text | No | `'open'` | open / closed |
| `followed_plan` | boolean | No | `true` | Did user follow their plan? |
| `confidence` | integer | Yes | — | Entry confidence (0–100) |
| `setup_type` | text | Yes | — | Pattern traded |
| `setup_reasoning` | text | Yes | — | Why the trade was taken |
| `notes` | text | Yes | — | General notes |
| `emotional_notes` | text | Yes | — | Emotional state notes |
| `lesson_learned` | text | Yes | — | Retrospective learning |
| `screenshot_url` | text | Yes | — | Chart screenshot URL |
| `opened_at` | timestamptz | No | `now()` | When trade was opened |
| `closed_at` | timestamptz | Yes | — | When trade was closed |
| `executed_trade_id` | uuid | Yes | — | Optional FK to `executed_trades(id)`. Phase 1. |
| `created_at` | timestamptz | No | `now()` | Record created |
| `updated_at` | timestamptz | No | `now()` | Record updated |

Pre-Phase-1 journal rows and manual journal-only entries have `executed_trade_id = null`.

### Relationships
- `executed_trade_id` → `executed_trades(id)` `on delete set null`

### RLS Policies
- SELECT, INSERT, UPDATE, DELETE: Users can manage own entries (`user_id = auth.uid()`)

### Example Record
```json
{
  "id": "h8i9j0k1-...",
  "user_id": "f5e6d7c8-...",
  "pair": "EUR/USD",
  "direction": "long",
  "entry_price": 1.0872,
  "exit_price": 1.0910,
  "stop_loss": 1.0830,
  "take_profit": 1.0910,
  "lot_size": 0.24,
  "result_pips": 38,
  "result_amount": 91.20,
  "status": "closed",
  "followed_plan": true,
  "confidence": 78,
  "setup_type": "Bullish Flag Breakout",
  "setup_reasoning": "H1 bull flag with H4 bullish alignment",
  "emotional_notes": "Felt confident, no FOMO",
  "lesson_learned": "Patience paid off — waited for flag breakout confirmation"
}
```

---

## 9. `executed_trades`

### Purpose
Dedicated record of a trade the user has actually taken. Each row captures the **actual execution** (entry price, stop, TP, lot size, P&L) alongside a **snapshot of the originating signal** as it existed at the moment the trade was taken. Added in Phase 1 to enable the signal → trade → journal → AI review workflow.

Manual trades are supported by leaving `signal_id = null`.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `account_id` | uuid | No | — | FK → `trading_accounts(id)` |
| `account_mode` | text | No | — | `'demo'` or `'real'` — snapshotted from the account at insert time |
| `signal_id` | uuid | Yes | — | FK → `signals(id)`. Null = manual trade. |
| `symbol` | text | No | — | Traded symbol (e.g. `"EUR/USD"`) |
| `direction` | text | No | — | `'long'` or `'short'` |
| `planned_entry_low` | numeric | Yes | — | Planned entry zone low (from signal) |
| `planned_entry_high` | numeric | Yes | — | Planned entry zone high (from signal) |
| `planned_stop_loss` | numeric | Yes | — | Planned SL (from signal) |
| `planned_take_profit_1` | numeric | Yes | — | Planned TP1 (from signal) |
| `planned_take_profit_2` | numeric | Yes | — | Planned TP2 (from signal) |
| `planned_confidence` | integer | Yes | — | Signal confidence at take-trade time |
| `planned_setup_type` | text | Yes | — | Signal setup type snapshot |
| `planned_timeframe` | text | Yes | — | Signal timeframe snapshot |
| `planned_reasoning_snapshot` | text | Yes | — | Copy of `signals.ai_reasoning` at take-trade time |
| `actual_entry_price` | numeric | No | — | Price the user actually entered at |
| `actual_stop_loss` | numeric | Yes | — | SL the user actually placed |
| `actual_take_profit` | numeric | Yes | — | TP the user actually placed |
| `actual_exit_price` | numeric | Yes | — | Price the trade actually closed at |
| `lot_size` | numeric | Yes | — | Position size in lots |
| `position_size` | numeric | Yes | — | Position size in units/contracts (non-forex) |
| `opened_at` | timestamptz | No | `now()` | When the trade was opened |
| `closed_at` | timestamptz | Yes | — | When the trade was closed |
| `result_status` | text | No | `'open'` | `open` / `win` / `loss` / `breakeven` / `cancelled` |
| `pnl` | numeric | Yes | — | Realised P&L in account currency |
| `pnl_percent` | numeric | Yes | — | Realised P&L as a percent of account equity |
| `broker_position_id` | text | Yes | — | Broker ticket ID (used by Phase 2 broker linking) |
| `notes` | text | Yes | — | Free-form execution notes |
| `created_at` | timestamptz | No | `now()` | Record created |
| `updated_at` | timestamptz | No | `now()` | Record updated |

### RLS Policies
- SELECT, INSERT, UPDATE, DELETE: Users can manage own trades (`user_id = auth.uid()`)
- ALL: Service role can manage all trades

### Relationships
- `user_id` → `auth.users(id)` `on delete cascade`
- `account_id` → `trading_accounts(id)` `on delete restrict` (trade history must never silently disappear with an account)
- `signal_id` → `signals(id)` `on delete set null` (signal housekeeping preserves trade history; the `planned_*` snapshot retains the context)

### Indexes
- `(user_id, opened_at desc)` — user timeline
- `(account_id)` — per-account lookups
- `(signal_id) where signal_id is not null` — signal → trade joins
- `(user_id, account_mode, result_status)` — Phase 7 analytics split

### Design note
`account_mode` is denormalized from `trading_accounts.account_mode` at insert time. This keeps analytics filters cheap and, more importantly, means history does not silently rewrite if a user later flips an account's mode. The `planned_*` columns are a full snapshot rather than a join on `signals` because signals can be invalidated, edited, or even deleted — and we always need to reason about the setup *as it was when the trade was taken*.

### Example — signal-linked trade
```json
{
  "id": "i9j0k1l2-...",
  "user_id": "f5e6d7c8-...",
  "account_id": "b2c3d4e5-...",
  "account_mode": "demo",
  "signal_id": "f6g7h8i9-...",
  "symbol": "EUR/USD",
  "direction": "long",
  "planned_entry_low": 1.0872,
  "planned_entry_high": 1.0872,
  "planned_stop_loss": 1.0830,
  "planned_take_profit_1": 1.0910,
  "planned_take_profit_2": 1.0945,
  "planned_confidence": 78,
  "planned_setup_type": "Bullish Flag Breakout",
  "planned_timeframe": "H1",
  "planned_reasoning_snapshot": "H1 bull flag forming after impulsive move...",
  "actual_entry_price": 1.0878,
  "actual_stop_loss": 1.0840,
  "actual_take_profit": 1.0910,
  "lot_size": 0.24,
  "opened_at": "2026-04-14T08:30:00Z",
  "result_status": "open"
}
```

### Example — manual trade
```json
{
  "id": "j0k1l2m3-...",
  "user_id": "f5e6d7c8-...",
  "account_id": "b2c3d4e5-...",
  "account_mode": "real",
  "signal_id": null,
  "symbol": "GBP/USD",
  "direction": "short",
  "actual_entry_price": 1.2520,
  "actual_stop_loss": 1.2560,
  "actual_take_profit": 1.2450,
  "lot_size": 0.10,
  "opened_at": "2026-04-14T09:15:00Z",
  "result_status": "open",
  "notes": "Manual discretionary short on H4 supply rejection."
}
```

---

## 10. `user_roles`

### Purpose
Role-based access control. Roles are stored separately from profiles to prevent privilege escalation.

### Fields
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | uuid | No | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | No | — | User ID |
| `role` | app_role (enum) | No | — | admin / moderator / user |

### Enum: `app_role`
Values: `'admin'`, `'moderator'`, `'user'`

### RLS Policies
- SELECT: Users can view own roles (`user_id = auth.uid()`)
- ALL: Admins can manage all roles (`has_role(auth.uid(), 'admin')`)

### Unique Constraint
`(user_id, role)` — prevents duplicate role assignments.

---

## Database Functions

### `has_role(_user_id uuid, _role app_role) → boolean`
Security-definer function that checks if a user has a specific role. Used in RLS policies to prevent recursive checks.

### `handle_new_user() → trigger`
Triggered on `auth.users` INSERT. Creates:
1. A `profiles` row with display name from metadata or email
2. A `trading_accounts` row with $10,000 USD defaults
3. A `user_risk_profiles` row with conservative defaults

---

## Entity Relationship Diagram (Conceptual)

```
auth.users (managed by Supabase Auth)
    │
    ├── profiles (1:1)
    ├── trading_accounts (1:many, one default)  ── account_mode: demo | real
    │       │
    │       └── executed_trades (1:many)  ── account_mode snapshot
    ├── user_risk_profiles (1:1)
    ├── user_roles (1:many)
    ├── user_watchlist (1:many)
    ├── executed_trades (1:many)  ── signal_id → signals (nullable)
    │       ↑
    │       └─ (Phase 1) trade_journal_entries.executed_trade_id (nullable)
    ├── trade_journal_entries (1:many)
    └── alerts (1:many)
            │
            └── signals (many:1 via signal_id FK)

instruments (standalone, admin-managed)
signals (standalone, admin/AI-managed, readable by all)
    ↑
    └── executed_trades.signal_id (nullable, on delete set null)
```

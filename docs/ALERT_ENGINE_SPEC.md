# PipPilot AI — Alert Engine Specification

---

## Overview

The alert engine generates and delivers notifications when market conditions, signal states, or risk thresholds change. Currently, alerts are manually created DB rows. This document specifies the intended automated system.

---

## Alert Types

| Type | Description | Trigger |
|------|-------------|---------|
| `price` | Price crosses a specific level | Price hits S/R, TP, or SL level |
| `signal_new` | New signal generated | Signal engine creates a new active signal |
| `signal_status` | Signal status changes | Signal moves to triggered/invalidated/closed |
| `risk_limit` | Risk threshold breached | Daily loss limit or total exposure exceeded |
| `news` | High-impact news approaching | Economic calendar event within configured window |
| `volatility` | Volatility spike or drop | ATR crosses threshold |
| `session` | Trading session opening/closing | Session transition |

---

## Trigger Conditions

### Price Alerts
```
Condition: "{pair} {operator} {price}"
Operators: crosses_above, crosses_below, reaches

Examples:
- "EUR/USD crosses_above 1.0900"
- "GBP/USD crosses_below 1.2700"
- "XAU/USD reaches 2400.00"
```

### Signal Alerts
```
Condition: "New {quality}+ signal on {pair}"
Condition: "Signal {id} status changed to {status}"
Condition: "Signal {id} TP1 hit"

Examples:
- "New A+ signal on EUR/USD"
- "Signal abc123 invalidated — price broke below SL"
- "Signal abc123 TP1 reached at 1.0910"
```

### Risk Alerts
```
Condition: "Daily loss exceeds {threshold}%"
Condition: "Total open risk exceeds {threshold}%"

Examples:
- "Daily loss exceeds 3% — approaching limit"
- "Total open risk at 6.2% — exceeds 5% threshold"
```

---

## Severity Levels

| Severity | Use Cases | Visual |
|----------|-----------|--------|
| `info` | New signal available, session opening, FYI notifications | Blue badge |
| `warning` | Risk approaching limit, news in 1 hour, volatility spike | Yellow/amber badge |
| `critical` | Daily loss limit hit, signal invalidated, SL triggered | Red badge |

### Severity Assignment Rules
```
info:
  - New signal generated (any quality)
  - Session transition
  - Price approaching level (within 20% of distance)

warning:
  - Daily loss > 60% of max limit
  - High-impact news within 2 hours
  - ATR spike > 1.5x average
  - Signal quality downgraded

critical:
  - Daily loss limit reached
  - Signal SL hit
  - Signal invalidated
  - Total exposure > max threshold
```

---

## Delivery Channels

| Channel | Status | Implementation |
|---------|--------|---------------|
| `in_app` | ✅ Implemented | DB row + real-time query polling |
| `email` | 🔜 Planned | Supabase Edge Function → email service |
| `push` | 🔜 Planned | Web Push API via service worker |
| `telegram` | 🔜 Planned | Telegram Bot API via Edge Function |

### Channel Configuration
Users configure preferred channels in Settings (`profiles.alert_channels` array). An alert is delivered to ALL enabled channels simultaneously.

---

## Deduplication Logic

Prevent alert spam with these rules:

### 1. Same-condition cooldown
```
IF an alert with the same (pair, type, condition) was created within the last 4 hours:
  → Skip (do not create duplicate)
```

### 2. Session-based dedup for price alerts
```
IF a price alert for the same pair and direction was triggered in the current session:
  → Skip unless price has moved 50+ pips since last alert
```

### 3. Signal status dedup
```
Each signal status change generates at most ONE alert.
Track alert creation per (signal_id, status) combination.
```

### 4. Rate limiting per user
```
Maximum alerts per user per hour: 10
Maximum alerts per user per day: 50
IF limit exceeded: batch remaining alerts into a daily summary
```

---

## Alert Lifecycle

```
┌──────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐
│ Created   │────▶│ Pending   │────▶│ Triggered │────▶│ Read      │
│ (engine)  │     │ (waiting) │     │ (sent)    │     │ (user)    │
└──────────┘     └───────────┘     └──────────┘     └───────────┘
                                         │
                                         ▼
                                   ┌───────────┐
                                   │ Dismissed  │
                                   │ (user)     │
                                   └───────────┘
```

**Status values:**
- `pending` — Alert condition defined but not yet triggered
- `triggered` — Condition met, alert delivered
- `dismissed` — User dismissed without reading fully

---

## Example Alert JSON

### New Signal Alert
```json
{
  "id": "a1b2c3d4-...",
  "user_id": "f5e6d7c8-...",
  "signal_id": "e4f5g6h7-...",
  "pair": "EUR/USD",
  "type": "signal_new",
  "condition": "New A-grade signal generated for EUR/USD",
  "title": "New Signal: EUR/USD Long",
  "message": "A new bullish flag breakout signal has been generated for EUR/USD on H1. Confidence: 78%. Entry zone: 1.0865–1.0878.",
  "severity": "info",
  "status": "triggered",
  "is_read": false,
  "timeframe": "H1",
  "triggered_at": "2026-04-03T09:15:00Z",
  "created_at": "2026-04-03T09:15:00Z"
}
```

### Risk Warning Alert
```json
{
  "id": "b2c3d4e5-...",
  "user_id": "f5e6d7c8-...",
  "signal_id": "00000000-0000-0000-0000-000000000000",
  "pair": "PORTFOLIO",
  "type": "risk_limit",
  "condition": "Daily loss exceeds 3% of account balance",
  "title": "⚠️ Daily Loss Warning",
  "message": "Your total daily loss has reached 3.2% ($320). Your maximum daily loss limit is 5% ($500). Consider reducing position sizes or stopping for today.",
  "severity": "warning",
  "status": "triggered",
  "is_read": false,
  "timeframe": null,
  "triggered_at": "2026-04-03T14:45:00Z",
  "created_at": "2026-04-03T14:45:00Z"
}
```

### Signal Invalidated Alert
```json
{
  "id": "c3d4e5f6-...",
  "user_id": "f5e6d7c8-...",
  "signal_id": "e4f5g6h7-...",
  "pair": "GBP/USD",
  "type": "signal_status",
  "condition": "Signal invalidated — price broke above stop loss level",
  "title": "Signal Invalidated: GBP/USD Short",
  "message": "The bearish continuation signal for GBP/USD has been invalidated. Price broke above the 1.2785 resistance level. If you entered this trade, consider exiting.",
  "severity": "critical",
  "status": "triggered",
  "is_read": false,
  "timeframe": "H1",
  "triggered_at": "2026-04-03T16:30:00Z",
  "created_at": "2026-04-03T16:30:00Z"
}
```

---

## Implementation Notes

1. **Edge Function:** Create a `process-alerts` Edge Function that runs on a schedule or is triggered by signal/price changes
2. **Real-time:** Enable Supabase Realtime on the `alerts` table so the frontend receives instant updates
3. **Batch processing:** For price alerts, batch-check all pending price conditions against current prices in one pass
4. **User preferences:** Respect `profiles.notifications_enabled` and `profiles.alert_channels` — don't send if disabled
5. **Admin alerts:** Admin review alerts (signal tagged as false_positive) could auto-notify the admin channel

# Notification Delivery — Phase 12

Outbound alert delivery for PipPilot AI. Sends alerts via email and Telegram based on user preferences, with throttling, deduplication, and auditable delivery logs.

## Architecture

```
evaluate-alerts Edge Function
  │  inserts new alerts into `alerts` table
  │
  ▼  fire-and-forget POST /functions/v1/deliver-notifications
deliver-notifications Edge Function
  │
  ▼
delivery-orchestrator (_shared)
  ├─ user prefs check (notifications_enabled, alert_channels, preferred_pairs)
  ├─ severity routing (severity_channel_routing jsonb on profiles)
  ├─ throttle check (per-user, per-channel rate limits)
  ├─ dedup check (unique constraint on notification_deliveries)
  │
  ▼
notification-channels (_shared)
  ├─ email → Resend HTTP API
  └─ telegram → Telegram Bot API
  │
  ▼
notification_deliveries table (delivery log)
```

Alert generation (the pure alert engine) is completely unchanged. Delivery is a separate, decoupled pipeline.

## Supported Channels

| Channel  | Provider          | Recipient Source                       |
|----------|-------------------|----------------------------------------|
| Email    | Resend            | `profiles.notification_email` or login email |
| Telegram | Telegram Bot API  | `profiles.telegram_chat_id`            |
| Push     | (extension point) | Not yet implemented                    |

## Supported Alert Types

All `AlertEventKind` values are deliverable:

| Event Kind             | Severity | Description                     |
|------------------------|----------|---------------------------------|
| `entry_reached`        | info     | Price hit the entry level       |
| `tp1_reached`          | info     | Take-profit 1 reached           |
| `tp2_reached`          | info     | Take-profit 2 reached           |
| `tp3_reached`          | info     | Take-profit 3 reached           |
| `invalidation`         | warning  | Setup invalidated (SL breached) |
| `risk_breach`          | critical | Account risk limit exceeded     |
| `setup_forming`        | info     | New trade setup forming         |
| `confirmation_reached` | info     | Entry confirmation received     |

## Database Schema

### notification_deliveries

| Column        | Type        | Notes                                   |
|---------------|-------------|-----------------------------------------|
| id            | uuid PK     | gen_random_uuid()                       |
| alert_id      | uuid FK     | → alerts(id) cascade                    |
| user_id       | uuid FK     | → auth.users(id) cascade               |
| channel       | text        | 'email', 'telegram', or 'push'         |
| status        | text        | 'pending', 'sent', 'failed', 'skipped' |
| skip_reason   | text        | 'throttled', 'severity_routing', 'no_recipient', etc. |
| error_message | text        | Error details for failed deliveries     |
| attempt_count | int         | Number of send attempts                 |
| sent_at       | timestamptz | Timestamp of successful delivery        |
| created_at    | timestamptz | Row creation time                       |

Unique constraint: `(alert_id, user_id, channel)` — prevents duplicate delivery per channel per alert.

### profiles extensions

| Column                   | Type  | Description                                      |
|--------------------------|-------|--------------------------------------------------|
| telegram_chat_id         | text  | Telegram chat ID for outbound alerts             |
| notification_email       | text  | Override email; falls back to auth login email   |
| severity_channel_routing | jsonb | Map of severity → channel[], e.g. `{"critical":["email","telegram"]}` |

When `severity_channel_routing` is null, all enabled channels receive all severity levels.

## Anti-Spam Measures

1. **User preferences**: Only delivers to channels the user explicitly enabled
2. **Preferred pairs**: If set, only delivers alerts for those pairs
3. **Severity routing**: Users control which severities go to which channels
4. **Throttle limits**: Email 10/hour, Telegram 20/hour per user
5. **Deduplication**: Unique constraint prevents re-delivery of the same alert
6. **Notifications toggle**: Global kill switch via `notifications_enabled`

## Retry Behavior

Failed deliveries are logged with `status = 'failed'` and `attempt_count`. When `deliver-notifications` is called with an empty body (retry mode), it:

1. Queries `notification_deliveries` where `status = 'failed'`, `attempt_count < 3`, and `created_at` within the last 24 hours
2. Re-fetches the associated alerts
3. Re-runs the orchestrator (which respects all preference/throttle checks)

## Environment Variables

Set these as Supabase Edge Function secrets:

| Variable                 | Required | Description                          |
|--------------------------|----------|--------------------------------------|
| `RESEND_API_KEY`         | Yes      | API key from resend.com              |
| `NOTIFICATION_FROM_EMAIL`| No       | Verified sender (default: `alerts@pippilot.app`) |
| `TELEGRAM_BOT_TOKEN`     | Yes      | Bot token from BotFather             |

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set NOTIFICATION_FROM_EMAIL=alerts@yourdomain.com
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC-DEF
```

## Testing Locally

```bash
# Start Edge Functions locally
supabase functions serve

# Primary mode: deliver specific alerts
curl -X POST http://localhost:54321/functions/v1/deliver-notifications \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alert_ids": ["<alert-uuid>"]}'

# Retry mode: retry recent failures
curl -X POST http://localhost:54321/functions/v1/deliver-notifications \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Adding a New Channel

1. Create a `NotificationChannel` implementation in `supabase/functions/_shared/notification-channels.ts`:

```typescript
const smsChannel: NotificationChannel = {
  name: "sms",
  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    // Your SMS provider logic here
  },
};
```

2. Register it in the `CHANNELS` map in the same file
3. Add the channel value to the database check constraint on `notification_deliveries.channel`
4. Add the channel option to `ALERT_CHANNELS` in `src/pages/SettingsPage.tsx`
5. Add recipient resolution logic in `delivery-orchestrator.ts`

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260415100000_add_notification_deliveries.sql` | DB schema |
| `supabase/functions/_shared/notification-channels.ts` | Channel senders |
| `supabase/functions/_shared/delivery-orchestrator.ts` | Orchestration logic |
| `supabase/functions/deliver-notifications/index.ts` | Edge Function entry |
| `supabase/functions/evaluate-alerts/index.ts` | Modified to trigger delivery |
| `src/integrations/supabase/types.ts` | Updated TypeScript types |
| `src/pages/SettingsPage.tsx` | Channel config UI |

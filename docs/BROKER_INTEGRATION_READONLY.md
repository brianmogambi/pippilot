# Broker Integration — Read-Only Mode (Phase 14)

## Overview

Phase 14 adds optional, read-only syncing of real account and position state from external trading platforms. PipPilot can observe what is happening in a broker account without placing, modifying, or closing any trades.

**Key principle:** The deterministic signal/risk/alert engines remain the sole source of truth for trading decisions. Synced broker data is observational — it shows what IS happening, while PipPilot's logic shows what SHOULD happen.

## Architecture

```
Broker (MT5 / cTrader / Custom)
       │
       ▼
[MT5 Bridge Server]          ← External service (not part of PipPilot)
       │  HTTP/WebSocket
       ▼
[sync-broker-data]           ← Supabase Edge Function (Deno)
  └── _shared/broker/
      ├── types.ts            (BrokerAdapter interface + normalized types)
      ├── adapter-factory.ts  (maps broker_type → concrete adapter)
      ├── mt5-adapter.ts      (stub — requires bridge server)
      ├── sync-service.ts     (orchestrator: adapter → DB → logs)
      └── credential-vault.ts (AES-256-GCM encryption)
       │
       ▼
[PostgreSQL]                 ← 6 new tables
  ├── broker_connections      (user ↔ broker link + encrypted credentials)
  ├── synced_accounts         (account balances, equity, margin)
  ├── open_positions          (current open trades)
  ├── pending_orders          (limit/stop orders)
  ├── account_snapshots       (periodic equity curve points)
  └── sync_logs               (audit trail)
       │
       ▼
[Frontend Hooks]             ← src/hooks/use-broker.ts (read-only)
```

## Database Tables

### broker_connections
One row per user-broker link. Stores encrypted credentials (never exposed to frontend).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| broker_type | text | mt5, ctrader, custom |
| label | text | User-facing name |
| encrypted_credentials | jsonb | Server-only encrypted blob |
| status | text | pending / connected / error / revoked |
| last_error | text | Last sync error message |
| last_synced_at | timestamptz | Last successful sync |

### synced_accounts
Broker-reported account state. Separate from `trading_accounts` (which holds user-entered data for the risk engine).

| Column | Type | Description |
|--------|------|-------------|
| broker_account_id | text | Broker's native account ID |
| currency | text | Account currency |
| balance / equity | numeric | Account balances |
| margin_used / free_margin | numeric | Margin state |
| leverage | numeric | Account leverage |
| server_name | text | e.g. ICMarkets-Live01 |
| is_live | boolean | Live vs demo |

### open_positions
Current open trades synced from the broker. Replaced entirely on each sync (delete-insert).

### pending_orders
Limit/stop orders. Same delete-insert pattern as positions.

### account_snapshots
Periodic equity curve snapshots created on each sync. Accumulate over time for charting.

### sync_logs
Audit trail for every sync attempt with status, duration, item counts, and errors.

## Adapter Interface

```typescript
interface BrokerAdapter {
  readonly brokerType: BrokerType;
  testConnection(): Promise<void>;
  fetchAccounts(): Promise<BrokerAccountInfo[]>;
  fetchPositions(brokerAccountId: string): Promise<BrokerPosition[]>;
  fetchPendingOrders(brokerAccountId: string): Promise<BrokerPendingOrder[]>;
  fetchHistory(brokerAccountId: string, daysBack: number): Promise<BrokerHistoryEntry[]>;
  disconnect(): Promise<void>;
}
```

New broker integrations implement this interface and register in `adapter-factory.ts`.

## Sync Flow

1. Edge function receives POST request (on-demand or cron)
2. Loads `broker_connections` row, decrypts credentials
3. Creates adapter via factory
4. Writes `sync_logs` entry (status: started)
5. Fetches accounts → upserts `synced_accounts`
6. For each account: delete+insert positions and orders
7. Creates `account_snapshots` entry
8. Updates connection status and sync timestamp
9. Finalizes sync log (success/failed, duration, item count)

## Security Model

- **Credential encryption:** AES-256-GCM via Web Crypto API. Key from `BROKER_CREDENTIAL_KEY` env var.
- **No frontend access to credentials:** The `encrypted_credentials` column is never selected by frontend hooks.
- **Row-Level Security:** All tables enforce `auth.uid() = user_id` for authenticated users.
- **Service role isolation:** Only edge functions (service_role) can write to synced tables.
- **No browser-to-broker connection:** All communication flows through server-side edge functions.

## Frontend Hooks

All hooks in `src/hooks/use-broker.ts` are read-only React Query queries:

| Hook | Returns |
|------|---------|
| `useBrokerConnections()` | All connections (safe columns) |
| `useSyncedAccounts(connectionId?)` | Synced account state |
| `useOpenPositions(syncedAccountId?)` | Open positions |
| `usePendingOrders(syncedAccountId?)` | Pending orders |
| `useAccountSnapshots(syncedAccountId, limit?)` | Equity curve data |
| `useSyncLogs(connectionId, limit?)` | Sync audit log |
| `useTriggerSync()` | Mutation to invoke sync edge function |

## What Is NOT Implemented

- **Trade execution** — no place/modify/close order capability
- **Auto-trading** — no signal-to-trade automation
- **Live bridge server** — MT5 adapter is a stub; requires an external bridge
- **Frontend UI pages** — hooks are ready but no UI components yet
- **Credential input UI** — no forms for entering broker credentials
- **Real-time streaming** — polling only (sync on demand or cron)
- **History sync** — `fetchHistory()` is in the interface but not called by sync-service yet

## Future: Execution Phase

To add opt-in trade execution in a later phase:

1. **Extend BrokerAdapter** with execution methods:
   - `placeOrder(params): Promise<TicketId>`
   - `modifyOrder(ticketId, params): Promise<void>`
   - `closePosition(ticketId): Promise<void>`

2. **Add execution tables:**
   - `execution_requests` — queued trade intents with approval workflow
   - `execution_logs` — audit trail for every executed action

3. **Add approval workflow:**
   - Signal → execution request (pending user approval)
   - User confirms → edge function executes via adapter
   - Result logged and synced back

4. **Connect to risk engine:**
   - Validate execution requests against `user_risk_profiles`
   - Block trades exceeding risk limits

5. **Build MT5 bridge server:**
   - Python or C++ service exposing MT5 Manager API over HTTP
   - Deployed separately from Supabase
   - Authenticated via shared secret or mTLS

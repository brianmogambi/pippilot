// supabase/functions/_shared/broker/types.ts
//
// Phase 14: Broker integration types.
// Normalized data types and adapter interface for read-only broker syncing.
// Mirrored (types only) to src/lib/broker/types.ts — keep in sync.

// ── Broker type enum ──────────────────────────────────────────────

export type BrokerType = "mt5" | "ctrader" | "custom";

// ── Normalized data types ─────────────────────────────────────────

export interface BrokerAccountInfo {
  brokerAccountId: string;
  accountName: string | null;
  currency: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  leverage: number | null;
  serverName: string | null;
  isLive: boolean;
}

export interface BrokerPosition {
  brokerTicketId: string;
  symbol: string;
  direction: "long" | "short";
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number;
  commission: number;
  unrealizedPnl: number;
  openedAt: string; // ISO 8601
}

export interface BrokerPendingOrder {
  brokerTicketId: string;
  symbol: string;
  orderType:
    | "buy_limit"
    | "sell_limit"
    | "buy_stop"
    | "sell_stop"
    | "buy_stop_limit"
    | "sell_stop_limit";
  volume: number;
  price: number;
  stopLoss: number | null;
  takeProfit: number | null;
  expiration: string | null; // ISO 8601
  placedAt: string; // ISO 8601
}

export interface BrokerHistoryEntry {
  brokerTicketId: string;
  symbol: string;
  direction: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number;
  commission: number;
  realizedPnl: number;
  openedAt: string; // ISO 8601
  closedAt: string; // ISO 8601
}

// ── Credentials ───────────────────────────────────────────────────

export interface BrokerCredentials {
  brokerType: BrokerType;
  /** Broker-specific fields (login, password, server, etc.) */
  [key: string]: unknown;
}

// ── Adapter interface ─────────────────────────────────────────────

export interface BrokerAdapter {
  readonly brokerType: BrokerType;

  /** Test the connection; throws on failure. */
  testConnection(): Promise<void>;

  /** Fetch account info for all sub-accounts. */
  fetchAccounts(): Promise<BrokerAccountInfo[]>;

  /** Fetch open positions for a given broker account. */
  fetchPositions(brokerAccountId: string): Promise<BrokerPosition[]>;

  /** Fetch pending orders for a given broker account. */
  fetchPendingOrders(brokerAccountId: string): Promise<BrokerPendingOrder[]>;

  /** Fetch closed trade history (recent N days). */
  fetchHistory(
    brokerAccountId: string,
    daysBack: number,
  ): Promise<BrokerHistoryEntry[]>;

  /** Clean up / disconnect. */
  disconnect(): Promise<void>;
}

// ── Sync result ───────────────────────────────────────────────────

export interface SyncResult {
  connectionId: string;
  status: "success" | "partial" | "failed";
  accountsSynced: number;
  positionsSynced: number;
  ordersSynced: number;
  durationMs: number;
  error?: string;
}

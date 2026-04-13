// src/lib/broker/types.ts
//
// Phase 14: Frontend mirror of broker integration types.
// Types only — no adapter or sync logic on the frontend.
// Deno mirror: supabase/functions/_shared/broker/types.ts — keep in sync.

export type BrokerType = "mt5" | "ctrader" | "custom";

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
  openedAt: string;
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
  expiration: string | null;
  placedAt: string;
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
  openedAt: string;
  closedAt: string;
}

export interface SyncResult {
  connectionId: string;
  status: "success" | "partial" | "failed";
  accountsSynced: number;
  positionsSynced: number;
  ordersSynced: number;
  durationMs: number;
  error?: string;
}

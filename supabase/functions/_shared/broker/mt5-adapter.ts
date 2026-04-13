// supabase/functions/_shared/broker/mt5-adapter.ts
//
// Phase 14: MT5 adapter stub.
//
// This implements the BrokerAdapter interface but all methods throw a
// "not connected" error. A real implementation would communicate with
// an MT5 bridge server (e.g. a Python/C++ service exposing the MT5
// Manager API or MetaTrader Web API over HTTP/WebSocket).
//
// Expected MT5 bridge server contract (for future implementation):
//   POST /connect     { login, password, server }
//   GET  /accounts
//   GET  /positions?account=<id>
//   GET  /orders?account=<id>
//   GET  /history?account=<id>&days=<n>
//   POST /disconnect

import type {
  BrokerAccountInfo,
  BrokerAdapter,
  BrokerCredentials,
  BrokerHistoryEntry,
  BrokerPendingOrder,
  BrokerPosition,
  BrokerType,
} from "./types.ts";

const NOT_CONNECTED =
  "MT5 adapter not yet connected — a bridge server is required. " +
  "See mt5-adapter.ts for the expected bridge API contract.";

export class Mt5Adapter implements BrokerAdapter {
  readonly brokerType: BrokerType = "mt5";

  // Stored for future use when the bridge server is connected.
  private readonly _credentials: BrokerCredentials;

  constructor(credentials: BrokerCredentials) {
    this._credentials = credentials;
  }

  async testConnection(): Promise<void> {
    throw new Error(NOT_CONNECTED);
  }

  async fetchAccounts(): Promise<BrokerAccountInfo[]> {
    throw new Error(NOT_CONNECTED);
  }

  async fetchPositions(
    _brokerAccountId: string,
  ): Promise<BrokerPosition[]> {
    throw new Error(NOT_CONNECTED);
  }

  async fetchPendingOrders(
    _brokerAccountId: string,
  ): Promise<BrokerPendingOrder[]> {
    throw new Error(NOT_CONNECTED);
  }

  async fetchHistory(
    _brokerAccountId: string,
    _daysBack: number,
  ): Promise<BrokerHistoryEntry[]> {
    throw new Error(NOT_CONNECTED);
  }

  async disconnect(): Promise<void> {
    // No-op for stub.
  }
}

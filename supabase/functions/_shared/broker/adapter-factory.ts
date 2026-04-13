// supabase/functions/_shared/broker/adapter-factory.ts
//
// Phase 14: Factory function that maps broker_type to a concrete adapter.

import type { BrokerAdapter, BrokerCredentials } from "./types.ts";
import { Mt5Adapter } from "./mt5-adapter.ts";

export function createBrokerAdapter(
  credentials: BrokerCredentials,
): BrokerAdapter {
  switch (credentials.brokerType) {
    case "mt5":
      return new Mt5Adapter(credentials);
    // Future: case "ctrader": return new CtraderAdapter(credentials);
    default:
      throw new Error(
        `Unsupported broker type: ${credentials.brokerType}`,
      );
  }
}

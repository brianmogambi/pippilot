// supabase/functions/_shared/broker/sync-service.ts
//
// Phase 14: Broker sync orchestrator.
// Given a broker_connections row, creates the adapter, fetches data,
// and upserts into normalized tables. Pure service — receives a
// Supabase client as a parameter (same pattern as signal-engine.ts).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import type { SyncResult } from "./types.ts";
import { createBrokerAdapter } from "./adapter-factory.ts";
import { decryptCredentials } from "./credential-vault.ts";

/**
 * Sync a single broker connection: account info, positions, orders,
 * and create an equity snapshot. Writes sync_logs for auditing.
 */
export async function syncConnection(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<SyncResult> {
  const t0 = Date.now();
  let logId: string | null = null;

  try {
    // ── 1. Load connection row ────────────────────────────────────
    const { data: conn, error: connErr } = await supabase
      .from("broker_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connErr || !conn) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const userId: string = conn.user_id;

    // ── 2. Write sync_log (started) ──────────────────────────────
    const { data: logRow } = await supabase
      .from("sync_logs")
      .insert({
        connection_id: connectionId,
        user_id: userId,
        sync_type: "full",
        status: "started",
      })
      .select("id")
      .single();

    logId = logRow?.id ?? null;

    // ── 3. Decrypt credentials & create adapter ──────────────────
    const encryptedHex =
      typeof conn.encrypted_credentials === "string"
        ? conn.encrypted_credentials
        : JSON.stringify(conn.encrypted_credentials);

    const credentials = await decryptCredentials(encryptedHex);
    const adapter = createBrokerAdapter(credentials);

    // ── 4. Fetch accounts ────────────────────────────────────────
    const accounts = await adapter.fetchAccounts();

    let totalPositions = 0;
    let totalOrders = 0;

    for (const acct of accounts) {
      // Upsert synced_accounts
      const { data: upserted } = await supabase
        .from("synced_accounts")
        .upsert(
          {
            connection_id: connectionId,
            user_id: userId,
            broker_account_id: acct.brokerAccountId,
            account_name: acct.accountName,
            currency: acct.currency,
            balance: acct.balance,
            equity: acct.equity,
            margin_used: acct.marginUsed,
            free_margin: acct.freeMargin,
            leverage: acct.leverage,
            server_name: acct.serverName,
            is_live: acct.isLive,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "connection_id,broker_account_id" },
        )
        .select("id")
        .single();

      const syncedAccountId = upserted?.id;
      if (!syncedAccountId) continue;

      // ── 5. Sync positions (delete-insert) ────────────────────
      const positions = await adapter.fetchPositions(acct.brokerAccountId);

      // Delete stale positions for this account
      await supabase
        .from("open_positions")
        .delete()
        .eq("synced_account_id", syncedAccountId);

      if (positions.length > 0) {
        const posRows = positions.map((p) => ({
          synced_account_id: syncedAccountId,
          user_id: userId,
          broker_ticket_id: p.brokerTicketId,
          symbol: p.symbol,
          direction: p.direction,
          volume: p.volume,
          open_price: p.openPrice,
          current_price: p.currentPrice,
          stop_loss: p.stopLoss,
          take_profit: p.takeProfit,
          swap: p.swap,
          commission: p.commission,
          unrealized_pnl: p.unrealizedPnl,
          opened_at: p.openedAt,
          synced_at: new Date().toISOString(),
        }));

        await supabase.from("open_positions").insert(posRows);
      }

      totalPositions += positions.length;

      // ── 6. Sync pending orders (delete-insert) ───────────────
      const orders = await adapter.fetchPendingOrders(acct.brokerAccountId);

      await supabase
        .from("pending_orders")
        .delete()
        .eq("synced_account_id", syncedAccountId);

      if (orders.length > 0) {
        const orderRows = orders.map((o) => ({
          synced_account_id: syncedAccountId,
          user_id: userId,
          broker_ticket_id: o.brokerTicketId,
          symbol: o.symbol,
          order_type: o.orderType,
          volume: o.volume,
          price: o.price,
          stop_loss: o.stopLoss,
          take_profit: o.takeProfit,
          expiration: o.expiration,
          placed_at: o.placedAt,
          synced_at: new Date().toISOString(),
        }));

        await supabase.from("pending_orders").insert(orderRows);
      }

      totalOrders += orders.length;

      // ── 7. Equity snapshot ───────────────────────────────────
      await supabase.from("account_snapshots").insert({
        synced_account_id: syncedAccountId,
        user_id: userId,
        balance: acct.balance,
        equity: acct.equity,
        margin_used: acct.marginUsed,
        open_positions_count: positions.length,
        unrealized_pnl: positions.reduce(
          (sum, p) => sum + p.unrealizedPnl,
          0,
        ),
        snapshot_at: new Date().toISOString(),
      });
    }

    // ── 8. Disconnect adapter ──────────────────────────────────
    await adapter.disconnect();

    // ── 9. Update connection status ────────────────────────────
    const durationMs = Date.now() - t0;

    await supabase
      .from("broker_connections")
      .update({
        status: "connected",
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    // ── 10. Finalize sync_log ──────────────────────────────────
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          status: "success",
          items_synced: accounts.length + totalPositions + totalOrders,
          duration_ms: durationMs,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return {
      connectionId,
      status: "success",
      accountsSynced: accounts.length,
      positionsSynced: totalPositions,
      ordersSynced: totalOrders,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - t0;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update connection to error state
    await supabase
      .from("broker_connections")
      .update({
        status: "error",
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .catch(() => {}); // best-effort

    // Finalize sync_log as failed
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          status: "failed",
          error_message: errorMsg,
          duration_ms: durationMs,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId)
        .catch(() => {});
    }

    return {
      connectionId,
      status: "failed",
      accountsSynced: 0,
      positionsSynced: 0,
      ordersSynced: 0,
      durationMs,
      error: errorMsg,
    };
  }
}

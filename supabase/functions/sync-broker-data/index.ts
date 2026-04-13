// supabase/functions/sync-broker-data/index.ts
//
// Phase 14: Edge function for triggering broker data sync.
//
// Invocation:
//   POST /sync-broker-data
//   Body (optional): { connectionId?: string }
//
// - If connectionId is provided: sync that single connection.
//   The calling user must own the connection (validated via JWT).
// - If connectionId is omitted: sync ALL connections with
//   status='connected'. Intended for cron (service-role only).
//
// Returns: { synced, errors, results: SyncResult[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { syncConnection } from "../_shared/broker/sync-service.ts";
import type { SyncResult } from "../_shared/broker/types.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "missing supabase env" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Parse optional body
  let body: { connectionId?: string } = {};
  try {
    body =
      req.headers.get("content-length") === "0" ? {} : await req.json();
  } catch {
    body = {};
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Determine which connections to sync ────────────────────────

  let connectionIds: string[] = [];

  if (body.connectionId) {
    // Single-connection mode: verify the connection exists.
    // Ownership is enforced by RLS when the user calls via their JWT,
    // but since we use service_role here, we do an explicit check.
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");

    // If a user JWT was provided (not service key), validate ownership.
    if (jwt && jwt !== SERVICE_KEY) {
      const {
        data: { user },
      } = await supabase.auth.getUser(jwt);

      if (user) {
        const { data: conn } = await supabase
          .from("broker_connections")
          .select("id")
          .eq("id", body.connectionId)
          .eq("user_id", user.id)
          .single();

        if (!conn) {
          return new Response(
            JSON.stringify({ error: "connection not found or not owned" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    connectionIds = [body.connectionId];
  } else {
    // Batch mode: sync all connected connections.
    const { data: rows } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("status", "connected");

    connectionIds = (rows ?? []).map((r: { id: string }) => r.id);
  }

  // ── Sync each connection ───────────────────────────────────────

  const results: SyncResult[] = [];

  for (const connId of connectionIds) {
    const result = await syncConnection(supabase, connId);
    results.push(result);
  }

  const synced = results.filter((r) => r.status === "success").length;
  const errors = results.filter((r) => r.status === "failed").length;

  return new Response(
    JSON.stringify({ synced, errors, results }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});

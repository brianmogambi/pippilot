// supabase/functions/deliver-notifications/index.ts
//
// Phase 12 — Outbound alert delivery Edge Function.
//
// Called in two modes:
//   1. Primary: POST { alert_ids: string[] } — deliver specific alerts just created
//   2. Retry:   POST {} (empty body)        — retry recent failed deliveries
//
// Follows the same patterns as evaluate-alerts: CORS, Deno.serve,
// service-role client, generation_runs logging.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  orchestrateDeliveries,
  retryFailedDeliveries,
  type AlertRow,
} from "../_shared/delivery-orchestrator.ts";

// ── CORS ────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── Main handler ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Log this run
  const { data: runRow } = await supabase
    .from("generation_runs")
    .insert({
      function_name: "deliver-notifications",
      started_at: startedAt.toISOString(),
      status: "running",
    })
    .select("id")
    .single();
  const runId: string | null = runRow?.id ?? null;

  async function finalizeRun(
    status: "success" | "partial" | "failed",
    counts: { dispatched: number; skipped: number; failed: number },
    errorMsg?: string,
  ) {
    if (!runId) return;
    const finished = new Date();
    await supabase
      .from("generation_runs")
      .update({
        finished_at: finished.toISOString(),
        duration_ms: finished.getTime() - startedAt.getTime(),
        status,
        error_message: errorMsg ?? null,
      })
      .eq("id", runId);
  }

  try {
    // Parse request body
    let alertIds: string[] = [];
    try {
      const body = await req.json();
      alertIds = Array.isArray(body?.alert_ids) ? body.alert_ids : [];
    } catch {
      // Empty body or parse error → retry mode
    }

    // Retry mode: find failed deliveries from the last 24 hours
    if (alertIds.length === 0) {
      const retryResult = await retryFailedDeliveries({ supabase });
      alertIds = retryResult.alertIds;
    }

    if (alertIds.length === 0) {
      await finalizeRun("success", { dispatched: 0, skipped: 0, failed: 0 });
      return jsonResponse({
        ok: true,
        mode: "no_alerts",
        dispatched: 0,
        skipped: 0,
        failed: 0,
        duration_ms: Date.now() - startedAt.getTime(),
      });
    }

    // Fetch full alert rows
    const { data: alertsData, error: alertsErr } = await supabase
      .from("alerts")
      .select("id, user_id, pair, severity, event_kind, title, message")
      .in("id", alertIds);
    if (alertsErr) throw new Error(`alerts query: ${alertsErr.message}`);
    const alerts = (alertsData ?? []) as AlertRow[];

    if (alerts.length === 0) {
      await finalizeRun("success", { dispatched: 0, skipped: 0, failed: 0 });
      return jsonResponse({
        ok: true,
        mode: "no_matching_alerts",
        dispatched: 0,
        skipped: 0,
        failed: 0,
        duration_ms: Date.now() - startedAt.getTime(),
      });
    }

    // Orchestrate deliveries
    const result = await orchestrateDeliveries({ alerts, supabase });

    const runStatus = result.failed > 0 && result.dispatched === 0
      ? "partial"
      : "success";
    await finalizeRun(runStatus, result);

    return jsonResponse({
      ok: true,
      mode: "delivered",
      ...result,
      alert_count: alerts.length,
      duration_ms: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    console.error("deliver-notifications error:", err);
    await finalizeRun(
      "failed",
      { dispatched: 0, skipped: 0, failed: 0 },
      err instanceof Error ? err.message : "Unknown error",
    );
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

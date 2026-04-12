// supabase/functions/evaluate-alerts/index.ts
// Phase 7 — Alert Engine v2 runner.
//
// Pulls active signals + latest cached prices + per-pair watchers + prior
// alerts, runs the pure rules engine from `_shared/alert-engine.ts`, and
// inserts new alerts. Idempotent: re-running with no state change creates
// zero new rows. The DB unique partial index `alerts_unique_pending_event`
// is the safety net under concurrent runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  evaluateSignalAlerts,
  evaluateRiskAlert,
  type AlertEventKind,
  type SignalState,
  type PriceState,
} from "../_shared/alert-engine.ts";
import type { OpenPosition } from "../_shared/risk-engine.ts";
import { getDefaultPipValueUSD } from "../_shared/pip-value.ts";

// ── DB row shapes (narrow casts) ────────────────────────────────

interface SignalRow {
  id: string;
  user_id: string | null;
  pair: string;
  direction: "long" | "short";
  status: string;
  verdict: "trade" | "no_trade" | null;
  setup_type: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  invalidation_reason: string | null;
  created_at: string;
}

interface PriceRow {
  symbol: string;
  price: number | null;
  atr: number | null;
}

interface WatchRow {
  user_id: string;
  pair: string;
}

interface AlertRow {
  user_id: string;
  signal_id: string | null;
  event_kind: string | null;
  dedupe_key: string | null;
}

interface ProfileRow {
  id: string;
  max_daily_loss_pct: number | null;
  account_balance: number | null;
}

interface OpenTradeRow {
  user_id: string;
  pair: string;
  lot_size: number | null;
  entry_price: number | null;
  stop_loss: number | null;
}

interface AlertInsertRow {
  user_id: string;
  signal_id: string;
  pair: string;
  event_kind: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  dedupe_key: string;
  analysis_run_id: string | null;
  status: string;
  is_read: boolean;
  condition: string;
}

const ACTIVE_SIGNAL_STATUSES = ["active", "monitoring", "ready", "triggered"];

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

function toSignalState(s: SignalRow): SignalState {
  return {
    id: s.id,
    pair: s.pair,
    direction: s.direction,
    status: s.status,
    verdict: s.verdict,
    setup_type: s.setup_type,
    entry_price: s.entry_price != null ? Number(s.entry_price) : null,
    stop_loss: s.stop_loss != null ? Number(s.stop_loss) : null,
    take_profit_1: s.take_profit_1 != null ? Number(s.take_profit_1) : null,
    take_profit_2: s.take_profit_2 != null ? Number(s.take_profit_2) : null,
    take_profit_3: s.take_profit_3 != null ? Number(s.take_profit_3) : null,
    invalidation_reason: s.invalidation_reason,
  };
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

  const { data: runRow } = await supabase
    .from("generation_runs")
    .insert({
      function_name: "evaluate-alerts",
      started_at: startedAt.toISOString(),
      status: "running",
    })
    .select("id")
    .single();
  const runId: string | null = runRow?.id ?? null;

  async function finalizeRun(
    status: "success" | "partial" | "failed",
    counts: { evaluated: number; created: number; dedup_skipped: number },
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
        signals_created: counts.created,
      })
      .eq("id", runId);
  }

  try {
    // ── 1. Active signals ────────────────────────────────────────
    const { data: signalsData, error: signalsErr } = await supabase
      .from("signals")
      .select(
        "id, user_id, pair, direction, status, verdict, setup_type, entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, invalidation_reason, created_at",
      )
      .in("status", ACTIVE_SIGNAL_STATUSES)
      .order("created_at", { ascending: false });
    if (signalsErr) throw new Error(`signals query: ${signalsErr.message}`);
    const signals = (signalsData ?? []) as SignalRow[];

    if (signals.length === 0) {
      await finalizeRun("success", { evaluated: 0, created: 0, dedup_skipped: 0 });
      return jsonResponse({
        ok: true,
        evaluated: 0,
        created: 0,
        dedup_skipped: 0,
        duration_ms: Date.now() - startedAt.getTime(),
      });
    }

    // ── 2. Latest prices ─────────────────────────────────────────
    const { data: pricesData, error: pricesErr } = await supabase
      .from("market_data_cache")
      .select("symbol, price, atr");
    if (pricesErr) throw new Error(`market_data_cache query: ${pricesErr.message}`);
    const priceByPair = new Map<string, PriceState>();
    for (const r of (pricesData ?? []) as PriceRow[]) {
      if (r.price != null && r.price > 0) {
        priceByPair.set(r.symbol, {
          pair: r.symbol,
          price: Number(r.price),
          atr: r.atr != null ? Number(r.atr) : undefined,
        });
      }
    }

    // ── 3. Per-pair watchers ─────────────────────────────────────
    const distinctPairs = Array.from(new Set(signals.map((s) => s.pair)));
    const { data: watchData, error: watchErr } = await supabase
      .from("user_watchlist")
      .select("user_id, pair")
      .in("pair", distinctPairs);
    if (watchErr) throw new Error(`user_watchlist query: ${watchErr.message}`);
    const watchersByPair = new Map<string, string[]>();
    for (const w of (watchData ?? []) as WatchRow[]) {
      const arr = watchersByPair.get(w.pair) ?? [];
      arr.push(w.user_id);
      watchersByPair.set(w.pair, arr);
    }

    // ── 4. Prior alerts (for dedup) ──────────────────────────────
    const signalIds = signals.map((s) => s.id);
    const { data: priorAlertsData, error: priorErr } = await supabase
      .from("alerts")
      .select("user_id, signal_id, event_kind, dedupe_key")
      .in("signal_id", signalIds);
    if (priorErr) throw new Error(`alerts prior query: ${priorErr.message}`);
    const firedByUserSignal = new Map<string, Set<AlertEventKind>>();
    const existingDedupeKeys = new Set<string>();
    for (const a of (priorAlertsData ?? []) as AlertRow[]) {
      if (a.dedupe_key) existingDedupeKeys.add(a.dedupe_key);
      if (a.signal_id && a.event_kind) {
        const key = `${a.user_id}:${a.signal_id}`;
        const set = firedByUserSignal.get(key) ?? new Set<AlertEventKind>();
        set.add(a.event_kind as AlertEventKind);
        firedByUserSignal.set(key, set);
      }
    }

    // ── 5. Per-user risk context (for risk_breach) ───────────────
    const allWatcherIds = new Set<string>();
    for (const arr of watchersByPair.values()) {
      for (const id of arr) allWatcherIds.add(id);
    }

    const profilesByUser = new Map<string, ProfileRow>();
    const openTradesByUser = new Map<string, OpenTradeRow[]>();
    if (allWatcherIds.size > 0) {
      const watcherIds = Array.from(allWatcherIds);
      const [profileResp, tradesResp] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, max_daily_loss_pct, account_balance")
          .in("id", watcherIds),
        supabase
          .from("trade_journal_entries")
          .select("user_id, pair, lot_size, entry_price, stop_loss")
          .eq("status", "open")
          .in("user_id", watcherIds),
      ]);
      for (const p of (profileResp.data ?? []) as ProfileRow[]) {
        profilesByUser.set(p.id, p);
      }
      for (const t of (tradesResp.data ?? []) as OpenTradeRow[]) {
        const arr = openTradesByUser.get(t.user_id) ?? [];
        arr.push(t);
        openTradesByUser.set(t.user_id, arr);
      }
    }

    // Best-effort analysis_run_id: latest successful generate-signals run.
    const { data: latestRun } = await supabase
      .from("generation_runs")
      .select("id")
      .eq("function_name", "generate-signals")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const analysisRunId: string | null = latestRun?.id ?? null;

    // ── 6. Run engine + build insert rows ────────────────────────
    const rows: AlertInsertRow[] = [];
    const seenInsertKey = new Set<string>(); // `${user_id}:${dedupe_key}`
    let evaluated = 0;
    let dedupSkipped = 0;
    const breachAnchorByUser = new Map<string, { signalId: string; pair: string }>();

    for (const signal of signals) {
      const price = priceByPair.get(signal.pair);
      if (!price) continue;
      const watchers = watchersByPair.get(signal.pair) ?? [];
      if (watchers.length === 0) continue;

      const sigState = toSignalState(signal);

      for (const userId of watchers) {
        evaluated++;
        if (!breachAnchorByUser.has(userId)) {
          breachAnchorByUser.set(userId, { signalId: signal.id, pair: signal.pair });
        }
        const priorSet =
          firedByUserSignal.get(`${userId}:${signal.id}`) ??
          (new Set<AlertEventKind>() as ReadonlySet<AlertEventKind>);
        const out = evaluateSignalAlerts({
          signal: sigState,
          priorSignal: null, // exact prior-state diffing deferred to a future phase
          price,
          prior: { fired: priorSet },
          analysisRunId,
        });
        for (const c of out) {
          if (existingDedupeKeys.has(c.dedupe_key)) {
            dedupSkipped++;
            continue;
          }
          const insertKey = `${userId}:${c.dedupe_key}`;
          if (seenInsertKey.has(insertKey)) {
            dedupSkipped++;
            continue;
          }
          seenInsertKey.add(insertKey);
          rows.push({
            user_id: userId,
            signal_id: c.signal_id,
            pair: c.pair,
            event_kind: c.event_kind,
            type: c.event_kind,
            title: c.title,
            message: c.message,
            severity: c.severity,
            dedupe_key: c.dedupe_key,
            analysis_run_id: c.analysis_run_id,
            status: "pending",
            is_read: false,
            condition: c.message,
          });
        }
      }
    }

    // Per-user risk_breach (one per watcher with positions)
    for (const [userId, anchor] of breachAnchorByUser.entries()) {
      const profile = profilesByUser.get(userId);
      const balance = profile?.account_balance != null ? Number(profile.account_balance) : 0;
      if (balance <= 0) continue;
      const maxDailyLossPct =
        profile?.max_daily_loss_pct != null ? Number(profile.max_daily_loss_pct) : 3;

      const trades = openTradesByUser.get(userId) ?? [];
      const positions: OpenPosition[] = trades
        .filter((t) => t.lot_size != null && t.entry_price != null && t.stop_loss != null)
        .map((t) => ({
          pair: t.pair,
          lotSize: Number(t.lot_size),
          entry: Number(t.entry_price),
          stopLoss: Number(t.stop_loss),
          pipValueUSD: getDefaultPipValueUSD(t.pair),
        }));

      const priorSet =
        firedByUserSignal.get(`${userId}:${anchor.signalId}`) ??
        (new Set<AlertEventKind>() as ReadonlySet<AlertEventKind>);

      const breach = evaluateRiskAlert({
        ctx: {
          balance,
          openPositions: positions,
          realizedLossUSD: 0, // realized-loss tracking deferred to a future phase
          maxDailyLossPct,
        },
        prior: { fired: priorSet },
        signalIdForBreach: anchor.signalId,
        pair: anchor.pair,
        analysisRunId,
      });
      if (!breach) continue;

      if (existingDedupeKeys.has(breach.dedupe_key)) {
        dedupSkipped++;
        continue;
      }
      const insertKey = `${userId}:${breach.dedupe_key}`;
      if (seenInsertKey.has(insertKey)) {
        dedupSkipped++;
        continue;
      }
      seenInsertKey.add(insertKey);
      rows.push({
        user_id: userId,
        signal_id: breach.signal_id,
        pair: breach.pair,
        event_kind: breach.event_kind,
        type: breach.event_kind,
        title: breach.title,
        message: breach.message,
        severity: breach.severity,
        dedupe_key: breach.dedupe_key,
        analysis_run_id: breach.analysis_run_id,
        status: "pending",
        is_read: false,
        condition: breach.message,
      });
    }

    // ── 7. Persist ───────────────────────────────────────────────
    let created = 0;
    let insertedIds: string[] = [];
    if (rows.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("alerts")
        .insert(rows)
        .select("id");
      if (insertErr) {
        // The unique partial index makes concurrent runs safe — a
        // unique-violation is expected in races. Surface other errors.
        if (!insertErr.message.toLowerCase().includes("duplicate")) {
          throw new Error(`alerts insert: ${insertErr.message}`);
        }
      }
      created = inserted?.length ?? 0;
      insertedIds = (inserted ?? []).map((r: { id: string }) => r.id);
    }

    // ── 8. Trigger outbound delivery (fire-and-forget) ──────────
    if (insertedIds.length > 0) {
      fetch(`${supabaseUrl}/functions/v1/deliver-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ alert_ids: insertedIds }),
      }).catch((e) => console.error("deliver-notifications trigger failed:", e));
    }

    await finalizeRun("success", { evaluated, created, dedup_skipped: dedupSkipped });

    return jsonResponse({
      ok: true,
      evaluated,
      created,
      dedup_skipped: dedupSkipped,
      duration_ms: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    console.error("evaluate-alerts error:", err);
    await finalizeRun(
      "failed",
      { evaluated: 0, created: 0, dedup_skipped: 0 },
      err instanceof Error ? err.message : "Unknown error",
    );
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

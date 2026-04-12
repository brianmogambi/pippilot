// supabase/functions/_shared/delivery-orchestrator.ts
//
// Phase 12 — Delivery orchestration: preference checks, severity routing,
// throttling, deduplication, dispatch, and logging.
//
// Pure orchestration — all channel I/O is delegated to notification-channels.ts.

import { getChannel } from "./notification-channels.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

// ── Types ───────────────────────────────────────────────────────

export interface AlertRow {
  id: string;
  user_id: string;
  pair: string;
  severity: string;
  event_kind: string | null;
  title: string | null;
  message: string | null;
}

interface ProfileRow {
  user_id: string;
  notifications_enabled: boolean | null;
  alert_channels: string[] | null;
  preferred_pairs: string[] | null;
  telegram_chat_id: string | null;
  notification_email: string | null;
  severity_channel_routing: Record<string, string[]> | null;
}

interface AuthUserRow {
  id: string;
  email: string | null;
}

interface DeliveryRow {
  alert_id: string;
  user_id: string;
  channel: string;
  status: string;
}

interface DeliveryInsert {
  alert_id: string;
  user_id: string;
  channel: string;
  status: string;
  skip_reason?: string;
  error_message?: string;
  attempt_count: number;
  sent_at?: string;
}

export interface OrchestrationResult {
  dispatched: number;
  skipped: number;
  failed: number;
}

// ── Throttle limits (per user per channel per hour) ─────────────

const THROTTLE_LIMITS: Record<string, number> = {
  email: 10,
  telegram: 20,
};
const THROTTLE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Orchestrator ────────────────────────────────────────────────

export async function orchestrateDeliveries(args: {
  alerts: AlertRow[];
  supabase: SupabaseClient;
}): Promise<OrchestrationResult> {
  const { alerts, supabase } = args;
  if (alerts.length === 0) return { dispatched: 0, skipped: 0, failed: 0 };

  const result: OrchestrationResult = { dispatched: 0, skipped: 0, failed: 0 };

  // ── 1. Collect distinct user IDs ──────────────────────────────
  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const alertIds = alerts.map((a) => a.id);

  // ── 2. Batch-fetch profiles ───────────────────────────────────
  const { data: profilesData } = await supabase
    .from("profiles")
    .select(
      "user_id, notifications_enabled, alert_channels, preferred_pairs, telegram_chat_id, notification_email, severity_channel_routing",
    )
    .in("user_id", userIds);
  const profileByUser = new Map<string, ProfileRow>();
  for (const p of (profilesData ?? []) as ProfileRow[]) {
    profileByUser.set(p.user_id, p);
  }

  // ── 3. Batch-fetch auth emails (fallback for notification_email) ──
  const { data: authData } = await supabase
    .from("auth_users_view")
    .select("id, email")
    .in("id", userIds);

  // Fallback: if the view doesn't exist, try auth.users directly
  const authEmailByUser = new Map<string, string>();
  if (authData) {
    for (const u of authData as AuthUserRow[]) {
      if (u.email) authEmailByUser.set(u.id, u.email);
    }
  }

  // ── 4. Existing deliveries for dedup ──────────────────────────
  const { data: existingDeliveries } = await supabase
    .from("notification_deliveries")
    .select("alert_id, user_id, channel, status")
    .in("alert_id", alertIds);
  const sentKeys = new Set<string>();
  for (const d of (existingDeliveries ?? []) as DeliveryRow[]) {
    if (d.status === "sent") {
      sentKeys.add(`${d.alert_id}:${d.user_id}:${d.channel}`);
    }
  }

  // ── 5. Recent delivery counts for throttling ──────────────────
  const throttleSince = new Date(Date.now() - THROTTLE_WINDOW_MS).toISOString();
  const { data: recentCounts } = await supabase
    .from("notification_deliveries")
    .select("user_id, channel")
    .in("user_id", userIds)
    .eq("status", "sent")
    .gte("sent_at", throttleSince);

  const throttleCounters = new Map<string, number>();
  for (const r of (recentCounts ?? []) as { user_id: string; channel: string }[]) {
    const key = `${r.user_id}:${r.channel}`;
    throttleCounters.set(key, (throttleCounters.get(key) ?? 0) + 1);
  }

  // ── 6. Process each alert ─────────────────────────────────────
  const inserts: DeliveryInsert[] = [];

  for (const alert of alerts) {
    const profile = profileByUser.get(alert.user_id);

    // No profile → skip
    if (!profile) {
      result.skipped++;
      continue;
    }

    // Notifications disabled globally
    if (profile.notifications_enabled === false) {
      result.skipped++;
      continue;
    }

    // Pair filter: if user has preferred_pairs set, only deliver for those
    if (
      profile.preferred_pairs &&
      profile.preferred_pairs.length > 0 &&
      !profile.preferred_pairs.includes(alert.pair)
    ) {
      result.skipped++;
      continue;
    }

    const enabledChannels = (profile.alert_channels ?? ["in_app"]).filter(
      (ch) => ch !== "in_app",
    );

    for (const channelName of enabledChannels) {
      const channel = getChannel(channelName);
      if (!channel) continue;

      // Severity routing
      if (profile.severity_channel_routing) {
        const allowedChannels =
          profile.severity_channel_routing[alert.severity] ?? [];
        if (!allowedChannels.includes(channelName)) {
          inserts.push({
            alert_id: alert.id,
            user_id: alert.user_id,
            channel: channelName,
            status: "skipped",
            skip_reason: "severity_routing",
            attempt_count: 0,
          });
          result.skipped++;
          continue;
        }
      }

      // Dedup check
      const dedupKey = `${alert.id}:${alert.user_id}:${channelName}`;
      if (sentKeys.has(dedupKey)) {
        result.skipped++;
        continue;
      }

      // Throttle check
      const throttleKey = `${alert.user_id}:${channelName}`;
      const currentCount = throttleCounters.get(throttleKey) ?? 0;
      const limit = THROTTLE_LIMITS[channelName] ?? 20;
      if (currentCount >= limit) {
        inserts.push({
          alert_id: alert.id,
          user_id: alert.user_id,
          channel: channelName,
          status: "skipped",
          skip_reason: "throttled",
          attempt_count: 0,
        });
        result.skipped++;
        continue;
      }

      // Resolve recipient
      let recipient: string | null = null;
      if (channelName === "email") {
        recipient =
          profile.notification_email ?? authEmailByUser.get(alert.user_id) ?? null;
      } else if (channelName === "telegram") {
        recipient = profile.telegram_chat_id ?? null;
      }

      if (!recipient) {
        inserts.push({
          alert_id: alert.id,
          user_id: alert.user_id,
          channel: channelName,
          status: "skipped",
          skip_reason: "no_recipient",
          attempt_count: 0,
        });
        result.skipped++;
        continue;
      }

      // Dispatch
      const title = alert.title ?? `${alert.pair} alert`;
      const body = alert.message ?? "";
      const sendResult = await channel.send({
        recipient,
        subject: title,
        body,
        severity: alert.severity,
        pair: alert.pair,
        eventKind: alert.event_kind ?? "unknown",
      });

      if (sendResult.success) {
        inserts.push({
          alert_id: alert.id,
          user_id: alert.user_id,
          channel: channelName,
          status: "sent",
          attempt_count: 1,
          sent_at: new Date().toISOString(),
        });
        // Update throttle counter in-memory
        throttleCounters.set(throttleKey, currentCount + 1);
        result.dispatched++;
      } else {
        inserts.push({
          alert_id: alert.id,
          user_id: alert.user_id,
          channel: channelName,
          status: "failed",
          error_message: sendResult.errorMessage,
          attempt_count: 1,
        });
        result.failed++;
      }
    }
  }

  // ── 7. Persist delivery logs ──────────────────────────────────
  if (inserts.length > 0) {
    const { error } = await supabase
      .from("notification_deliveries")
      .upsert(inserts, { onConflict: "alert_id,user_id,channel" });
    if (error) {
      console.error("notification_deliveries upsert error:", error.message);
    }
  }

  return result;
}

// ── Retry failed deliveries ─────────────────────────────────────

export async function retryFailedDeliveries(args: {
  supabase: SupabaseClient;
  maxAttempts?: number;
  windowHours?: number;
}): Promise<{ alertIds: string[] }> {
  const { supabase, maxAttempts = 3, windowHours = 24 } = args;
  const since = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const { data: failedRows } = await supabase
    .from("notification_deliveries")
    .select("alert_id")
    .eq("status", "failed")
    .lt("attempt_count", maxAttempts)
    .gte("created_at", since);

  const alertIds = [
    ...new Set((failedRows ?? []).map((r: { alert_id: string }) => r.alert_id)),
  ];
  return { alertIds };
}

// supabase/functions/_shared/notification-channels.ts
//
// Phase 12 — Channel abstraction for outbound alert delivery.
// Each channel implements a simple send() interface. The registry
// makes it easy to add new channels (push, SMS, etc.) later.

// ── Types ───────────────────────────────────────────────────────

export interface ChannelSendParams {
  recipient: string;       // email address or telegram chat ID
  subject: string;         // email subject / notification title
  body: string;            // plain-text body
  severity: string;        // info | warning | critical
  pair: string;            // e.g. "EUR/USD"
  eventKind: string;       // e.g. "entry_reached"
}

export interface ChannelSendResult {
  success: boolean;
  errorMessage?: string;
}

export interface NotificationChannel {
  name: string;
  send(params: ChannelSendParams): Promise<ChannelSendResult>;
}

// ── Severity → emoji mapping ────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  info: "\u2139\uFE0F",
  warning: "\u26A0\uFE0F",
  critical: "\uD83D\uDEA8",
};

// ── Email channel (Resend) ──────────────────────────────────────

const emailChannel: NotificationChannel = {
  name: "email",

  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "alerts@pippilot.app";

    if (!apiKey) {
      return { success: false, errorMessage: "RESEND_API_KEY not configured" };
    }

    const emoji = SEVERITY_EMOJI[params.severity] ?? "";
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:16px">
        <div style="background:#1a1a2e;border-radius:8px;padding:20px;color:#e0e0e0">
          <p style="margin:0 0 4px;font-size:12px;color:#888">PipPilot AI Alert</p>
          <h2 style="margin:0 0 12px;font-size:18px;color:#fff">
            ${emoji} ${params.subject}
          </h2>
          <div style="background:#16213e;border-left:3px solid ${params.severity === "critical" ? "#ef4444" : params.severity === "warning" ? "#f59e0b" : "#3b82f6"};padding:12px;border-radius:4px;margin-bottom:12px">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#cbd5e1">${params.pair} &middot; ${params.eventKind.replace(/_/g, " ")}</p>
            <p style="margin:0;font-size:13px;color:#94a3b8">${params.body}</p>
          </div>
          <a href="https://pippilot.app/alerts"
             style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:8px 16px;border-radius:4px;font-size:13px">
            View in PipPilot
          </a>
        </div>
      </div>`;

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `PipPilot AI <${fromEmail}>`,
          to: [params.recipient],
          subject: `${emoji} ${params.subject}`,
          html,
          text: `${params.subject}\n\n${params.pair} — ${params.eventKind.replace(/_/g, " ")}\n${params.body}`,
        }),
      });

      if (resp.ok) {
        return { success: true };
      }
      const errBody = await resp.text();
      return { success: false, errorMessage: `Resend ${resp.status}: ${errBody}` };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown email error",
      };
    }
  },
};

// ── Telegram channel ────────────────────────────────────────────

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

const telegramChannel: NotificationChannel = {
  name: "telegram",

  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return { success: false, errorMessage: "TELEGRAM_BOT_TOKEN not configured" };
    }

    const emoji = SEVERITY_EMOJI[params.severity] ?? "";
    const text = [
      `${emoji} *${escapeMarkdownV2(params.subject)}*`,
      "",
      `*Pair:* ${escapeMarkdownV2(params.pair)}`,
      `*Type:* ${escapeMarkdownV2(params.eventKind.replace(/_/g, " "))}`,
      "",
      escapeMarkdownV2(params.body),
    ].join("\n");

    try {
      const resp = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: params.recipient,
            text,
            parse_mode: "MarkdownV2",
          }),
        },
      );

      const data = await resp.json();
      if (data.ok) {
        return { success: true };
      }
      return {
        success: false,
        errorMessage: `Telegram ${data.error_code}: ${data.description}`,
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Unknown telegram error",
      };
    }
  },
};

// ── Channel registry ────────────────────────────────────────────

const CHANNELS: Record<string, NotificationChannel> = {
  email: emailChannel,
  telegram: telegramChannel,
};

export function getChannel(name: string): NotificationChannel | null {
  return CHANNELS[name] ?? null;
}

export function getAvailableChannelNames(): string[] {
  return Object.keys(CHANNELS);
}

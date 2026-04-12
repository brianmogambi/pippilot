-- Phase 12: Automated outbound alert delivery
-- Adds notification_deliveries table and extends profiles for channel config.

-- ── 1. notification_deliveries ──────────────────────────────────

create table public.notification_deliveries (
  id            uuid        primary key default gen_random_uuid(),
  alert_id      uuid        not null references public.alerts(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  channel       text        not null check (channel in ('email', 'telegram', 'push')),
  status        text        not null default 'pending'
                            check (status in ('pending', 'sent', 'failed', 'skipped')),
  skip_reason   text,
  error_message text,
  attempt_count int         not null default 0,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),

  -- one delivery attempt per alert × user × channel
  unique (alert_id, user_id, channel)
);

-- throttle lookups: recent deliveries per user+channel
create index idx_notif_del_user_channel_ts
  on public.notification_deliveries (user_id, channel, created_at desc);

-- retry queries: find failed deliveries
create index idx_notif_del_failed
  on public.notification_deliveries (status, created_at)
  where status = 'failed';

-- RLS
alter table public.notification_deliveries enable row level security;

create policy "Users can view own deliveries"
  on public.notification_deliveries for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on public.notification_deliveries for all
  using (true)
  with check (true);

-- ── 2. Extend profiles for channel configuration ────────────────

alter table public.profiles
  add column if not exists telegram_chat_id          text,
  add column if not exists notification_email        text,
  add column if not exists severity_channel_routing  jsonb;

comment on column public.profiles.telegram_chat_id
  is 'Telegram chat ID for outbound alerts (numeric string from BotFather /start)';
comment on column public.profiles.notification_email
  is 'Override email for alert delivery; falls back to auth.users.email when null';
comment on column public.profiles.severity_channel_routing
  is 'JSON map of severity → channel[], e.g. {"critical":["email","telegram"]}. Null = all channels get all severities.';

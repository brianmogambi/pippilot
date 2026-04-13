-- Data freshness: Scheduled edge function invocations via pg_cron + pg_net.
--
-- fetch-market-data: every 5 minutes during market hours (Sun 22:00 – Fri 22:00 UTC).
-- generate-signals:  every 2 hours in 8 batches (staggered by 1 minute each).
-- evaluate-alerts:   every 5 minutes (piggybacks on fresh market data).
-- resolve-live-outcomes: every hour during market hours.
--
-- Prerequisites:
--   - pg_cron and pg_net extensions enabled (Supabase Pro plan or self-hosted).
--   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY available to pg_net.
--
-- If pg_cron is not available, these can be replaced with an external
-- cron service (e.g., GitHub Actions, Vercel Cron, cron-job.org) calling
-- the same endpoints.

-- Enable extensions if not already enabled
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── Helper: build the edge function URL ────────────────────────
-- Uses the project's Supabase URL from the config.
-- Note: current_setting('app.settings.supabase_url') may not work on all
-- Supabase plans. If it doesn't, replace with a literal URL.

-- ── fetch-market-data: every 5 minutes ─────────────────────────
select cron.schedule(
  'fetch-market-data',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fetch-market-data',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── generate-signals: 8 batches every 2 hours, staggered ──────
-- Batch 0 at :00, batch 1 at :01, ... batch 7 at :07
-- Runs at hours 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22 UTC

select cron.schedule(
  'generate-signals-batch-0',
  '0 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=0',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-1',
  '1 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=1',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-2',
  '2 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=2',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-3',
  '3 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=3',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-4',
  '4 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=4',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-5',
  '5 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=5',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-6',
  '6 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=6',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'generate-signals-batch-7',
  '7 */2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-signals?batch=7',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── evaluate-alerts: every 5 minutes ───────────────────────────
select cron.schedule(
  'evaluate-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── resolve-live-outcomes: every hour ──────────────────────────
select cron.schedule(
  'resolve-live-outcomes',
  '30 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/resolve-live-outcomes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

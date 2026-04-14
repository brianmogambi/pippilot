-- Phase 18.4: Trade close + structured journaling
--
-- Extends trade_journal_entries with the structured review fields that
-- Phase 18.5 (rule-based post-trade analysis) and Phase 18.6 (natural
-- language AI review) consume. Every new column is nullable so legacy
-- rows keep working unchanged — the close-trade flow prefills these
-- fields but none of them are required for a journal entry to exist.

alter table public.trade_journal_entries
  add column emotion_before text,
  add column emotion_after text,
  add column setup_rating integer check (setup_rating between 1 and 5),
  add column execution_rating integer check (execution_rating between 1 and 5),
  add column discipline_rating integer check (discipline_rating between 1 and 5),
  add column mistake_tags text[] not null default '{}',
  add column screenshot_before text,
  add column screenshot_after text;

comment on column public.trade_journal_entries.emotion_before is
  'Free-form note on the trader''s emotional state immediately before taking the trade.';
comment on column public.trade_journal_entries.emotion_after is
  'Free-form note on the trader''s emotional state after the trade closed.';
comment on column public.trade_journal_entries.setup_rating is
  'Trader self-rating of the quality of the setup they took (1 poor — 5 excellent).';
comment on column public.trade_journal_entries.execution_rating is
  'Trader self-rating of how well they executed the plan (1 poor — 5 excellent).';
comment on column public.trade_journal_entries.discipline_rating is
  'Trader self-rating of discipline during the trade (1 poor — 5 excellent).';
comment on column public.trade_journal_entries.mistake_tags is
  'Phase 18.4: free-form tags for common execution mistakes (e.g. late_entry, moved_sl, oversized). Defaults to empty array for backward compat.';
comment on column public.trade_journal_entries.screenshot_before is
  'URL of a chart screenshot taken before the trade was opened.';
comment on column public.trade_journal_entries.screenshot_after is
  'URL of a chart screenshot taken after the trade was closed. The legacy `screenshot_url` column is left in place for pre-Phase-18.4 rows.';

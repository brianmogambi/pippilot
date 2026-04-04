ALTER TABLE public.trade_journal_entries
  ADD COLUMN setup_type text DEFAULT NULL,
  ADD COLUMN confidence integer DEFAULT NULL,
  ADD COLUMN setup_reasoning text DEFAULT NULL,
  ADD COLUMN lesson_learned text DEFAULT NULL,
  ADD COLUMN emotional_notes text DEFAULT NULL,
  ADD COLUMN screenshot_url text DEFAULT NULL;
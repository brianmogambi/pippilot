-- Phase 11: Normalize review_tag vocabulary for analytics.
--
-- Until now `signals.review_tag` and `alerts.review_tag` were free-form
-- text. Phase 11 analytics filters on these tags, so we need a closed
-- vocabulary to keep aggregations meaningful.
--
-- Allowed values:
--   good_signal     — confirmed correct call
--   false_positive  — signal fired but should not have
--   weak_setup      — borderline / low-quality but not clearly wrong
--   overconfident   — confidence score did not match realized R
--   needs_review    — flagged for follow-up
--   NULL            — unreviewed
--
-- Any pre-existing tags outside this set are coerced to `needs_review`
-- so reviewers can revisit them. The set is a small superset of the
-- existing in-use tags so this should be a no-op for current data.

-- ── signals ───────────────────────────────────────────────────────

update public.signals
   set review_tag = 'needs_review'
 where review_tag is not null
   and review_tag not in (
     'good_signal', 'false_positive', 'weak_setup',
     'overconfident', 'needs_review'
   );

alter table public.signals
  add constraint signals_review_tag_check
  check (
    review_tag is null
    or review_tag in (
      'good_signal', 'false_positive', 'weak_setup',
      'overconfident', 'needs_review'
    )
  );

create index if not exists idx_signals_review_tag
  on public.signals (review_tag)
  where review_tag is not null;

-- ── alerts ────────────────────────────────────────────────────────

update public.alerts
   set review_tag = 'needs_review'
 where review_tag is not null
   and review_tag not in (
     'good_signal', 'false_positive', 'weak_setup',
     'overconfident', 'needs_review'
   );

alter table public.alerts
  add constraint alerts_review_tag_check
  check (
    review_tag is null
    or review_tag in (
      'good_signal', 'false_positive', 'weak_setup',
      'overconfident', 'needs_review'
    )
  );

create index if not exists idx_alerts_review_tag
  on public.alerts (review_tag)
  where review_tag is not null;



# Phase 14 — Admin / Internal Review Panel

## Overview

Add a role-gated `/admin` page with two tabs: **Signal Review** and **Alert Review**. Only users with the `admin` role (via existing `user_roles` table + `has_role()` function) can access it. The page is hidden from normal navigation — admins access it directly via URL or a subtle sidebar link visible only to them.

## Database changes

**Migration**: Add review columns to `signals` and `alerts` tables:

```sql
-- signals: admin review fields
ALTER TABLE public.signals
  ADD COLUMN review_tag text,          -- 'good_signal', 'false_positive', 'needs_review', null
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

-- alerts: admin review fields  
ALTER TABLE public.alerts
  ADD COLUMN review_tag text,
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;
```

No new RLS policies needed — existing admin `ALL` policy on `signals` covers updates; alerts already allow authenticated updates on own rows, but we need an admin policy for alerts too:

```sql
CREATE POLICY "Admins can manage alerts"
  ON public.alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

## New files

### `src/hooks/use-admin.ts`
- `useIsAdmin()` — queries `user_roles` to check if current user has admin role, returns `{ isAdmin, isLoading }`
- `useReviewSignal()` — mutation to update `review_tag`, `review_notes`, `reviewed_at`, `reviewed_by` on a signal
- `useReviewAlert()` — same for alerts
- `useSignalReviewStats()` — summary: total signals, reviewed count, good/false-positive breakdown by pair

### `src/pages/AdminReview.tsx`
Two-tab layout (Signals | Alerts) with:

**Signal Review Tab:**
- Filterable table: pair, status, setup_type, confidence range, review_tag (unreviewed/good/false_positive)
- Columns: Pair, Direction, Timeframe, Setup, Confidence, Status, R:R, Review Tag, Actions
- Inline actions: tag as Good Signal / False Positive / Needs Review, add notes via popover
- Summary stats row at top: Total signals, Reviewed %, Good signal rate, Avg confidence (good vs false positive)

**Alert Review Tab:**
- Filterable table: pair, type, severity, review_tag
- Columns: Title, Pair, Type, Severity, Status, Created, Review Tag, Actions
- Same tagging + notes pattern

### `src/components/admin/ReviewTagSelect.tsx`
Reusable dropdown for tagging: Good Signal, False Positive, Needs Review, Clear

### `src/components/admin/ReviewNotesPopover.tsx`
Popover with textarea + save button for adding review notes

## Files to modify

- `src/App.tsx` — add `/admin` route, wrapped in ProtectedRoute + admin check
- `src/components/layout/AppSidebar.tsx` — conditionally show "Admin" link when `useIsAdmin()` returns true
- `src/components/layout/MobileNav.tsx` — same conditional admin link
- `src/types/trading.ts` — add `review_tag`, `review_notes`, `reviewed_at`, `reviewed_by` to Signal and Alert types (these will auto-update from DB types, but we reference them in the admin hooks)

## Access control

The admin page uses `useIsAdmin()` — if not admin, redirects to `/`. The sidebar link only renders for admins. No admin-specific data leaks to regular users since signals already have a public SELECT policy and the review fields are simply additional columns (harmless to expose as null values).




# Phase 15 — Final MVP Polish

## What this covers

A comprehensive visual and UX polish pass across all pages and shared components. No new features — only consistency, quality, and production readiness improvements.

---

## 1. Global CSS & Theme Refinements (`src/index.css`)

- Remove the unused `src/App.css` file entirely (leftover Vite scaffold — `#root` max-width/padding/text-align conflicts with our full-width layout)
- Add smooth scrolling, better selection colors, and consistent focus ring styles
- Add a subtle custom scrollbar for the dark theme
- Standardize font-weight scale in base layer

## 2. Shared Components Polish

### `StatCard` — add subtle hover lift, consistent min-height so cards align in grids, cap value font size on mobile

### `StatusBadge` — currently 9 variants scattered across components; no changes needed (already clean)

### `AppHeader` — link the bell icon to `/alerts`; link the avatar to `/settings`; add a subtle separator between balance/equity

### `AppSidebar` — add a version/build tag at bottom (`v1.0 MVP`); soften the disclaimer card styling; add subtle divider above the bottom section

### `MobileNav` — currently 7-8 items in a scrollable row which is too many for small screens; group Calculator into a "More" overflow or remove from mobile nav (accessible via sidebar); ensure touch targets are at least 44px

### `AppLayout` — no changes needed

## 3. Page-by-Page Polish

### Dashboard (`Index.tsx`)
- Standardize page padding to match all other pages (already consistent at `p-4 md:p-6 lg:p-8`)
- Improve the "Trading Tip" card — make it dismissable for the session, refine gradient
- Move the disclaimer from its own card to a subtle footer text (less visual weight)
- Add a subtle page-level loading skeleton when data is loading

### Signals (`Signals.tsx`)
- Add result count label ("Showing 12 signals")
- Improve empty state with illustration-style icon and CTA
- Table header: add sticky header on scroll, subtle `bg-muted/50` background
- Mobile cards: add a subtle divider or gap refinement

### Watchlist (`Watchlist.tsx`)
- Consistent table header styling with Signals page (`bg-muted/30`)
- Improve "Add pair" flow — move to a more prominent position or add empty-state CTA
- Sticky table header

### Alerts (`Alerts.tsx`)
- Remove the direct `supabase` import (should go through hooks — missed in Phase 13)
- Notification preferences section: simplify — it duplicates Settings, just link to Settings instead
- Improve the empty state icon

### Journal (`Journal.tsx`)
- Stat cards: 6 across on large screens works, but on tablet (3 cols) the "Best/Worst Pair" values may truncate — add `truncate` class
- Empty state: add a more encouraging message with a CTA button to add first entry
- Table: add sticky header

### Calculator (`CalculatorPage.tsx`)
- Already well-structured; minor: ensure education cards have consistent padding with the calculator card

### Settings (`SettingsPage.tsx`)
- Replace raw `<select>` elements with shadcn `Select` component for consistency (Trading Style, Currency, Timezone all use `<select>`)
- Sticky save button at bottom of viewport on mobile
- Add unsaved-changes indicator

### PairDetail (`PairDetail.tsx`)
- Already comprehensive; minor spacing consistency on mobile
- Chart placeholder: refine to look more intentional (add a border-dashed style)

### AdminReview (`AdminReview.tsx`)
- Add page padding (currently missing `p-4 md:p-6 lg:p-8`)
- Improve empty/loading states to match rest of app

### Auth pages (Login, Signup, ForgotPassword, ResetPassword)
- Use `Activity` icon (the PipPilot logo icon) instead of `TrendingUp` for brand consistency
- Add a subtle background pattern or gradient to break the flat background

### NotFound
- Update to use dark theme properly (`bg-background` not `bg-muted`), add PipPilot branding, make the link a proper Button

### Onboarding
- Already good; ensure step transitions feel smooth

## 4. Consistency Fixes

- **Disclaimer placement**: Currently duplicated in sidebar, dashboard, signals detail drawer, journal, watchlist, and calculator. Consolidate — keep sidebar disclaimer, remove page-level duplicates (or make them identical one-liners)
- **Page header pattern**: All pages use `h1 text-2xl font-bold` + `p text-sm text-muted-foreground mt-1`. AdminReview is missing padding. Standardize.
- **Filter bar pattern**: Signals uses `h-8` selects, Watchlist uses `h-9`, Journal uses `h-8`. Standardize to `h-8` everywhere.
- **Table headers**: Signals uses `bg-muted/30`, Watchlist uses `hover:bg-transparent`, Journal has no bg. Standardize to `bg-muted/30`.
- **Loading skeletons**: Standardize skeleton count and height across pages (currently varies 3-5 items, h-10 to h-20)
- **Empty state pattern**: Create a reusable `EmptyState` component (icon, title, description, optional CTA) used across all pages

## 5. Files Summary

### New files
- `src/components/ui/empty-state.tsx` — reusable empty state component

### Files to modify (polish only)
- `src/index.css` — scrollbar, selection, focus styles
- `src/components/ui/stat-card.tsx` — hover effect, mobile sizing
- `src/components/layout/AppHeader.tsx` — link bell/avatar, separator
- `src/components/layout/AppSidebar.tsx` — version tag, divider, softer disclaimer
- `src/components/layout/MobileNav.tsx` — reduce items, improve touch targets
- `src/pages/Index.tsx` — disclaimer simplification, loading state, tip card refinement
- `src/pages/Signals.tsx` — result count, table header, empty state
- `src/pages/Alerts.tsx` — remove supabase import, simplify notification prefs, use EmptyState
- `src/pages/Watchlist.tsx` — table header consistency, empty state
- `src/pages/Journal.tsx` — truncation, empty state CTA, table header
- `src/pages/SettingsPage.tsx` — replace raw selects, sticky save on mobile
- `src/pages/AdminReview.tsx` — add page padding, improve empty/loading states
- `src/pages/PairDetail.tsx` — chart placeholder styling
- `src/pages/Login.tsx` — icon swap, background treatment
- `src/pages/Signup.tsx` — same auth polish
- `src/pages/ForgotPassword.tsx` — same auth polish
- `src/pages/ResetPassword.tsx` — same auth polish
- `src/pages/NotFound.tsx` — dark theme, branding, proper button

### Files to delete
- `src/App.css` — unused Vite scaffold


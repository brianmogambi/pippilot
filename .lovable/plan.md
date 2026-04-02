

# Phase 2 — Authentication & Onboarding

## What exists
- Auth pages (Login, Signup, ForgotPassword, ResetPassword) — working with Supabase Auth
- AuthContext with session management, ProtectedRoute wrapper
- `profiles` table with: user_id, display_name, account_size, default_risk_pct, experience_level
- Auto-profile creation trigger on signup (`handle_new_user`)
- Basic SettingsPage with local state only (not wired to DB)

## What's needed

### 1. Database migration — expand profiles table
Add columns to `profiles`:
- `account_currency` (text, default 'USD')
- `broker_name` (text, nullable)
- `account_equity` (numeric, default 10000)
- `max_daily_loss_pct` (numeric, default 5)
- `preferred_pairs` (text[], default '{}')
- `preferred_sessions` (text[], default '{}')
- `trading_style` (text, default 'intraday')
- `timezone` (text, default 'UTC')
- `notifications_enabled` (boolean, default true)
- `onboarding_completed` (boolean, default false)

### 2. Onboarding page (`/onboarding`)
Create `src/pages/Onboarding.tsx`:
- Multi-step wizard (3 steps) with progress indicator
- **Step 1 — About You**: display name, experience level (with beginner-friendly descriptions for each), trading style (scalping/intraday/swing with descriptions)
- **Step 2 — Account Setup**: account currency, broker name (optional), account balance, account equity, preferred pairs (multi-select from major/minor pairs), preferred sessions (London/New York/Asia checkboxes)
- **Step 3 — Risk Preferences**: default risk per trade %, max daily loss %, with helper text explaining each
- On submit: upserts profile row, sets `onboarding_completed = true`, redirects to dashboard
- Clean, polished dark UI with card-based steps

### 3. Onboarding gate in ProtectedRoute
Update `ProtectedRoute` to:
- Fetch the user's profile after auth check
- If `onboarding_completed === false`, redirect to `/onboarding`
- Add `/onboarding` as a protected but non-gated route

### 4. Rebuild Settings page
Rebuild `src/pages/SettingsPage.tsx` with tabbed sections:
- **Profile**: display name, experience level, trading style
- **Risk Preferences**: account balance, equity, currency, broker, default risk %, max daily loss %
- **Trading**: preferred pairs, preferred sessions
- **Notifications**: notifications enabled toggle
- **Display**: timezone select, theme toggle (placeholder)
- All fields load from DB via React Query, save via mutation
- Same beginner-friendly descriptions as onboarding

### 5. Wire AuthContext with profile
Extend `AuthContext` to expose a `profile` object and `refetchProfile` function so Dashboard and other pages can access user preferences without separate fetches.

---

## Files to create
- `src/pages/Onboarding.tsx`

## Files to modify
- `src/pages/SettingsPage.tsx` — full rebuild with DB integration
- `src/components/auth/ProtectedRoute.tsx` — add onboarding gate
- `src/contexts/AuthContext.tsx` — add profile fetching
- `src/App.tsx` — add `/onboarding` route

## Migration
Single SQL migration adding 10 columns to `profiles` table.


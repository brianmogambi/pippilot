

# Phase 10 — Trade Journal Rebuild

## Current state
- Basic journal page with 3 stat cards (total trades, win rate, avg pips) and a simple table
- Add entry form exists with core fields but missing: setup_type, confidence, setup_reasoning, lesson_learned, emotional_notes
- No edit functionality, no filters, no detail view, no best/worst pair stats, no R-multiple calc

## Database changes

**Migration**: Add columns to `trade_journal_entries`:
- `setup_type` text nullable (e.g., breakout, pullback, reversal, range, trend_continuation)
- `confidence` integer nullable (1-5 scale)
- `setup_reasoning` text nullable
- `lesson_learned` text nullable
- `emotional_notes` text nullable
- `screenshot_url` text nullable (placeholder for future)

## Plan

### 1. Rebuild `src/components/journal/JournalEntryForm.tsx`
- Add new fields: setup_type (Select), confidence (1-5 slider/select), setup_reasoning (textarea), lesson_learned (textarea), emotional_notes (textarea)
- Support **edit mode**: accept optional `entry` prop — when provided, pre-fills form and does `update` instead of `insert`
- Dialog title changes to "Edit Journal Entry" in edit mode

### 2. Create `src/components/journal/JournalDetailDrawer.tsx`
- Sheet/drawer that opens when clicking a journal row
- Shows full trade summary: pair, direction, entry/exit/SL/TP, lot size, result pips/money
- Sections: "Setup Reasoning", "Outcome", "Lesson Learned", "Emotional & Discipline Notes"
- Screenshot placeholder area
- Edit button that opens JournalEntryForm in edit mode
- Delete button with confirmation

### 3. Create `src/components/journal/JournalFilters.tsx`
- Filter bar: Pair (select), Date range (two date inputs or simple month picker), Setup Type (select), Result (all/wins/losses)
- Clear filters button
- Applied filter count badge

### 4. Rebuild `src/pages/Journal.tsx`
**Performance summary cards** (6 cards, responsive grid):
- Total Trades, Win Rate, Avg R-Multiple (result_pips / SL distance when available), Avg Pips, Best Pair (highest avg pips), Worst Pair (lowest avg pips)

**Filter bar** below stats

**Journal list**: Enhanced table with all columns (date, pair, direction, setup type, entry, exit, P&L pips, P&L $, confidence stars, followed plan). Clickable rows open detail drawer.

**Empty/loading states** preserved.

### Files to create/modify
- `src/components/journal/JournalEntryForm.tsx` — rebuild with edit mode + new fields
- `src/components/journal/JournalDetailDrawer.tsx` — new
- `src/components/journal/JournalFilters.tsx` — new
- `src/pages/Journal.tsx` — full rebuild
- Migration: add 5 columns to `trade_journal_entries`


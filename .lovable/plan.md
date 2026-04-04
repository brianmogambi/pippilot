

# Generate PipPilot AI Documentation Suite

## What this does

Generates 10 comprehensive markdown documents covering the entire PipPilot AI application — from system overview to future roadmap. No code changes. Output to `/mnt/documents/`.

## Documents to generate

| # | File | Content |
|---|------|---------|
| 1 | `README.md` | Product overview, architecture, tech stack, principles, MVP scope |
| 2 | `USER_GUIDE.md` | Beginner-friendly walkthrough of every page and concept |
| 3 | `FEATURES_SPEC.md` | Detailed feature breakdown with inputs, outputs, dependencies |
| 4 | `DATABASE_SCHEMA.md` | All 8 tables with fields, types, RLS policies, example records |
| 5 | `API_CONTRACTS.md` | Supabase client-side query contracts for all data operations |
| 6 | `SIGNAL_ENGINE_SPEC.md` | How signal generation should work — inputs, scoring, output structure |
| 7 | `RISK_ENGINE_SPEC.md` | Position sizing logic, pip values, exposure checks, daily limits |
| 8 | `ALERT_ENGINE_SPEC.md` | Alert types, triggers, severity, delivery, dedup logic |
| 9 | `UI_ARCHITECTURE.md` | Pages, components, layout system, state management, data flow |
| 10 | `FUTURE_ROADMAP.md` | Phases 2–5 with planned enhancements |

## Approach

- Based entirely on actual codebase analysis (hooks, types, pages, DB schema, mock data structures)
- No hallucinated APIs or fake data — describes real structures and intended contracts
- Written for both end users and AI coding assistants (Claude Code)
- Clean markdown with tables, code blocks, and structured sections

## Output

All files written to `/mnt/documents/pippilot-docs/` as individual `.md` files.


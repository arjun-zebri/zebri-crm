# Automations: wire quote_overdue time-emitter (A2)

## Doc diff (front-and-centre per wiring-doc convention)

**`.claude/docs/automations.md`** — "Wired today" gains:

> - `quote_overdue` (A2) — fires once for `quotes` with `status = 'sent'` on the day they cross `max(1, daysOverdueMin ?? 1)` days past `expires_at` (a min of 0 is clamped to 1 — the expiry day itself belongs to `quote_due`). Emits one event per (quote, threshold, calendar day); narrowing via `payload.days_overdue === threshold`, plus a `daysOverdueMax` window guard. `couplePreviouslyViewed` is accepted by the schema but **not enforced** — quote view tracking doesn't exist yet, and the inspector hides the checkbox until it does. Day boundaries are UTC (same caveat as `quote_due`).

Future-work list gains "Quote view tracking" as the named prerequisite for `couplePreviouslyViewed` + `quote_viewed_but_not_responded`.

**`.claude/docs/automations-wiring.md`** — A2 row ticked ☑.

## What

Second time-based trigger on the A1 framework (~as predicted: one emitter file + registry append + tests + doc rows).

- `lib/automations/time-emitters/quote-overdue.ts` — per-user threshold fan-out, per-(quote, threshold, day) dedupe against `automation_events`, emits via `emit_automation_event` with `payload.days_overdue`. Config defaults applied via `spec.configSchema.safeParse` (the A1 picker-regression pattern). Impossible windows (max < effective min) are skipped at the emit side too.
- `lib/automations/triggers.ts` — `quote_overdue.match()` was `() => true`; now narrows by `payload.days_overdue === quoteOverdueThresholdDays(config)` with a `daysOverdueMax` guard. The threshold helper is exported and shared with the emitter so both sides agree on the firing day.
- `inspector-extended.tsx` — removed the quote-branch "couple has previously viewed" checkbox: no view tracking exists in the schema, so the filter silently did nothing. Schema still accepts the field; previously saved configs are harmless.
- `tests/unit/lib/automations/home-payload.test.ts` — pre-existing calendar-drift flake: hardcoded `started_at` ISO dates aged out of the 7-day errored-runs window (started failing 2026-06-10 on a clean checkout). Now relative to `Date.now()`.

## Tests (TDD — both specs watched failing first)

- Unit (`quote-overdue.test.ts`): threshold clamp (0→1, default 1), match narrowing per depth, max-window rejection, missing/non-numeric payload rejection.
- Integration (local Supabase, real RLS): fires at 1 day overdue on empty config, not on the expiry day, at configured min and not before, min=0 clamps, separate events per threshold, skips draft/accepted, idempotent across ticks, emitter→dispatcher opens a run on empty config, cross-tenant RLS denial.

## Verification

1. `npm run typecheck` — 0 ✅
2. `npm run typecheck:strict` — 323/323, no regression ✅
3. `npm run lint:gate` — errors 89/89, warnings 481/481 ✅
4. `npm test` — 741 passed ✅
5. `npx playwright test` — 30 passed (chromium/firefox/webkit/Pixel 5/iPhone 12) ✅
6. `supabase db reset && npm run test:integration` — fresh DB from zero, 251 passed ✅
7. Manual smoke on local dev — see smoke-test instructions in the session notes.

## Known limitations (documented in automations.md)

- UTC day boundaries (same as A1; per-user timezone is open question 5).
- Cron is daily (`0 1 * * *`) on Vercel Hobby until the Pro upgrade before A8 — day-grain is fine for this trigger.
- `couplePreviouslyViewed` deferred until quote view tracking exists.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

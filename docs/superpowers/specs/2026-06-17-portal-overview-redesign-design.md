# Couple Portal — Overview tab redesign

**Date:** 2026-06-17
**Surface:** `app/portal/[token]` — Overview section (public, token-gated)
**Status:** Approved, ready for implementation plan

## Problem

The portal Overview tab is thin and read-only. It shows the couple name, a
single couple-level email, and a flat list of event dates. Couples cannot
maintain their own contact details, and the event list carries no useful
summary (no countdown, status, or venue emphasis beyond the next event).

We want the Overview to:

1. Let either partner edit **primary** and **secondary** contact details
   (name, email, phone) directly in the portal.
2. Present a clearer **summary of events** (countdown hero + per-event status).
3. Look better, within the existing design system.

## Decisions (locked during brainstorming)

- **Edit scope:** Either partner (any valid link) can edit *both* contact
  triples. No privacy boundary on contact info. (Vow privacy stays
  per-partner via `viewer` — unchanged by this work.)
- **Layout:** Single column (matches the rest of the portal, `max-w-2xl`).
  Order: countdown hero → editable contact cards → all-events list.
- **Save model:** Autosave on blur (debounced), matching the portal's
  existing autosave convention. No explicit Save button.
- **Card headings:** Show the entered partner name, falling back to
  "Partner 1" / "Partner 2" when empty.

## Current state

- `couples` already has `primary_name/email/phone` and
  `secondary_name/email/phone` columns (see `types/couple.ts`).
- `get_portal_data` (migration `20260616000000_per_partner_portal_tokens.sql`)
  returns `couple_name`, `couple_email`, `primary_name`, `secondary_name`,
  `viewer`, and an `events` array — but **not** the primary/secondary
  email/phone fields.
- There is **no** RPC to write couple-level contact details from the portal.
- `overview-section.tsx` is a read-only presentational component receiving
  `coupleName`, `coupleEmail`, `events`.

## Design

### 1. Database (one migration)

**1a. Extend `get_portal_data`** to add to the returned JSON:
`primary_email`, `primary_phone`, `secondary_email`, `secondary_phone`
(read from the `couples` row, same join already present). No other change to
the function's shape; `viewer` and vow privacy filtering stay as-is.

**1b. New RPC** `save_portal_couple_details`:

```
save_portal_couple_details(
  p_token            uuid,
  p_primary_name     text,
  p_primary_email    text,
  p_primary_phone    text,
  p_secondary_name   text,
  p_secondary_email  text,
  p_secondary_phone  text
) returns void
```

- `language plpgsql`, `security definer`, `set search_path = public`.
- Resolve `couple_id` via `_resolve_portal_couple(p_token)`; raise on invalid
  token (mirror the other `save_portal_*` RPCs).
- `update public.couples set primary_name = ..., ... where id = v_couple_id`.
- Apply light length caps (e.g. trim + cap each field at a sane max such as
  200 chars) defensively, since the caller is `anon`.
- `grant execute ... to anon`.
- Follows the existing per-partner RPC pattern in the same migration file's
  style. No destructive SQL.

### 2. Types

- Extend `PortalData` in `app/portal/[token]/page.tsx` with
  `primary_email`, `primary_phone`, `secondary_email`, `secondary_phone`
  (all `string | null`). `primary_name` / `secondary_name` already exist.
- Regenerate `types/database.ts` (`supabase gen types`) so the new RPC and
  return shape are typed; no `as any`.

### 3. Components

Rewrite `overview-section.tsx` as an orchestrator and split to stay ≤ ~150
lines per file. Co-located in `app/portal/[token]/`:

- **`OverviewSection`** (orchestrator) — receives `token`, the couple name,
  the two contact triples, and `events`. Renders hero → contact cards →
  events list. Holds local state for the editable fields + autosave status.
- **`ContactDetailsCard`** — one editable triple (name/email/phone). Props:
  label fallback, current values, and an `onSave(partial)` callback. Inline
  fields, autosave on blur (debounced), shows Saving… / Saved ✓ / error.
  Uses `components/ui` primitives (Input) and design tokens — no raw
  `<input>`, no off-token colours.
- **`EventsSummary`** (or inline helper) — countdown hero for the next event
  + compact per-event cards (date, venue, status, countdown / "Past" badge).
  Reuse the existing `formatEventDate` / `daysUntil` / `isPastEvent` helpers.

Autosave calls `supabase.rpc('save_portal_couple_details', …)` with the full
current triple set (or both triples) and updates the status affordance.
Optimistic local state; inline error text on failure.

### 4. Wiring

- `portal-shell.tsx` currently passes `coupleName`, `coupleEmail`, `events`
  to `OverviewSection`. Update it to also pass `token` and the four new
  contact fields (plus the two names) from `initialData`.

## Out of scope

- Vow privacy / per-partner token behaviour (already shipped, unchanged).
- Couple-level `name` / `email` editing (the hero title stays read-only;
  only the primary/secondary triples are editable).
- Block-tree / branding rendering changes.

## Definition of Done (per `.claude/docs/production-readiness.md` §5)

- No `any`; generated DB types end to end.
- TSDoc on exported component/types + why-comments on non-obvious logic.
- Design-system compliant (tokens + `components/ui` primitives).
- Loading / empty / error states (no events; autosave in-flight / failed).
- Works desktop + mobile (cards stack on mobile).
- Migration passes the safety gate + local replay; deployed via CI
  `supabase db push`.
- `.claude/docs/database-schema.md` + `page-specs.md` updated.
- Ships on the current `staging`-only batch (no per-phase `main` promotion).

# Trim starter templates to a few exemplars per tab

**Date:** 2026-07-09
**Status:** Approved, ready for implementation

## Problem

The Templates page ships large seeded "starter" catalogs per tab. User
feedback: most MCs write their own templates anyway, so the starters
should be a small *guide* — a few clear exemplars that show how each
template type is structured — not a comprehensive library. The Emails
tab is the offender at 26 starters; the other tabs are already lean.

## Goal

~3 exemplars per tab, uniform in spirit. Each surviving starter should
teach the format: tone, variable/mention usage, and structure.

## Scope of change

Catalog **data only**. No UI, schema, or behaviour changes. Removing a
definition just shrinks the "Browse starters" modal. Nothing is
auto-seeded, and any starter a user already added is an independent copy
in their own rows (`is_starter` flagged) — untouched by this change. No
migration needed.

## Per-tab target

| Tab | Now | After | Action |
|-----|-----|-------|--------|
| Emails | 26 | 3 | Keep 3, delete 23 |
| Packages | 4 | 3 | Drop "Add-on: Planning meeting / rehearsal" |
| Quotes | 3 | 3 | Unchanged |
| Invoices | 3 | 3 | Unchanged |
| Questionnaires | 3 | 3 | Unchanged |
| Timelines | 2 | 2 | Unchanged (heavy to author; 2 is a fair guide) |
| Contracts | 2 | 2 | Unchanged (same rationale) |

## Email selection (the only real curation)

Keep one per lifecycle stage so the stage grouping still reads as a
pattern, and span the funnel so a user sees range:

1. **Enquiry acknowledgement** (Enquiry stage) — warm first-touch,
   demonstrates `{{couple.primary_name}}` mentions.
2. **Quote cover email** (Quote stage) — the money moment, demonstrates
   `{{mc.business_name}}` variables.
3. **You're booked: confirmation** (Booked stage) — a milestone email in
   a celebratory tone.

Delete the other 23: Availability yes, Booked out, Discovery call, Quote
nudge, Quote expiring, Agreement to sign, Deposit invoice, Payment
received, Questionnaire request, Song requests, Run sheet draft, Final
details, Balance reminder, NOIM, Docs request, Ceremony script, Marriage
cert, Day-of logistics, Run sheet to vendors, Thank you, Review request,
Referral, Anniversary.

## Files touched

- `lib/email/starter-templates.ts` — keep 3 definitions, remove 23.
- `lib/payments/starter-line-item-templates.ts` — remove the Add-on
  entry from `STARTER_PACKAGES`.

## Verification

- No other file references the removed email starter names (confirmed:
  `grep` across `lib/`, `app/`, `tests/` returned nothing outside the
  definition file — automations `launch-catalogue` does not name them).
- No test asserts starter counts (confirmed).
- `npm run typecheck` stays green.
- Manual: open Templates → each tab's "Browse starters" shows the
  trimmed list; existing added rows are unaffected.

## Out of scope

- No changes to how starters are added, flagged, or rendered.
- No new exemplars authored for Timelines/Contracts (2 each stands).

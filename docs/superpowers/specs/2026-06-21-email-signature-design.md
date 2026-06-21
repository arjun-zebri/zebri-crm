# Email Signature — Design Spec

**Date:** 2026-06-21
**Status:** Approved, ready for implementation plan

## Goal

Let an MC configure a single rich-text email signature in Settings and
use it in email templates via the `{{ mc.signature }}` variable. The
signature itself may contain other template variables (e.g.
`{{ mc.business_name }}`), which resolve when the signature renders.

## Decisions (locked)

- **One signature per account** (not multiple named signatures).
- **Rich text** (TipTap), reusing the existing template body editor.
- **Nested variables** inside the signature resolve through the same
  pipeline.
- **Dedicated "Signature" settings tab** (not folded into Personal info).
- Exposed as **`{{ mc.signature }}`** in the existing "You / MC"
  variable group.
- Renders as **HTML** (formatting and links preserved) when injected.

## 1. Storage

- New field `email_signature` on Supabase Auth `user_metadata`, typed as
  TipTap `JSONContent` (same shape as email template bodies).
- User-writable, consistent with the existing `mc_signature_name` field.
  No DB migration — this is auth metadata, not a table.
- Add `email_signature?: JSONContent` to the `UserMetadata` interface in
  `app/(dashboard)/settings/settings-body.tsx`.

## 2. Settings UI

- New component `app/(dashboard)/settings/email-signature-section.tsx`
  (≤150 lines), modeled on `personal-info-section.tsx`:
  - `RichTextEditor` seeded with `EMAIL_TEMPLATE_VARIABLES` so the
    variable picker is available inside the signature.
  - Auto-save on blur via `supabase.auth.updateUser({ data })`, diffing
    against a `savedRef` baseline (existing pattern).
  - `AutoSaveStatus` indicator (idle/saving/saved/error).
  - Explicit empty state (editor starts empty with helper copy).
- New `'signature'` tab in `settings-nav.tsx`; route it in
  `settings-body.tsx`.
- Design-system compliant: semantic tokens, `components/ui` primitives,
  no ad-hoc styles; works on desktop and mobile.

## 3. Variable wiring

- Add `mc.signature` to the MC group in `VARIABLE_CATALOGUE`
  (`lib/automations/variables.ts`) and to `EMAIL_TEMPLATE_VARIABLES`
  (`lib/email/template-variables.ts`) so it appears in the subject and
  body variable pickers. (In practice it is a body-only variable.)
- The resolver renders the signature JSON through the same email
  rendering pipeline, producing sanitized HTML, and returns that HTML as
  the value substituted for `{{ mc.signature }}`.

## 4. Send flow

- `buildManualSendContext()` (`lib/email/send-context.ts`) reads
  `email_signature` from `user_metadata` into the MC snapshot so
  `mc.signature` resolves at send time.
- The automation context builder does the same, so manual and
  automation-triggered sends behave identically.
- `buildSampleContext()` (`lib/email/template-variables.ts`) gets a
  placeholder signature so the template editor preview renders it.

## 5. Edge cases

- **Empty signature** → `mc.signature` resolves to an empty string
  (consistent with other unset MC fields) and is **not** treated as a
  blocking missing variable in `detectMissingVariables()`.
- **Self-reference / recursion** → the signature renders one level deep
  only. A `{{ mc.signature }}` placed inside the signature does not
  re-expand; guard against self-reference so rendering can't recurse.
- **Nested variables that are themselves unresolved** → follow existing
  resolver behavior (empty in send mode, highlighted in preview mode).

## Testing

- **Unit:** resolver returns rendered HTML for a populated signature;
  empty-signature resolves to empty and does not block; a nested
  variable inside the signature resolves; self-reference guard prevents
  recursion.
- **Integration:** signature persists to and reads back from
  `user_metadata`; manual send injects the rendered signature into the
  body.
- **DoD:** TSDoc on new exported APIs, why-comments on non-obvious logic,
  tokens + primitives, loading/empty/error states, mobile, no console
  errors. Update `.claude/docs/page-specs.md` (Settings) and
  `component-library.md` if a new shared piece is introduced.

## Out of scope

- Multiple named signatures.
- Per-template signature selection.
- A standalone signatures table or migration.

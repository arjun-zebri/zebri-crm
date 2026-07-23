# Document Blocks — Redesign Spec

**Status:** Implemented 2026-07-23 on branch feature/proposals-phase-a. Integration/e2e tests deferred to CI (local Docker unavailable). All phases of block decomposition, readiness validation, and onboarding fixes complete.
**Owner:** Arjun
**Supersedes block taxonomy in:** `branding-editor-redesign.md` (block list),
`blocks/types.ts`, `blocks/blocks-by-surface.ts`, `blocks/policy.ts`,
`blocks/defaults.ts`.

## 1. Goal

Redefine the block model behind the six branding documents so that:

1. Every block is clearly classified as **General** (usable on all
   documents) or **Document-specific** (only on its own document).
2. Each document has an explicit, enforced set of **required** and
   **optional** blocks, and the editor tells the user in plain language
   what is missing before a document can be sent.
3. The monolithic `proposalBody` core is broken into real, editable
   blocks.
4. Two onboarding bugs are fixed at the same time (modal flash, default
   styling needing a hard refresh).

The six documents are unchanged: **Proposal, Invoice, Contract, Client
Portal, Run sheet (vendor), Questionnaire**.

## 2. Block classification

Two groups, shown as two labelled sections in the editor's add-block
palette.

### 2.1 General blocks (available on every document)

Palette order = expected frequency of use (most-used first):

| Order | Block       | Was            | Notes                                     |
|-------|-------------|----------------|-------------------------------------------|
| 1     | Text        | `text`         | Free paragraph / note                     |
| 2     | Divider     | `divider`      | Horizontal rule                           |
| 3     | Spacer      | `spacer`       | Adjustable vertical gap                   |
| 4     | My details  | `businessName` | Logo + business name (renamed)            |
| 5     | Image       | `image`        | Uploaded image                            |
| 6     | Tagline     | `tagline`      | Tagline text                              |
| 7     | Footer      | `footer`       | Contact + closing line + social toggles   |

**Footer social links:** the Footer block has per-network toggles for
**Facebook, Instagram, Twitter, Pinterest, and website URL**. Each toggle
shows/hides that network's icon+link in the rendered footer. The URLs
themselves come from the account's branding/business details (not entered
per block); a toggle that is on but has no URL set renders nothing. This
adds five boolean fields to the Footer block config and five source URL
fields (`facebook_url`, `instagram_url`, `twitter_url`, `pinterest_url`,
`website_url`) to the account branding settings if not already present.

**Removed:** `headerBanner` is deleted entirely. There is no banner
block. Existing `headerBanner` blocks migrate to an `image` block during
block repair (see §6). The old `action` block is removed as a general
block — CTAs are now document-specific (Accept / Pay / Sign).

### 2.2 Document-specific blocks

Required unless marked optional. "Required" means: if the block is
absent, the document is flagged **not ready to send** (see §4). Required
blocks **can be reordered and can be deleted**; deleting one raises the
not-ready flag until it is re-added from the palette.

**Proposal** — replaces the single locked `proposalBody` marker with
five real blocks:

| Block                       | Required? |
|-----------------------------|-----------|
| Package header              | Required  |
| Package details             | Required  |
| Package optional inclusions | Optional  |
| Package totals              | Required  |
| Accept CTA                  | Required  |

**Invoice:**

| Block             | Required?                                  |
|-------------------|--------------------------------------------|
| Invoice header    | Required                                   |
| Invoice line items| Required                                   |
| Invoice totals    | Required                                   |
| Payment schedule  | Optional                                   |
| Bank details      | Required — at least one of Bank details /  |
| Pay CTA           | Pay CTA; **both allowed**                  |

Invoice payment rule: **at least one** of Bank details / Pay CTA must be
present; both are allowed. (This relaxes the earlier "one but not both"
rule.)

**Contract** (all required):

| Block           | Required? |
|-----------------|-----------|
| Contract header | Required  |
| Contract body   | Required  |
| Sign CTA        | Required  |

**Client Portal** (required): Portal body.

**Run sheet** (required): Run sheet body. Editor copy must make clear
this document is **sent to vendors only**, not to the couple.

**Questionnaire** (required, pick exactly one mode): Questionnaire body
with a **mode toggle**:

- **Regular form** — all questions top-to-bottom on one page.
- **One at a time** — Typeform-style, one question per step.

Exactly one mode must be selected; the questionnaire is not ready to send
without a mode.

## 3. Default templates (seeded blocks)

Fresh templates ship valid out of the box (all required blocks present).

- **Proposal:** My details → Package header → Package details → Package
  optional inclusions → Package totals → Accept CTA → Footer
- **Invoice:** My details → Invoice header → Invoice line items → Invoice
  totals → Payment schedule → Text (you have a choice to choose between sentence) → Bank details → Pay CTA → Footer
  (default includes **both** Bank details and Pay CTA)
- **Contract:** My details → Contract header → Contract body → Sign CTA →
  Footer
- **Client Portal:** My details → Portal body → Footer
- **Run sheet:** My details → Run sheet body → Footer
- **Questionnaire:** My details → Questionnaire body (mode: Regular form)
  → Footer

## 4. Validation — two layers

### 4.1 Layer A — Template validity (in the branding editor)

Per-document checks against the block tree only:

- All **required** blocks present.
- Invoice: at least one of Bank details / Pay CTA present.
- Questionnaire: a mode is selected.

When a check fails, the editor shows a **"Not ready to send"** panel that
names what is missing in plain language, e.g. "Add Package totals and an
Accept CTA to finish this proposal." No jargon, no block-type codes.

### 4.2 Layer B — Account-wide readiness

These prerequisites are **account-wide, not per couple**. They are
checked once against account settings and apply to every document of that
type:

| Trigger block   | Ready when…                        | Flag when missing                          |
|-----------------|------------------------------------|--------------------------------------------|
| Pay CTA         | Stripe Connect connected (account) | "Connect Stripe to accept card payments."  |
| Bank details    | Bank details filled in settings    | "Add your bank details in Settings."       |
| Contract body   | A contract has been created        | "Create your contract to send it."         |

Layer B flags surface both in the branding editor (so the user knows the
document type is not yet sendable) and at actual send time. They never
block editing — only sending.

> Implementation note: the contract body is currently stored as
> per-couple TipTap editor content. Treating the contract as an
> account-wide asset (one contract created once, checked account-wide) is
> a real change. Confirm where contract content should live during
> implementation and align the readiness check accordingly.

## 5. Onboarding bug fixes (bundled)

### 5.1 Modal flashes on every visit / hard refresh

**Symptom:** the onboarding modal flashes when opening Branding or hard
refreshing; it should only ever appear on a user's first visit.

**Cause:** `shouldShowOnboarding` paints the modal from a localStorage
hint while the DB `onboarded_at` is still loading. On a hard refresh the
cache can be empty/stale, so the "show" path wins for a frame.

**Fix:** during load, only paint the modal when the cache **positively**
says "needs onboarding". If the cache is empty or unknown, wait for the
DB `onboarded_at` to resolve before deciding. On wizard completion, write
the cache so returning users never flash. Net effect: only a genuine,
never-onboarded user sees the modal, and only once.

### 5.2 Default styling not applied until a hard refresh

**Symptom:** default branding (theme preset colours/fonts/density) is not
applied until the user hard refreshes.

**Fix:** apply the default theme preset from `initialData` on first
paint, rather than only after an editor remount. Confirm the exact mount
path during implementation (the CSS-variable injection must run when data
is ready, not only on manual remount).

## 6. Migration & data repair

`repairBlocks()` / `repairAllSurfaces()` (in
`lib/branding/validate-blocks.ts`) must:

- Migrate any `headerBanner` block → `image` block (preserve the image).
- Drop the old `action` general block type; map existing proposal accept
  actions to the new **Accept CTA**, invoice pay actions to **Pay CTA**,
  contract sign actions to **Sign CTA**.
- Expand any legacy `proposalBody` marker into the five proposal blocks
  (Package header, details, optional inclusions, totals, Accept CTA).
- Ensure required blocks exist; do **not** auto-delete extra optional
  blocks the user has added.
- Stay idempotent (safe to run on every load/save).

Repair must run once over all existing `user_branding.branding_blocks`
rows so current users are migrated without manual action.

## 7. Files in scope (from the current codebase map)

- `app/(dashboard)/branding/blocks/types.ts` — block union + per-block types
- `app/(dashboard)/branding/blocks/blocks-by-surface.ts` — palette allow-list
- `app/(dashboard)/branding/blocks/policy.ts` — required / marker sets
- `app/(dashboard)/branding/blocks/defaults.ts` — seeded templates
- `app/(dashboard)/branding/blocks/render.tsx` — editor rendering
- `app/(dashboard)/branding/blocks/sample-doc.ts` — preview data
- `lib/branding/validate-blocks.ts` — repair / migration
- `lib/branding/public-renderer.tsx` + `lib/branding/public-blocks/*` — public rendering
- `components/proposal/proposal-document-body.tsx` + proposal public page — proposal decomposition
- `app/(dashboard)/branding/onboarding/onboarding-modal.tsx`,
  `lib/branding/onboarding-gate.ts`,
  `app/(dashboard)/branding/page.tsx` — onboarding fixes
- `types/branding-preview.ts` — `SurfaceTab` / `BlocksByDoc`

## 8. Definition of Done (per `production-readiness.md` §5)

- No `any`; generated DB types end to end.
- TSDoc on new/changed exported APIs; why-comments on the repair and
  validation logic.
- Unit tests for block classification, required-block validation, invoice
  at-least-one rule, questionnaire-mode rule, and `repairBlocks`
  migration paths.
- Integration test proving cross-tenant RLS denial on `user_branding`.
- E2E: build a proposal/invoice, delete a required block, see the
  not-ready flag; onboarding modal shows once and default styling paints
  without refresh.
- Design-system compliant (tokens + primitives). Explicit loading / empty
  / error states preserved.
- Works on desktop and mobile (Pixel 5 + iPhone 12).
- `.claude/docs/branding.md` (or `page-specs.md`) updated to reflect the
  new block model.

## 9. Out of scope

- Block-tree rendering redesign on public surfaces beyond what the block
  changes require.
- Any new document type.
- Changing how proposal package data is authored (only how it is split
  into blocks for display).

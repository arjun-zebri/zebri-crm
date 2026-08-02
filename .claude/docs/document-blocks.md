# Document Blocks — Redesign Spec

**Status:** Implemented 2026-07-23 on branch feature/proposals-phase-a. Integration/e2e tests deferred to CI (local Docker unavailable). All phases of block decomposition, readiness validation, and onboarding fixes complete.

**Update (2026-07-30):** The Proposal document was removed entirely, and with it the package block types (`proposalBody`, `packageHeader`, `packageDetails`, `packageLineItems`, `packageInclusions`, `packageTotals`). The shared `action` block survives. The current document set is five: Invoice, Contract, Client Portal, Run sheet, Questionnaire. The proposal-specific and package-block detail below has been pruned to match; the readiness, validation, and onboarding sections still apply to the remaining documents.
**Owner:** Arjun
**Supersedes block taxonomy in:** `branding-editor-redesign.md` (block list),
`blocks/types.ts`, `blocks/blocks-by-surface.ts`, `blocks/policy.ts`,
`blocks/defaults.ts`.

## 1. Goal

Redefine the block model behind the five branding documents so that:

1. Every block is clearly classified as **General** (usable on all
   documents) or **Document-specific** (only on its own document).
2. Each document has an explicit, enforced set of **required** and
   **optional** blocks, and the editor tells the user in plain language
   what is missing before a document can be sent.
3. Two onboarding bugs are fixed at the same time (modal flash, default
   styling needing a hard refresh).

The five documents are: **Invoice, Contract, Client Portal, Run sheet
(vendor), Questionnaire**.

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
block repair (see §6). The shared `action` block is retained and carries
the document CTA (Pay on invoices, Sign on contracts).

### 2.2 Document-specific blocks

Required unless marked optional. "Required" means: if the block is
absent, the document is flagged **not ready to send** (see §4). Required
blocks **can be reordered and can be deleted**; deleting one raises the
not-ready flag until it is re-added from the palette.

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

**Contract**:

| Block           | Required? |
|-----------------|-----------|
| Contract header | Required  |
| Contract body   | Required  |
| Sign contract   | Required  |

There is **no generic Sign CTA (`action`) block** on the contract
surface. The sign/decline form is its own **`contractSign` marker
block**: it renders where the marker sits (below the body by default),
carries the couple's typed-name form + agreement checkbox + Sign /
Decline buttons, and the **MC countersignature** ("Signed by MC" +
cursive name) which moved out of the contract body into this block. The
`action` block is not addable on contracts and is not in the contract
required set. The contract header (`title`) defaults with **Expires off
and Ref off** (a contract is signed, not quoted or billed, so it carries
neither an expiry date nor a customer-facing reference number); the
header reads as the contract title + couple name.

**Editable vs fixed on the sign block.** The form's *behaviour* (name
input, agreement checkbox, sign/decline API calls, the decline dialog,
the signing state machine) is fixed and never surfaced in the editor.
What the MC *can* edit lives on the block: the prompt **heading**
(`heading`), the **Sign** / **Decline** button labels (`primaryLabel` /
`secondaryLabel`), the sign-button **colour** (`buttonColor`), and two
typography targets — **Heading** (`headingStyle`, over the
`sectionHeading` role) and **Label** (`labelStyle`, over the `body`
role), chosen by clicking the corresponding part in the preview. Every
field is optional; each falls back to its historical default
(`'Sign to accept'` / `'Sign contract'` / `'Decline'` / the brand
colour / fine-print typography).

**Both clearable markers.** Unlike the fixed render-split markers
(portal / questionnaire body, which survive a "Clear all blocks"), the
contract **body** and **sign** markers are `CLEARABLE_MARKERS` (along
with the run sheet body): "Clear all blocks" removes them so a contract
can be reset to a truly blank canvas. When absent, each becomes re-addable
from the block palette, the readiness panel flags its absence, and
`migrateBlocks` will **not** silently re-insert either (it only heals
genuine pre-Phase-3.1 legacy contracts for the body; it never fabricates
a sign marker).

**Legacy safety (critical).** Every contract sent before this feature
carries a `contractBody` marker but **no** `contractSign` marker. The
public `contract-branded-card` handles the two-marker split in saved
order, but when the sign marker is **absent** it injects the sign slot
(form + banner + MC signature) **right after the body section** — today's
exact placement — so those contracts render identically and stay
signable. A contract is always signable even with no sign block. The
fallback card (no block tree at all) likewise renders hero → body →
sign slot.

**Contract-body typography (contract-scoped).** Selecting the contract-body
block exposes typography controls for two targets, chosen by clicking the
corresponding part in the preview: **Paragraph** (the prose `<p>`, stored as
`contractBody.bodyStyle`) and **Subheading** (the clause headings
`h1`/`h2`/`h3`, stored as `contractBody.subheadingStyle`). Both are optional
`TextStyle` overrides that live on the block, so they **never** affect invoices
or quotes. Targets default to the global `body` / `sectionHeading` roles.

The live prose is a locked HTML snapshot injected via `.contract-content`
(`app/globals.css`). Each styled property there is driven by a `--cc-*` CSS
variable whose **fallback equals the historical hard-coded value**
(`--cc-body-color`, `--cc-body-line-height`, `--cc-body-case`;
`--cc-subheading-font/size/weight/color/case`). A variable is **set only when
the MC explicitly overrides that property** (see `contract-body-section.tsx`) —
never from a role default. Result: a contract with no overrides (every contract
sent before this feature) renders byte-identically. A subheading size override
collapses all three heading levels to one size; paragraph font-family + size
flow through the `.contract-content` wrapper inline style rather than a var.

**Client Portal** (required): Portal body.

**Run sheet** (required): Run sheet body. Editor copy must make clear
this document is **sent to vendors only**, not to the couple. Like the
contract body, the run sheet body is a `CLEARABLE_MARKER`: selectable in
the editor (it renders a representative sample through the real
`VendorTimeline` component), clearable via "Clear all blocks",
deletable, and re-addable from the palette (where it stays listed). The
public run sheet and the branding preview both inject the live/sample
timeline at the marker. The body itself is not authored here (it is the
couple's live event timeline); only chrome blocks around it are editable.

**Typography (title / subtitle / body / note).** The marker block carries four
optional overrides — `titleStyle`, `subtitleStyle`, `bodyStyle`, `noteStyle` —
edited via click-to-target in the preview (`data-subtarget` = `title` /
`subtitle` / `body` / `note`), same UX as the contract body/sign controls.
**Title** styles the `<h1>Run Sheet</h1>` (over the `docTitle` role),
**Subtitle** the date / venue line (over `finePrint`), **Body** the per-item
title (over `body`), and **Note** the per-item description (over `finePrint`).
Body and Note are separate levels so the item title and its note are styled
independently. Unlike the contract body, this is **inline-driven,
not globals.css-driven**: `VendorTimeline` already styles every element with
inline styles from the type roles, so each element resolves as
`resolveTextStyle(override, defaultsBuiltFromTheValuesItCurrentlyHard-codes)`.
The defaults preserve the element's current colour (`heading_color` /
`text_color`) and force `letterSpacing: 0` + `textTransform: 'none'` (the neutral
values the old inline styles already rendered), so a run sheet with **no
overrides renders byte-identically** to every run sheet sent before this feature.
The overrides are run-sheet-scoped (they live on the block) and never touch
invoices, quotes, or contracts. `migrateBlocks` / `repairBlocks` pass them
through untouched and never fabricate them on a bare marker.

**Questionnaire** (required, pick exactly one mode): Questionnaire body
with a **mode toggle**:

- **Regular form** — all questions top-to-bottom on one page.
- **One at a time** — Typeform-style, one question per step.

Exactly one mode must be selected; the questionnaire is not ready to send
without a mode.

## 3. Default templates (seeded blocks)

Fresh templates ship valid out of the box (all required blocks present).

- **Invoice:** My details → Invoice header → Invoice line items → Invoice
  totals → Payment schedule → Text (you have a choice to choose between sentence) → Bank details → Pay CTA → Footer
  (default includes **both** Bank details and Pay CTA)
- **Contract:** My details → Contract header → Contract body → Sign
  contract (the sign/decline form + MC countersignature; no generic CTA
  block). Legacy contracts predating the sign block have no `contractSign`
  marker and get the form injected after the body instead.
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
names what is missing in plain language, e.g. "Add Invoice totals and a
Pay CTA to finish this invoice." No jargon, no block-type codes.

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
- Drop any legacy `proposalBody` marker and the removed package block
  types (`packageHeader`, `packageDetails`, `packageLineItems`,
  `packageInclusions`, `packageTotals`); the `action` block is kept.
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
- E2E: build an invoice, delete a required block, see the
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

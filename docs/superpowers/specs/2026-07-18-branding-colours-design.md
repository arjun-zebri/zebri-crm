# Branding Colours — Design Spec

**Date:** 2026-07-18
**Branch:** `feature/proposals-phase-a`
**Status:** Draft — pending Arjun review
**Builds on:** `2026-07-16-branding-overhaul-design.md` (the six editable
surfaces + onboarding wizard shipped there). This spec only reshapes the
**colour model** used by onboarding and the global editor.

## Goal

Give wedding MCs a small, legible set of brand colours with clear roles, and
make the onboarding wizard collect them with an honest worked-example preview.
Replace today's ad-hoc palette (Primary/Accent/Surface/Text/Muted/Secondary/
Secondary-text/Link/Page-background) with a single role-based model.

## Locked decisions (from Arjun, 2026-07-18)

1. **One unified model** across onboarding and the global editor.
2. **Reset every account's scalar colours to the new defaults** in the
   migration. Everyone re-onboards anyway (branding was already reset); this
   avoids the legacy `text_color` "heading and body at once" ambiguity.
3. **Drop Accent, Muted, Secondary-text, Page-background as controls.**
   Secondary/metadata text uses the **body colour as-is** (no derivation).
4. **Link colour stays** — global editor only, not in onboarding.
5. **Remove the corner-radius control from onboarding** (keeps the Look step
   from scrolling; it remains in the full editor).
6. **Add a Subheading colour** (defaults black).

## The colour model

| Role | Storage key (user_metadata) | Default | Onboarding | Global editor |
|---|---|---|---|---|
| Heading | `heading_color` **(new)** | `#111827` (black) | ✅ | ✅ |
| Subheading | `subheading_color` **(new)** | `#111827` (black) | ✅ | ✅ |
| Body text | `text_color` | `#6B7280` (grey) | ✅ | ✅ |
| Background | `surface_color` | `#FFFFFF` (white) | ✅ | ✅ |
| Primary CTA | `brand_color` | `#111827` (black) | ✅ | ✅ |
| Secondary CTA | `secondary_color` | `#6B7280` (grey) | ✅ | ✅ |
| Link | `link_color` | = Primary CTA (`#111827`) | ❌ | ✅ |

**Dropped controls (and their rendering fate):**

| Dropped key | Was used for | Now resolves to |
|---|---|---|
| `accent_color` | proposal accent (1 spot, `proposal-page-view.tsx:56`) | `brand_color` |
| `muted_color` | ~20 secondary-text spots (subtitles, metadata) | `text_color` (body, as-is) |
| `secondary_text_color` | secondary button label (`action.tsx:78`) | `getTextColor(secondary_color)` (auto-contrast) |
| `page_background` | vendor page bg (1 spot, `vendor/page.tsx:45`) | `surface_color` |

**Why no `ALTER TABLE`:** brand colours live in the `auth.users`
`raw_user_meta_data` JSONB bag, surfaced by the `_user_branding()` SQL
function's COALESCE list — not as real columns. Adding/removing a colour is a
function replacement plus save-pipeline edits, never DDL. No destructive
schema marker is required.

## 1. Migration (one file, function replacement + data reset)

`supabase/migrations/2026071810XXXX_branding_colours.sql`:

- `CREATE OR REPLACE FUNCTION _user_branding(uuid)`:
  - **Add** `heading_color`, `subheading_color` to the returned JSON.
  - **Keep** `text_color`, `surface_color`, `brand_color`, `secondary_color`,
    `link_color`.
  - **Remove** `accent_color`, `muted_color`, `secondary_text_color`,
    `page_background` from the returned JSON.
  - Update the COALESCE defaults to the new palette (black/black/grey/white/
    black/grey; link default = brand).
- **Reset scalars for all users** (data update, not DDL):
  ```sql
  update auth.users
     set raw_user_meta_data =
         (raw_user_meta_data
           || jsonb_build_object(
                'heading_color',    '#111827',
                'subheading_color', '#111827',
                'text_color',       '#6B7280',
                'surface_color',    '#FFFFFF',
                'brand_color',      '#111827',
                'secondary_color',  '#6B7280',
                'link_color',       '#111827'))
           - 'accent_color' - 'muted_color'
           - 'secondary_text_color' - 'page_background';
  ```
  Carries an `-- @ALLOW_DESTRUCTIVE:` marker (overwrites saved colours by
  intent) even though the safety gate's regex does not flag jsonb key removal.
- Every RPC that merges `_user_branding` (`get_public_{proposal,invoice,
  contract}`, `get_portal_data`, `get_vendor_timeline_data`,
  `get_questionnaire`) inherits the new shape automatically — no per-RPC edits.

Deploys via CI `supabase db push` only. Local verification via the isolated
local-Supabase dev-server recipe.

## 2. Rendering (`lib/branding/`)

- `type-defaults.ts` (heading/body resolver, ~L59–82): headings →
  `heading_color`; **new** subheading resolution → `subheading_color`; body →
  `text_color`.
- `public-blocks/action.tsx`: primary button stays `brand_color`; secondary
  button fill stays `secondary_color`, label → `getTextColor(secondary_color)`.
- **All `muted_color` reads → `text_color`** (public-blocks + surface views +
  editor preview; the audit found ~20 sites).
- `proposal-page-view.tsx:56` accent fallback → `brand_color`.
- `vendor/page.tsx:45` `page_background` → `surface_color`.
- **Wire `link_color` into rendering** (currently dead code): style `<a>` tags
  inside sanitized text blocks with `link_color` (via a CSS variable on the
  block/text wrapper). This is new public-surface behaviour.
- `public-renderer.tsx`: extend the branding prop with `heading_color` /
  `subheading_color`; drop the removed keys.

**Subheading application:** `subheading_color` styles secondary heading levels
— section sub-labels and the title block's subtitle line. Exact heading-level
mapping is finalised in planning against `type-defaults.ts`'s heading model.

## 3. Onboarding Look step

Files: `app/(dashboard)/branding/onboarding/step-look.tsx`, `look-pickers.tsx`,
`onboarding-wizard.tsx`.

- Replace the 2 `ColorField`s with **6**, labelled: **Heading**,
  **Subheading**, **Body text**, **Background**, **Primary button**,
  **Secondary button**. Two-column grid so all six fit without scrolling.
- **Remove the corner-radius control** and its `cornerRadius` field from
  `OnboardingResult` (global default stands).
- **Worked-example preview:** a mini document card rendering a heading, a
  subheading, one line of body text, on the chosen background, with a Primary
  and a Secondary button — each tinted live from the six pickers, so the roles
  are unmistakable.
- `OnboardingResult` colour fields become: `headingColor`, `subheadingColor`,
  `bodyColor`, `backgroundColor`, `primaryButtonColor`, `secondaryButtonColor`.
  `page.tsx#handleWizardComplete` maps them to `heading_color`,
  `subheading_color`, `text_color`, `surface_color`, `brand_color`,
  `secondary_color`; stops writing `secondary_text_color`/`corner_radius`.

## 4. Global editor

Files: `app/(dashboard)/branding/brand-panel.tsx`, `branding-editor.tsx`,
`page.tsx`.

- `ColorSection`: exactly **6** rows — Heading, Subheading, Body text,
  Background, Primary CTA, Secondary CTA. Remove Accent, Muted, Secondary-text;
  relabel Surface→Background, Text→Body text, Primary→Primary CTA,
  Secondary→Secondary CTA.
- `GlobalStylesSection`: keep **Link colour**; remove **Page background**.
- Autosave (`branding-editor.tsx` ~L261–312): add `heading_color`,
  `subheading_color`; remove `accent_color`, `muted_color`,
  `secondary_text_color`, `page_background`; keep `brand_color`,
  `surface_color`, `text_color`, `secondary_color`, `link_color`.
- `BrandingEditor` `initialData` (`page.tsx`): add heading/subheading; drop the
  removed keys.

## 5. Types

- `types/branding-preview.ts` — `BrandPreviewState` & `BrandKit`: add
  `headingColor`, `subheadingColor`, `linkColor`; remove `accentColor`,
  `mutedColor`, `secondaryTextColor`.
- `lib/branding/themes.ts` — `ThemePreset`: add `heading`, `subheading`;
  remove `accent`, `muted`; update `THEME_PRESETS` to the new defaults. Reuse
  `COLOR_PALETTE`/`TEXT_PALETTE` for the new controls' swatches.

## 6. Testing

- **Unit:** `type-defaults` resolves heading→`heading_color`,
  subheading→`subheading_color`, body→`text_color`; secondary-button label uses
  `getTextColor(secondary_color)`; no `muted_color`/`accent_color` references
  remain in `lib/branding`.
- **Integration (local Supabase):** migration replays from zero;
  `_user_branding` returns the new keys and none of the dropped keys;
  `user_branding` RLS still denies cross-tenant.
- **E2E (desktop + Pixel 5 + iPhone 12):** onboarding Look step shows 6 pickers,
  no corner-radius control, no scroll; the preview reflects each colour; a
  public proposal renders heading and body in different colours; a link inside
  a text block uses the link colour.

## 7. Docs to update (same PR)

`database-schema.md` (branding fields table: add heading/subheading, remove the
four dropped keys), `branding.md`, `page-specs.md` (onboarding + branding
editor), `component-library.md` if the colour-row set is documented,
`production-readiness.md` status line.

## 8. Onboarding load transition (reported bug)

On a hard refresh of `/branding`, `page.tsx` renders `<OnboardingModalSkeleton>`
(gated by the `zebri:branding-onboarded` localStorage guess) during the async
load, then swaps in the real `<OnboardingModal>` once `loading` clears. The
skeleton disappears and a visibly *different* modal pops in — a jarring flash
rather than a smooth hand-off.

Fix as part of this work (we're already reshaping the Look step, so the skeleton
would otherwise drift further from the real modal):

- Make `OnboardingModalSkeleton` structurally match the real modal's frame
  (same width, header, step chrome, footer) so the swap is visually continuous.
- Only render the skeleton when the localStorage guess says onboarding is
  likely AND we are still loading; cross-fade or hold the modal frame so the
  inner content fills in rather than the whole modal remounting.
- Verify on hard refresh: no white flash, no double-modal pop, for both the
  "needs onboarding" and "already onboarded" paths.

## Risks

- **Hierarchy flattening:** collapsing `muted_color`→`text_color` makes
  metadata/subtitles the same colour as body. Accepted by founder; watch the
  public documents for legibility after deploy.
- **Link colour is new behaviour:** links were previously unstyled on public
  surfaces; verify no existing content relied on the default link colour.
- **Scalar reset clobbers custom colours:** intended, but irreversible once the
  migration deploys to production. Reaches remote only via CI.
- **Subheading has no dedicated element today:** the heading-level mapping is
  confirmed during planning; if no natural subheading slot exists, we introduce
  one in `type-defaults.ts` rather than overloading body.

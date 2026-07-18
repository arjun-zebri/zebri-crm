# Global Styles Inheritance, Design Spec

**Date:** 2026-07-18
**Branch:** `feature/proposals-phase-a`
**Status:** Draft, pending Arjun review
**Builds on:** `2026-07-18-branding-colours-design.md` (the six role colours plus
Link). This spec makes those roles, and the typography controls beside them,
actually reach every rendered element.

## Goal

Every element on every public surface inherits from global styles unless the
user has explicitly overridden that block. Default documents carry minimal
styling. Changing a global control visibly changes the document.

## The problem

An audit of the proposal, questionnaire, invoice, contract, portal, vendor and
PDF surfaces found roughly 170 sites whose styling cannot respond to global
styles. Three distinct causes:

1. **The typography controls are inert.** `resolveTypeDefaults()` in
   `lib/branding/type-defaults.ts` correctly derives type from
   `PublicBranding`, but nothing calls it except its own unit test. It is dead
   code. Every block renderer hardcodes its own numbers instead:

   ```ts
   // lib/branding/public-blocks/title.tsx:36
   fontSize: 36,          // ignores branding.heading_size
   lineHeight: 1.1,       // ignores branding.body_line_height
   letterSpacing: -0.01,  // ignores branding.heading_letter_spacing
   color: branding.heading_color || '#111827',   // colour does flow
   ```

   So `heading_size`, `body_size`, `heading_case`, `body_case` and
   `heading_letter_spacing` are saved, reach `PublicBranding`, and are then read
   by nobody. Colours mostly work, which is why the failure looked partial.

2. **Baked template styles always win.** `resolveTextStyle` merges with `??`, so
   any value present on a block beats the renderer default permanently. The
   default trees and templates ship `FORMAL_TITLE` (38px), `BOLD_TITLE` (44px),
   `HERO_SUBTITLE`, `EMPHASIZED_TOTAL` (22px), `SOFT_MESSAGE` (13px, `#4B5563`)
   and `SLIM_DIVIDER` (`#F3F4F6`). Those blocks can never inherit.

3. **Literals and app-chrome tokens on public surfaces.** Tailwind colour
   classes (`text-gray-*`, `bg-white`, `border-gray-200`), fixed sizes
   (`text-sm`, `text-xs`, `text-2xl`), fixed radii, and Zebri's internal design
   tokens (`text-success`, `bg-surface-muted`, `border-border`) appear on
   couple-facing documents. None of them respond to branding.

## Locked decisions (from Arjun, 2026-07-18)

1. **Baked block styles are wiped**, not preserved. Default templates and
   locked bodies carry no styling.
2. **A derived type scale**, not flat sizes and not extra controls. Every text
   role is a ratio of Heading size or Body size.
3. **`border_color` becomes a real control**, an eighth colour role.
4. **Status colours stay fixed** and outside branding. Red means error
   regardless of brand.
5. **Scope is everything, including the PDF generators.**
6. **Branding templates are removed entirely.**

## 1. Type scale

New module `lib/branding/type-scale.ts`. One exported function maps a role to a
pixel size derived from the two global numbers.

| Role | Derivation | At defaults (32 / 15) |
|---|---|---|
| `docTitle` | `heading_size` x 1.0 | 32px |
| `sectionHeading` | `heading_size` x 0.625 | 20px |
| `total` | `heading_size` x 0.5625 | 18px |
| `subtitle` | `body_size` x 1.0 | 15px |
| `body` | `body_size` x 1.0 | 15px |
| `finePrint` | `body_size` x 0.8 | 12px |
| `sectionLabel` | `body_size` x 0.73, uppercase | 11px |

Sizes round to the nearest pixel and clamp to a 9px floor, so a small Body size
cannot render fine print illegibly. `sectionLabel` carries the eyebrow
treatment (uppercase, `letterSpacing` 0.18em) unless `heading_case` or
`heading_letter_spacing` say otherwise.

`resolveTypeDefaults` is extended to return a `TextStyleDefaults` for every role
above, drawing colour from the matching role (`docTitle` and `sectionHeading`
from `heading_color`, `sectionLabel` and `subtitle` from `subheading_color`,
`body` and `finePrint` from `text_color`). It becomes the only place a renderer
gets defaults.

## 2. Colour roles

`border_color` is added as an eighth role: global editor only, not in
onboarding (onboarding stays at six, matching how Link already works). Default
`#E5E7EB`.

Migration `supabase/migrations/2026071811XXXX_border_colour.sql` adds
`border_color` to the `_user_branding()` COALESCE list and to the scalar reset.
No DDL, same reasoning as the colour-model migration: these live in the
`raw_user_meta_data` JSONB bag. Every RPC that merges `_user_branding` inherits
the new key.

Status colours move to `lib/branding/status-colors.ts` as documented constants
(`error #DC2626`, `success #16A34A`, `warning #D97706`), explicitly not
brandable. Public surfaces stop importing Zebri's app-chrome tokens.

## 3. Renderers

Every site in the audit is rewired to the scale and the roles:

- `lib/branding/public-blocks/*` (the shared blocks, highest leverage)
- `components/proposal/*`, `components/questionnaires/*`
- `app/invoice/[token]/**`, `app/contract/[token]/**`,
  `app/portal/[token]/**`, `app/proposal/[token]/**`,
  `app/questionnaire/[token]/**`
- `lib/pdf/generate-pdf.ts`

Rules applied throughout:

- No Tailwind colour utilities on public document surfaces. Colour comes from
  an inline style reading a role.
- No Tailwind size utilities for document text. Size comes from the scale.
- Borders and hairlines read `border_color`.
- Radii read `corner_radius`.
- Unreachable fallback literals (`|| '#6B7280'`) are removed where
  `PublicBranding` always supplies a value, so a missing role fails loudly in
  tests rather than silently rendering grey.

The PDF generators are rebuilt to consume `PublicBranding` through the same
scale, replacing the duplicated inline CSS strings that have already drifted
from the web renderers.

## 4. Templates removed

Branding templates exist only to bake styling, so they cannot survive decision
1. Removed:

- `app/(dashboard)/branding/templates/index.ts` (18 templates)
- `app/(dashboard)/branding/templates-section.tsx` (the picker)
- the apply-template handler and rail section in `branding-editor.tsx`
- `tests/unit/branding/templates.test.ts`

`app/(dashboard)/branding/page.tsx` seeds onboarding from
`defaultBlocksFor(surface)` instead of `${surface}-classic`. `defaultBlocksFor`
already covers all six surfaces.

The baked style constants are deleted from `blocks/defaults.ts` as well:
`HERO_SUBTITLE`, `FORMAL_TITLE`, `EMPHASIZED_TOTAL`, `SOFT_MESSAGE`.

After this, a `style` object on a block means exactly one thing: the user set
it. The `??` merge in `resolveTextStyle` becomes correct by construction, so no
change to the block data model or to `TextStyle` is needed.

## 5. Data migration

None required for block trees. The pending
`20260718000000_reset_branding_onboarding.sql` already runs
`delete from user_branding`, so every block tree regenerates from the clean
defaults on re-onboard. Only the `border_color` scalar needs the metadata
migration in section 2.

## 6. Testing

- **Unit:** the type scale returns the documented sizes and honours the floor;
  `resolveTypeDefaults` maps each role to the right colour; a change to
  `heading_size` propagates to `docTitle`, `sectionHeading` and `total`; a
  change to `body_size` propagates to `body`, `subtitle`, `finePrint` and
  `sectionLabel`.
- **Regression guard:** a test asserting every tree from `defaultBlocksFor`
  contains zero `style` objects. This is what stops baked styling creeping back.
- **Integration (local Supabase):** the migration replays from zero;
  `_user_branding` returns `border_color`; RLS still denies cross-tenant.
- **E2E (desktop, Pixel 5, iPhone 12):** changing Heading size in the editor
  visibly changes a public proposal's title; changing Border colour changes the
  line-item rules; a public document renders no Tailwind grey.
- **Grep gate:** no `text-gray-`, `bg-white`, `border-gray-`, `text-success`,
  `bg-surface-muted` in the public surface directories.

## 7. Docs to update (same PR)

`branding.md`, `database-schema.md` (add `border_color`), `page-specs.md`
(branding editor loses the Templates section), `component-library.md`,
`frontend-design.md` (the public-surface styling rules above),
`production-readiness.md`.

## Risks

- **Size and scope.** Roughly 170 sites across seven surfaces. Mitigated by
  doing the shared blocks first, since they carry the most surfaces, and by the
  grep gate catching stragglers.
- **PDF regressions are invisible to unit tests.** The PDF rebuild needs a
  generated document compared by eye before it ships. Snapshot tests catch
  structural breakage but not ugliness.
- **Removing templates is one-way** for anyone who liked Bold. Acceptable
  because block trees are being reset anyway and the distinction was only ever
  a font size.
- **The floor and rounding can surprise.** A user setting Body size to 10 gets
  9px fine print rather than 8px. Documented, not configurable.
- **Live verification is required.** Whether the result reads as calm and
  minimal cannot be judged from tests. This needs the isolated local-Supabase
  dev server and a real look at each surface before it is called done.

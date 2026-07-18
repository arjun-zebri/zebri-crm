# Zebri Custom Branding

MCs customize the look and layout of all customer-facing surfaces via a Canva-grade block-based editor. Branding flows from the editor into quotes, invoices, contracts, proposals, vendor timelines, questionnaires, emails, and PDFs.

**Branded surfaces (Phase 11, 2026-07-17):**

| Surface | Public path | Status |
|---|---|---|
| Quote | `/quote/[token]` | shipped |
| Invoice | `/invoice/[token]` | shipped |
| Contract | `/contract/[token]` | shipped |
| Proposal | `/proposal/[token]` | shipped |
| Vendor Timeline | `/vendor-timeline/[token]` | shipped |
| Questionnaire | `/questionnaire/[token]` | shipped |
| Email (sent docs) | Resend transactional | shipped |
| PDF (generated docs) | Supabase Function | shipped |

------------------------------------------------------------------------

# Block-Tree Model

Branding is a per-surface block tree stored in `user_branding.branding_blocks` (jsonb, keyed by surface). Surfaces are `quote`, `invoice`, `contract`, `proposal`, `vendorTimeline`, `questionnaire`. Empty tree (`[]`) means the surface is disabled (public render returns null).

**Block types:** HeaderBanner, BusinessName, Tagline, Title, Text, LineItems, Totals, PaymentDetails, Action, Image, Spacer, Divider, Footer, ProposalBody, ContractBody, CouplePortal, VendorTimeline, Questionnaire.

**Scalar fields** (global across all surfaces, stored in `user_metadata`):
- **Role-based colours** (user-set via onboarding + editor): `heading_color`, `subheading_color`, `text_color`, `surface_color`, `brand_color` (primary button), `secondary_color` (secondary button), `link_color` (editor-only).
- **Derived aliases** (no longer user-set; automatically derived): `accent_color` (≡ `brand_color`), `muted_color` (≡ `text_color`), `secondary_text_color` (computed from `secondary_color`), `page_background` (≡ `surface_color`).
- **Contact & business info**: logo_url, favicon_url, header_image_url, business_name, tagline, abn, phone, website, instagram_url, facebook_url, show_contact_on_documents.
- **Typography**: font_heading, font_body, font_weight, font_body_weight, heading_size, body_size, heading_case, body_case, heading_letter_spacing, body_line_height.
- **Layout & UI**: button_variant, button_size, button_radius, corner_radius, section_spacing, doc_padding, density, proposal_labels, theme_preset.

------------------------------------------------------------------------

# Lock Model

Required blocks cannot be deleted. Determined by surface:
- Invoice requires: Title, LineItems, Totals
- Contract requires: Title, ContractBody
- All other surfaces: no required blocks

`isDeletable(block, surface)` in `lib/branding/policy.ts` returns false for required blocks. Locked blocks show a "Required" chip in the editor toolbar.

------------------------------------------------------------------------

# Templates

18 functional templates: `<surface>-classic`, `<surface>-minimal`, `<surface>-bold` for each surface. Applying a template replaces only the current surface's block tree in one undoable step. Stored in `lib/branding/templates/<surface>.ts`.

------------------------------------------------------------------------

# Surface Enablement & Reset

`user_branding.enabled_surfaces` (text[]) tracks which surfaces the MC has customized. The editor's first-run wizard gates onboarding by this. A surface is **disabled** when its block tree is an empty array (`[]`); the `get_public_*` RPCs and email/PDF renderers check this and skip rendering (return null).

**Per-surface reset:** "Reset to template" button in the Documents panel replaces the current surface's tree with a fresh template.

------------------------------------------------------------------------

# Container Queries

Mobile responsive design via `@container` (not media queries). Block-level container queries gate the visibility and layout of nested elements, enabling responsive typography and spacing without viewport-level breaks. Editor canvas shows both desktop and mobile previews via a viewport-toggle.

------------------------------------------------------------------------

# Save / Load / Public Render Model

Three distinct paths with clear repair semantics:

1. **Save path** — MC edits form + block tree → `saveBrandingAction` → writes to `user_metadata` (logo_url, brand_color, fonts, etc.) + `user_branding.branding_blocks[surface]`. Autosave debounced 800ms after last edit + on blur.

2. **Load path** — Form initialized via `getBrandingDataAction` reading from both tables. Empty block trees load as `[]` (deliberately empty, surface disabled). Required blocks are enforced by the UI when applying templates or resetting.

3. **Public render path** — `get_public_quote`, `get_public_invoice`, `get_public_contract`, `get_public_proposal`, `get_vendor_timeline`, `get_public_questionnaire` RPCs merge `_user_branding(user_id)` + `_user_branding.branding_blocks[surface]`. If a surface's block tree is `[]` or null, the public renderer skips that tree and renders only fixed cores (e.g., invoice items, contract body). **Deliberately empty surface = disabled = null in public output.**

Reset semantics: clicking "Reset [Surface]" saves an explicit empty array `[]` to the block tree, not a null. This flags the surface as explicitly disabled by the MC, distinct from "never customized." The first-run wizard initially populates `enabled_surfaces` with defaults; subsequent resets track explicit user choices.

------------------------------------------------------------------------

# Settings Page UX

Live brand editor  -  preview-first, click-to-edit, theme-aware. **No modals.** Form left (advanced fields only), live preview right (always visible).

```
┌────────────────────┬─────────────────────────────────────┐
│ Theme  [Minimal ▾] │ [Quote][Invoice][Contract][Portal]  │
│                    │                          ◐ Desktop  │
│ Subdomain          │ ┌─────────────────────────────────┐ │
│ joe-mc.zebri.app ✓ │ │      [hover logo: Replace]       │ │
│                    │ │   Wedding MC Services            │ │
│ ABN _____________  │ │   ────────────────────────────   │ │
│                    │ │   Full Day MC      $2,500        │ │
│ Footer (280)       │ │   Total            $2,970        │ │
│ ┌────────────┐     │ │   ┌─[click: color picker]─┐      │ │
│ └────────────┘     │ │   │   Accept Quote        │      │ │
│ ☑ Show contact     │ │   └───────────────────────┘      │ │
│ Saved 2s ago ✓     │ └─────────────────────────────────┘ │
└────────────────────┴─────────────────────────────────────┘
```

**Five UX upgrades:**

1. **Live preview pane**  -  replaces the previous two thumbnail cards / modals. Always visible.
2. **Surface tabs**  -  Quote / Invoice / Contract / Portal. Switching tabs swaps the preview using shared form state.
3. **Device toggle** (Desktop / Mobile)  -  preview frame resizes to ~390 px wide for mobile.
4. **Inline edit hotspots** on the preview itself:
   - Hover the logo → "Replace logo" overlay → file picker
   - Click the tagline → contenteditable in place
   - Click any rendered CTA button → color picker popover anchored to button
   - Hover the header banner → "Replace banner" / "Remove"
5. **Auto-save**  -  debounced 800 ms after last change. Replaces the sticky save bar. Status reads `Saving…` → `Saved 2s ago ✓`. Errors revert + toast.

**Form column** holds advanced/structured fields with no obvious preview hotspot: theme picker, subdomain, ABN, footer text, "show contact" toggle.

**Two delight features:**

- **Logo color extraction**  -  on logo upload, `colorthief` extracts 3 dominant colors as suggested swatches below the color picker.
- **WCAG contrast badge**  -  next to the color picker: `AA on white ✓ / AA on black ✗`. Reuses contrast utility in `lib/branding/contrast.ts`.

------------------------------------------------------------------------

# Storage

Bucket: `branding` (public Supabase Storage). RLS allows authenticated users to read/write their own files only.

Paths:
- `branding/{user_id}/logo`
- `branding/{user_id}/favicon`
- `branding/{user_id}/header`

Accepted formats: PNG, JPG, SVG. Max size: 2 MB (logo, header), 256 KB (favicon).

------------------------------------------------------------------------

# Public Page Rendering

All three public surfaces (quote, invoice, contract) consume branding via their respective RPCs (`get_public_quote`, `get_public_invoice`, `get_public_contract`). Phase 2 changes those RPCs to join `public.branding_settings` instead of reading `auth.users.raw_user_meta_data`.

Each surface's `<head>` exports a `metadata` object that resolves favicon to `favicon_url`.

------------------------------------------------------------------------

# Subdomain Behaviour

Without a slug, public links work exactly as today. With a slug:

| Without slug | With slug |
|---|---|
| `zebri.app/quote/[token]` | `joe-mc.zebri.app/quote/[token]` |
| `zebri.app/invoice/[token]` | `joe-mc.zebri.app/invoice/[token]` |
| `zebri.app/contract/[token]` | `joe-mc.zebri.app/contract/[token]` |

Rules:

- Slug optional. Without one, links work as today.
- Unique (DB unique index), lowercase, `[a-z0-9-]{3,32}`.
- Reserved list rejected (`app`, `www`, `api`, `admin`, `docs`, `mail`, `staging`, `dev`).
- Public RPCs accept an optional `expected_slug`. If passed, the document's owner's slug must match  -  otherwise 404. Prevents `joe-mc.zebri.app/quote/<bob's-token>` from leaking under Joe's brand.
- Custom domains (`docs.joemc.com.au`) are out of scope this phase. Data model leaves room for `custom_domain` later.
- Vercel: needs wildcard `*.zebri.app` configured (Pro plan).
- Local dev: `joe-mc.localhost:3000` resolves automatically without `/etc/hosts` edits.

Routing: `middleware.ts` reads `host`, strips `.zebri.app`, and rewrites the URL to a slug-aware path tree (`app/_subdomain/[slug]/{quote,invoice,contract}/[token]`). The slug is forwarded to the RPC.

------------------------------------------------------------------------

# Future Work

- **Email branding**  -  logo + brand color in transactional emails (quote/invoice/contract sent). Requires Resend template system.
- **Custom domains**  -  `docs.joemc.com.au` with auto-SSL.
- **Per-couple brand overrides**  -  premium couples get bespoke styling.
- **PDF export branding**  -  carry through to downloaded PDFs.
- **OG share images**  -  auto-generated per surface with brand chrome.
- **Brand audit log**  -  who-changed-what with rollback.

------------------------------------------------------------------------

# Verification

**Phase 1** (settings UX overhaul, no schema changes)

1. Settings → Branding shows preview pane on the right, no modals.
2. Surface tabs (Quote / Invoice / Contract / Portal) all render with current state.
3. Device toggle resizes the preview frame.
4. Hover the logo on the preview → "Replace logo" overlay → upload works.
5. Click tagline → inline edit → blur saves to state.
6. Click brand-color CTA in preview → color picker popover; drag updates immediately.
7. Apply each of 5 theme presets → preview updates → edit any field → preset chip becomes "Custom".
8. Edit any field → "Saving…" → "Saved 2s ago ✓".
9. Upload logo → 3 suggested colors appear as swatches.
10. Color picker shows WCAG badge that flips when contrast drops.
11. No regressions on `/quote/[token]`, `/invoice/[token]`, `/contract/[token]`.
12. Mobile (Pixel 5 / iPhone 12)  -  preview pane stacks below form.

**Phase 2** (schema + new fields)

1. `branding_settings` table exists; backfill inserts existing auth-metadata rows.
2. Public pages consume the new table.
3. Header image renders at top of all 3 public surfaces.
4. Selected font pair renders on public surfaces.
5. Favicon shows in browser tab on public pages.
6. Footer text renders on all 3 public surfaces.
7. All 5 theme presets produce visibly distinct public pages.

**Phase 3** (subdomain)

1. Local: `joe-mc.localhost:3000/quote/<token>` works for joe-mc, 404s for another user's token.
2. Slug uniqueness enforced (DB + UI).
3. Reserved slugs rejected (`admin`, `www`, etc.).
4. No-slug user's links unchanged.
5. Vercel `*.zebri.app` configured before deploy.

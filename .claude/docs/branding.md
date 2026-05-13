# Zebri Custom Branding

MCs customise how every public-facing surface looks to couples. Branding is one of the most visible product surfaces  -  every quote, invoice, contract, and (later) couple-portal a couple ever sees is a brand impression.

**Branded surfaces:**

| Surface | Path | Status |
|---|---|---|
| Quote | `/quote/[token]` | shipped |
| Invoice | `/invoice/[token]` | shipped |
| Contract | `/contract/[token]` | shipped |
| Couple Portal | (TBD) | preview-stub |
| Transactional email | (Resend) | future |

------------------------------------------------------------------------

# Branding Fields

Currently stored in Supabase Auth `user_metadata` (`logo_url`, `brand_color`, `tagline`, `abn`, `show_contact_on_documents`). Phase 2 of the redesign moves all branding to a dedicated `public.branding_settings` table to support uniqueness on `subdomain_slug` and easier joins from public RPCs.

| Field | Type | Default | Description | Phase |
|---|---|---|---|---|
| `logo_url` | text → Storage `branding/{user_id}/logo` | null | MC's primary logo (max 2 MB; PNG/JPG/SVG). | 1 |
| `favicon_url` | text → Storage `branding/{user_id}/favicon` | null | Browser-tab icon for public pages (32×32 PNG/ICO/SVG). | 2 |
| `header_image_url` | text → Storage `branding/{user_id}/header` | null | Optional decorative banner at top of public surfaces. | 2 |
| `brand_color` | text (hex) | `#A7F3D0` | Accent color for buttons, header bands, and highlights. | 1 |
| `tagline` | text, ≤ 80 chars | null | Short business tagline below logo. | 1 |
| `footer_text` | text, ≤ 280 chars | null | Free-form footer (terms, address, signature line). Renders on quote, invoice, contract. | 2 |
| `abn` | text, 11 digits | null | Australian Business Number on invoice header. | 1 |
| `show_contact_on_documents` | boolean | false | Show phone, website, social links on public surfaces. | 1 |
| `font_heading` | enum (registry) | `inter` | Heading font from curated registry. | 2 |
| `font_body` | enum (registry) | `inter` | Body font from curated registry. | 2 |
| `theme_preset` | enum: `minimal\|bold\|elegant\|modern\|classic\|custom` | `custom` | Currently-applied preset. Becomes `custom` after any field edit. | 2 |
| `subdomain_slug` | text, unique, `[a-z0-9-]{3,32}` | null | Optional white-label URL: `<slug>.zebri.app`. | 3 |

------------------------------------------------------------------------

# Theme Presets

Five starter themes  -  TypeScript const in `lib/branding/themes.ts`. Applying a preset overwrites `brand_color`, `font_heading`, `font_body`. After any subsequent field edit, `theme_preset` becomes `custom`.

| Preset | Color | Heading | Body | Vibe |
|---|---|---|---|---|
| Minimal | `#000000` | Inter | Inter | Default. Editorial. |
| Bold | `#FF6B35` | Space Grotesk | Inter | Confident, modern. |
| Elegant | `#0F172A` | Playfair Display | Inter | Refined, traditional. |
| Modern | `#A7F3D0` | DM Serif Display | DM Sans | Soft, current Zebri default. |
| Classic | `#7C2D12` | Cormorant Garamond | Inter | Heritage. |

------------------------------------------------------------------------

# Font Registry

Avoids the Google Fonts paradox of choice. Exported from `lib/branding/fonts.ts`:

```ts
export const HEADING_FONTS = ['inter','playfair','dm_serif','space_grotesk','cormorant'] as const
export const BODY_FONTS = ['inter','dm_sans'] as const
```

Loaded via `next/font/google` in `lib/branding/load-fonts.ts`. Public pages and the settings preview share the loader.

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

# Zebri Custom Branding

MCs can customise how their public quote and invoice links look, so couples see the MC's brand rather than a generic layout.

Applies to: `/quote/[token]` and `/invoice/[token]` public pages.

------------------------------------------------------------------------

# Branding Fields

Stored in Supabase Auth `user_metadata` alongside existing profile fields (`business_name`, `phone`, `website`, etc.).

| Field | Type | Default | Description |
|---|---|---|---|
| `logo_url` | text | null | Supabase Storage URL for MC's logo |
| `brand_color` | text | `#A7F3D0` | Hex accent color for buttons and highlights |
| `tagline` | text | null | Short business tagline, max 80 chars |
| `abn` | text | null | Australian Business Number (shown on invoice header) |
| `show_contact_on_documents` | boolean | false | Show phone, website, social links on public pages |

------------------------------------------------------------------------

# Logo Storage

- **Bucket:** `branding` (public Supabase Storage bucket)
- **Path:** `{user_id}/logo`
- **Accepted formats:** PNG, JPG, SVG
- **Max size:** 2MB
- **Display size:** `max-h-12` on public pages (48px)
- Logo is displayed instead of the `business_name` text header when `logo_url` is set. If both are present, show logo only.

------------------------------------------------------------------------

# Settings UI — Branding Tab

**Location:** `/app/(dashboard)/settings/` — new tab "Branding", positioned after "Personal Info".

**Component:** `branding-section.tsx` co-located in `/app/(dashboard)/settings/`.

**Contents:**

1. **Logo** — click-to-upload or drag-and-drop input; preview shown inline once uploaded; "Remove" link clears `logo_url`. Upload to Supabase Storage bucket `branding/{user_id}/logo`, then save the public URL.

2. **Brand color** — color swatch input (`<input type="color">`) plus a hex text input side-by-side; shows a small preview chip of the selected color. Defaults to `#A7F3D0`.

3. **Tagline** — single-line text input, 80 char max, placeholder: "Creating unforgettable moments". Shown on public pages below the logo/name.

4. **ABN** — text input, 11 chars. Displayed in the invoice header below the business name (Australian context).

5. **Show contact info on documents** — green toggle (same style as invoice toggles). When on: phone, website, Instagram, and Facebook links appear in a footer on public quote and invoice pages. Values are pulled from the existing Personal Info fields.

**Save:** Single "Save branding" button at the bottom. Calls `supabase.auth.updateUser({ data: { logo_url, brand_color, tagline, show_contact_on_documents } })`. Follow the pattern in `personal-info-section.tsx`.

------------------------------------------------------------------------

# Public Page Changes

## Header (both Quote and Invoice pages)

```
if logo_url:
  <img src={logo_url} alt={business_name} class="max-h-12 object-contain mb-1" />
else:
  <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{business_name}</p>

if tagline:
  <p class="text-xs text-gray-400 mt-0.5">{tagline}</p>
```

## Invoice Header

When displaying an invoice, include the ABN below the business name if set:

```
<p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
  {business_name}
  {abn && <span class="block text-gray-500 normal-case">ABN {abn}</span>}
</p>
```

## Accent Color

Replace hard-coded button colors with `brand_color`. Apply as inline style on the primary CTA:

- **Quote page:** "Accept Quote" button → `style={{ backgroundColor: brand_color }}`
- **Invoice page:** "Pay with card" button → same

Fallback to `#A7F3D0` when `brand_color` is null/empty.

## Contact Footer (conditional)

Render when `show_contact_on_documents === true`. Place at the bottom of the public page, above any legal copy.

```
<div class="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
  {phone && <span>{phone}</span>}
  {website && <a href={website}>{website}</a>}
  {instagram_url && <a href={instagram_url}>Instagram</a>}
  {facebook_url && <a href={facebook_url}>Facebook</a>}
</div>
```

------------------------------------------------------------------------

# RPC Updates

Both `get_public_quote(token uuid)` and `get_public_invoice(token uuid)` must include branding fields in their JSONB return.

Add to the `SELECT` in each function (joining on `auth.users u WHERE u.id = [quote/invoice].user_id`):

```sql
'logo_url',              u.raw_user_meta_data->>'logo_url',
'brand_color',           COALESCE(u.raw_user_meta_data->>'brand_color', '#A7F3D0'),
'tagline',               u.raw_user_meta_data->>'tagline',
'abn',                   u.raw_user_meta_data->>'abn',
'show_contact_on_documents', (u.raw_user_meta_data->>'show_contact_on_documents')::boolean,
'phone',                 u.raw_user_meta_data->>'phone',
'website',               u.raw_user_meta_data->>'website',
'instagram_url',         u.raw_user_meta_data->>'instagram_url',
'facebook_url',          u.raw_user_meta_data->>'facebook_url'
```

These fields already exist on `user_metadata` (some already returned for `business_name`) — this extends that pattern.

Migrations to update: both RPCs live in
- `/supabase/migrations/20260329000000_add_quotes_feature.sql`
- `/supabase/migrations/20260329000001_add_invoicing_feature.sql`

Write new migration files (don't edit old ones) that use `CREATE OR REPLACE FUNCTION`.

------------------------------------------------------------------------

# Future Work

- **PDF export** — branding (logo, color, ABN) should carry through to downloaded PDFs
- **OG meta tags** — quote/invoice share links should show MC's business name (and optionally logo) in chat previews
- **"Powered by Zebri" footer** — currently shown on all public pages; consider whitelist or attribution toggle

# Verification

1. Settings → Branding: upload a logo, set `brand_color` to a custom hex, add a tagline, enter ABN, enable contact toggle.
2. Open a quote share link → logo appears, accent button uses brand color, tagline visible, contact footer present.
3. Open an invoice share link → same, plus ABN displayed in header below business name.
4. Remove logo → business name text fallback renders.
5. Leave `brand_color` blank → mint green `#A7F3D0` used by default.
6. Disable contact toggle → footer hidden.
7. Clear ABN → no ABN shown on invoice.

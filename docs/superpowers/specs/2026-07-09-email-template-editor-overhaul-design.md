# Email template editor overhaul

**Date:** 2026-07-09
**Status:** Approved in principle, spec under review
**Ships as:** one PR (per user decision), through `staging`.

## Goal

Make the email template editor accurate, brandable, and genuinely
useful for MCs and celebrants. The preview must be exactly what the
couple receives (this codebase's "preview equals send" invariant), and
authoring should feel closer to Notion.

## The invariant that governs everything

`app/(dashboard)/templates/template-preview.tsx` renders through the
same `renderEmailTemplate` / `renderEmailSubject` the send route uses.
Any change to how an email *looks* (branding, the shell, headings) must
be applied to **both** the preview and the real send
(`lib/email/html.ts` `wrapTemplateHtml` + `app/api/email/send-template`),
never the preview alone. Where this spec brands the preview, it brands
the outgoing email in the same shared code.

---

## Part A — Editor & preview polish (items 3-7 + extras)

### A1. Headings show in the preview (and editor)

**Cause:** Tailwind's preflight resets `<h1>/<h2>` to inherit size and
weight, so headings render identical to body text in both the preview
pane and the ProseMirror editor.

**Fix:** Add heading styles to (a) the preview container in
`template-preview.tsx` and the shared `.email-preview` styling, and
(b) the editor content area in `components/ui/rich-text-editor.tsx`.
`<h1>` ~ `text-xl font-semibold`, `<h2>` ~ `text-lg font-semibold`,
with sensible top/bottom margins. Also inline equivalent styles in the
sent email shell so headings survive in the inbox.

### A2. Remove the blockquote ("comma") button

Remove the blockquote `ToolbarButton` (the lucide `Quote` icon) from
`rich-text-editor.tsx`. The editor is shared with Contracts; per the
discussion we remove it everywhere (blockquote stays in StarterKit for
paste-in safety, but there's no toolbar affordance). No other toolbar
change here.

### A3. Every variable previews as sample data (no amber boxes)

**Cause:** `buildSampleContext` in `lib/email/template-variables.ts`
populates every namespace **except** `questionnaire.link` and
`questionnaire.title`, so those two resolve to empty and render as amber
"missing" chips.

**Fix:** Add `questionnaire_id`, `share_token`, and
`questionnaire_title` to the sample trigger payload so both resolve.
After this, in the library editor (sample context) every catalogue
variable resolves and the amber highlight never appears — which is
correct there, since there is no real couple to have gaps against.

### A4. Signature previews the MC's real saved signature

**Cause:** `buildSampleContext` injects a static placeholder signature.

**Fix:** The real signature is `user_metadata.email_signature` (rich
TipTap JSON). `app/(dashboard)/templates/page.tsx` already reads
user_metadata server-side; extend it to pass `emailSignature` down
through `TemplatesClient` → `EmailsTab` → `TemplateEditorModal` →
`buildSampleContext`, which uses it for `ctx.mc.signature` (falling back
to the current placeholder only when the MC hasn't set one).

### A5. Full branding on the preview *and* the sent email

**Data source:** all branding lives in `user_metadata` (assembled with
defaults by the `_user_branding` RPC and, client-side, by
`buildPublicBranding` in `lib/branding/use-current-branding.ts`):
`brand_color`, `accent_color`, `logo_url`, `font_heading`, `font_body`,
weights, `corner_radius`, etc. `lib/branding/fonts.ts` gives
`FONT_STACKS` (each with a web-safe fallback) and `googleFontsHref`.

**Change:** Introduce a branded email shell that both surfaces use.

- New `wrapTemplateHtml(bodyHtml, branding)` (extend the existing
  signature; keep `mcBusinessName` inside `branding`). It renders:
  - a header with the MC's `logo_url` (falls back to the business name
    as text when no logo),
  - `corner_radius` on the card,
  - `brand_color` / `accent_color` for links and any button accents,
  - `font-family` from the MC's `font_heading` / `font_body` stacks,
    inlined on the relevant elements, plus a Google Fonts `<link>` in
    the head via `googleFontsHref`. Caveat accepted by the user: Gmail
    and Outlook ignore web fonts and fall back to the stack's safe font;
    Apple Mail / iOS honour it.
  - the existing "Sent by {business} via Zebri" footer.
- `page.tsx` passes the assembled branding object down to the editor
  (reuse `buildPublicBranding(metadata)` so the email uses the same
  branding the public surfaces do).

### A6. Full-shell WYSIWYG preview

Today the preview pane shows only the rendered body. Make it show the
**finished email**: render `wrapTemplateHtml(bodyHtml, branding)` into
an `<iframe srcDoc={...}>` in the preview pane so the card, logo, fonts,
brand colours, and footer all appear exactly as the inbox will show
them. The iframe isolates the email's table/inline styles from the app's
CSS (and lets the Google Font `<link>` load in-frame). Keep the
subject line rendered above the iframe as now.

### A7. Link button

Add a hyperlink button to the toolbar (`@tiptap/extension-link`, add to
the `RichTextEditor` extensions and `SANITIZE_OPTS` already allow `a`).
Select text → click Link → enter URL → wraps the selection in an `<a>`.
Clicking with no selection inserts a linked label. Links render in
`brand_color` in preview + send (A5). Available in the shared editor, so
Contracts get it too (harmless, useful).

### A8. Inline variable insertion (`{{` trigger)

Add a suggestion trigger so typing `{{` in the body opens the same
variable list inline (Notion-style), inserting the chosen mention. Reuse
the existing `variables` list; implement via TipTap's suggestion utility
on a lightweight second trigger, leaving the existing "Insert variable"
popover in place as the discoverable path. This is the heaviest extra;
if it risks the PR it can be the last thing wired.

### A9. Test send to yourself

The send route already supports `test: true` but needs a `coupleId`. Add
a dedicated path for the **template editor**, which has no couple and may
be unsaved:

- New server action `sendTestTemplateEmail({ subject, content })` that
  builds the **sample context** (same as the preview), renders subject +
  body in `send` mode, wraps in the branded shell, and sends to the
  **authenticated user's own email only** (recipient is read from the
  session, never client-supplied — this prevents the endpoint being used
  as a relay). Subject prefixed `[Test]`. No `couple_emails` logging.
- Rate-limited (money/public class per `lib/api/rate-limit`), Zod-
  validated input, no service-role key.
- A "Send test to myself" button in the editor footer.

### A10. Attachments in the editor

Infrastructure exists (`email_template_files.template_id`, the
`email-template-files` bucket, `downloadStaticAttachments`, and the
route's `attachmentFileIds`). Missing: editor UI + default-include.

- Editor gains an **Attachments** section: upload (validate size ≤ 25 MB
  and mime type, scope storage path to `{user_id}/{template_id}/{fileId}`),
  list current files, remove. Writes `email_template_files` rows with
  `template_id`. Requires the template to be saved first (so a
  `template_id` exists); for a brand-new unsaved template, prompt to save
  before attaching, or attach after the first save.
- At send time, the couple send flow auto-includes the template's
  attachment file ids by default (MC can still deselect). The route
  already accepts them.
- Server action for upload/delete: Zod, RLS-owned, no service-role key.

---

## Part B — Custom categories (item 1 + 2), Notion-style

Replace the fixed `lifecycle_stage` enum with per-user categories the MC
can create, rename, delete, colour, and reorder. Rename the field label
from "Lifecycle stage" to **"Category"** throughout.

### B1. Schema (migration, via CI `supabase db push`)

New table `email_template_categories`:

| column | type | notes |
|--------|------|-------|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid not null | FK `auth.users(id)` on delete cascade |
| `name` | text not null | |
| `color` | text not null | one of a fixed key set (B3), default `'slate'` |
| `position` | int not null default 0 | drag order |
| `created_at` / `updated_at` | timestamptz | |

- RLS: `auth.uid() = user_id` for select/insert/update/delete.
- Index on `user_id`; FK indexed.

`email_templates`:
- Add `category_id uuid null references email_template_categories(id) on
  delete set null`, indexed.
- **Keep** `lifecycle_stage` (do not drop — non-destructive, avoids
  breaking any legacy reader such as automation trigger suggestions). It
  becomes legacy; the new UI reads/writes `category_id`. Note the
  deprecation in `database-schema.md`.

**Backfill in the migration:**
1. For every user who owns any `email_templates` row, seed the six
   current stages as categories (names = existing `LIFECYCLE_LABELS`,
   positions 0-5, sensible default colours).
2. Set each template's `category_id` by matching its `lifecycle_stage`
   to that user's seeded category.

### B2. Seeding for new users

Migration only covers existing users. For new users, seed the six
defaults **lazily** the first time they load categories, guarded by a
`user_metadata.email_categories_initialized` flag so deleting all
categories never re-seeds. (Metadata flag, not `app_metadata` — this is
not a trust/entitlement field.)

### B3. Colours

A fixed palette of ~8 named keys (`slate`, `rose`, `amber`, `emerald`,
`sky`, `violet`, `pink`, `stone`), each mapping to chip + dot Tailwind
classes built from the **named** palette (e.g. `bg-rose-100
text-rose-700`), not arbitrary `bg-[#…]` values — so the
`zebri/no-off-token-color` lint stays clean. Stored as the key string.

### B4. UI

- **Editor:** replace the fixed stage `Select` with a category control
  that lists the user's categories (colour dot + name), plus inline
  "Create category" (name + colour), so a new category can be made
  without leaving the modal — the Notion pattern.
- **A management surface** for rename / recolour / delete / drag-reorder.
  Simplest home: a small "Manage categories" affordance from the same
  control (a popover or lightweight modal) rather than a new page.
- **Library grouping** (`templates-library.tsx`) and the preview
  **StageChip** switch from `LIFECYCLE_STAGES` / `LIFECYCLE_LABELS` to
  the user's categories, ordered by `position`, with the colour chip.
  Untagged templates fall into a trailing "Uncategorised" group.

### B5. Types & data

- New `types/email-template.ts` `EmailTemplateCategory` type; keep
  `LIFECYCLE_*` exports for the legacy column + backfill only.
- `EmailTemplate` gains `category_id: string | null`.
- New query hooks in `use-templates.ts` (or a sibling) for category
  CRUD + reorder, with React Query cache invalidation.
- Category CRUD server actions: Zod, RLS-owned, no service-role key.

---

## Security checklist (new surfaces)

- `email_template_categories`: RLS on all four verbs; integration test
  proving cross-tenant denial (tick the matrix in `security.md`).
- Category CRUD + attachment upload/delete actions: Zod-validated,
  ownership via RLS, no service-role key in any `'use client'` file.
- `sendTestTemplateEmail`: rate-limited (money/public class), recipient
  is the **session user's** email only (never client-supplied), Zod on
  input.
- Attachment upload: enforce size (≤ 25 MB) and mime allowlist; storage
  path scoped to the owner.

## Docs to update in this PR

`database-schema.md` (new table + `category_id`, `lifecycle_stage`
deprecation), `page-specs.md` (Templates editor behaviour), `security.md`
(new RLS rows + test-send + upload), `component-library.md` (link button,
inline variable trigger, category control), `frontend-design.md` if the
category colour palette is documented there.

## Testing (Definition of Done)

- Unit: `buildSampleContext` resolves every catalogue variable (A3);
  branded shell builder output (A5); category colour mapping (B3).
- Integration (local Supabase, real RLS): category CRUD + cross-tenant
  denial; template `category_id` set/clear; attachment row ownership.
- E2E (Pixel 5 + iPhone 12 + desktop): create a category inline, tag a
  template, see it grouped + coloured; headings render in preview; link
  button; test-send button; attach a file.

## Suggested internal build order (still one PR)

1. Small correctness fixes: A1, A2, A3 (fast, visible).
2. Real data: A4 signature, A5 branding shell + A6 iframe preview.
3. Editor power: A7 link, A9 test-send, A10 attachments, A8 inline insert.
4. Categories (Part B) with its migration.
5. Docs + tests, ratchet the lint/strict gates.

## Out of scope

- Per-client custom fonts beyond the existing `FONT_STACKS` set.
- Reworking the automation trigger-suggestion logic that reads the
  legacy `lifecycle_stage` (left intact).
- Plain-text email fallback bodies.

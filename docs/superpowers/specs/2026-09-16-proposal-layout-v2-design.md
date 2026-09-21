# Proposal Layout v2: a Qwilr-style proposal editor as a standalone feature

**Status:** approved 2026-09-16. Phase 1 plan: `docs/superpowers/plans/2026-09-16-proposal-layout-v2-phase1-foundation.md`.
**Supersedes:** the block model in `2026-09-12-proposals-engine-design.md` §7 (the ten
proposal block types, the hero/intro-note markers, `sectionBackground`). The
commerce, close-flow, engagement and email parts of that spec stand.
**Owner:** Arjun. **Build:** staging-only until every phase lands.

## 0. Why

The per-block proposal editor shipped in Phase B/C is inflexible: each block is a
fixed composition (hero with a height preset, intro note with one heading, about
me with one portrait side) and each carries a bespoke popover. Two polish passes
(hero, personal note) confirmed that polishing blocks does not fix the model.
The MC needs a proposal that "looks like whatever they want it to look".

Qwilr gets that freedom without a free canvas: a page is a stack of full-width
sections, each with rich style settings, and the text section is a real
document editor that can hold images, buttons, embeds and columns. That is the
model here.

Proposals also become a **standalone feature module** with its own tab
(templates, builder, analytics, settings), not a surface inside Branding. This
is the first "lego brick" of the composable-features direction and sets the
shape for every feature after it.

## 1. Locked decisions

| # | Decision |
|---|---|
| D1 | Layout model: **section stack** (full-width sections, vertical order). No grid, no free canvas. Side-by-side content is a `columns` node inside rich text. |
| D2 | Every content section is **one TipTap document** ("rich doc"); there is no block list between section and node. |
| D3 | Section kinds: `content` plus six data kinds: `packages`, `gallery`, `video`, `testimonials`, `faq`, `accept`. Nothing else. |
| D4 | The old fixed blocks (`hero`, `introNote`, `aboutMe`, `howItWorks`, plus general chrome) become **presets**: content sections with prefilled style and text. |
| D5 | **Full per-proposal editing**: creating a proposal copies a template's layout into `proposals.layout`; the builder opens the same editor on that copy. No two-way sync with the template. |
| D6 | **Multiple named templates** in `proposal_templates`; one is the default. |
| D7 | Proposals are a **standalone feature** at `/proposals` (Proposals, Templates, Analytics, Settings) with one sidebar entry. Branding keeps the brand kit only; its Proposal surface tab is removed. |
| D8 | Code lives in `features/proposals/` behind an `index.ts` public API, enforced by lint. Shared editor chrome lives in `components/editor/`. |
| D9 | Mobile: **auto-stack** plus a per-section `hideOnMobile`. No separate mobile layout. |
| D10 | Toolbars: **three contextual bars** (section, text, node), single 32px row each, no captions, no right-hand drawer. |
| D11 | Other branding surfaces keep their block trees; their toolbar is rebuilt on the same three-bar primitives in the final phase. |
| D12 | In scope from the Qwilr gap list: generic embeds (allowlist), audio node, add-on quantities + live totals, Footer preset, section navigation, page settings (password, PDF download, link preview), wider font library. **Out:** saved-section library, collaboration comments, recurring pricing, custom domains. |
| D13 | Migration is automatic and one-way, with a 30-day backup of the v1 tree. |
| D14 | Feature flag `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2` gates the editor on staging; the public page renders v2 whenever a layout exists. |

## 2. Data model

### 2.1 Layout

```ts
interface ProposalLayout {
  version: 2
  sections: Section[]
  page?: PageSettings            // per-template / per-proposal overrides of account defaults
}

type SectionKind = 'content' | 'packages' | 'gallery' | 'video' | 'testimonials' | 'faq' | 'accept'

interface Section {
  id: string                     // nanoid, regenerated on copy
  kind: SectionKind
  name?: string                  // shown in the section bar + section nav; auto from first heading when absent
  style: SectionStyle
  hideOnMobile?: boolean
  intro?: RichDoc                // data kinds only: heading + line above the data
  content?: RichDoc              // kind 'content' only
  data?: SectionData             // data kinds only (see 2.4)
}

interface SectionStyle {
  background?: {
    color?: string
    image?: string               // storage URL
    video?: string               // storage URL, autoplay muted loop
    overlay?: number             // 0-100 black over image/video
  }
  height: 'fit' | 'full'         // full = 100svh on the page
  contentWidth: 'narrow' | 'medium' | 'wide' | number   // 560 / 720 / 1100 px (the doc-narrow / doc-prose / doc-page tokens), or a dragged px value
  padding: 'compact' | 'cozy' | 'roomy' | number        // density stops, or a dragged px value
  textColor?: string             // one override for every text node in the section
  align?: 'left' | 'center'      // default text alignment for the section
}

interface PageSettings {
  password?: string | null       // hashed at rest; null = off
  allowDownload?: boolean        // default true
  linkPreview?: { title?: string; imageUrl?: string }
  sectionNav?: boolean           // default false
  expiryDays?: number
  depositPercent?: number
}
```

Limits (enforced by the Zod schema): 40 sections, 200 nodes per rich doc, 25 MB
of media referenced per layout, 2 MB serialised.

### 2.2 Rich doc

TipTap JSON, normalised with `toPlainJSON` before any server action (the
null-prototype attrs gotcha). One node/mark spec drives the editor schema, the
HTML renderer and the Zod validator, so a node cannot exist in one and not the
others.

**Nodes**

| Node | Attrs | Notes |
|---|---|---|
| `heading` | `level 1-3` | Defaults from brand roles: docTitle / sectionHeading / subheading. Fluid `clamp()` sizes on the page. |
| `paragraph` | | |
| `bulletList`, `orderedList`, `listItem` | | |
| `blockquote` | | Testimonial-style pull quote inside text. |
| `table`, `tableRow`, `tableCell`, `tableHeader` | | Horizontal scroll container on phones. |
| `horizontalRule` | | The divider. |
| `hardBreak` | | |
| `image` | `src, alt, caption, layout: inline \| left \| right \| full, widthPct 20-100` | Corner handles resize proportionally; side handles set `widthPct`. Floats become full-width on phones. |
| `button` | `label, action: { kind: 'link', href } \| { kind: 'accept' } \| { kind: 'decline' } \| { kind: 'jump', sectionId }, variant: fill \| outline, size: sm \| md \| lg, color?, radius?, align` | Defaults from the brand button style. |
| `embed` | `provider, url` | Allowlist: YouTube, Vimeo, Spotify, Google Maps, Instagram, Zebri Scheduler. Rendered as a sandboxed iframe; unknown hosts rejected at save. |
| `audio` | `src, title, durationSec` | Upload MP3 / M4A / WAV (25 MB). Inline player from `components/ui/audio-play-button`. |
| `columns`, `column` | `count 2 \| 3`, per-column `ratio` | Drag the gutter; snaps at 1/2 and 1/3. Stack on phones. Not nestable. |
| `spacer` | `heightPx 8-160` | Drag the bottom edge. |
| `variable` | `id` | `couple_name`, `partner_a`, `partner_b`, `wedding_date`, `venue`, `expiry_date`, `business_name`, `phone`, `abn`, `email`, `website`. Chips in the editor; resolved server-side on the page. |

**Marks:** `bold`, `italic`, `underline`, `strike`, `link`, `textStyle`
(`color`, `fontSize`, `fontFamily`), `highlight`, `textCase`
(sentence / capitalize / upper / lower).

**Enter behaviour:** document semantics everywhere (Enter = new paragraph,
Shift+Enter = line break). Headings do not blur on Enter.

### 2.3 Templates and proposals

```sql
create table proposal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  layout jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: auth.uid() = user_id for all four verbs. Partial unique index on (user_id) where is_default.

alter table proposals add column layout jsonb;          -- null until migrated / created under v2
alter table proposals add column template_id uuid references proposal_templates(id) on delete set null;
alter table user_branding add column blocks_proposal_v1_backup jsonb;  -- 30-day backup, swept by cron

create table proposal_settings (                       -- account defaults for PageSettings
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_enabled boolean not null default false,
  allow_download boolean not null default true,
  section_nav boolean not null default false,
  expiry_days integer not null default 14,
  deposit_percent integer not null default 30,
  link_preview jsonb,
  updated_at timestamptz not null default now()
);
-- RLS: auth.uid() = user_id. Per-proposal `layout.page` overrides these.
```

`intro_note` and `hero_override` on `proposals` remain through the backup window
and are dropped in phase 5 with an `@ALLOW_DESTRUCTIVE` marker.

### 2.4 Data section shapes

Carried over from v1 with additions in bold:

- `packages`: `layout: cards | list | table`, `showInclusions`, `highlightOptionId?`,
  **add-ons gain `quantity: { enabled, min, max, default }`**, **`showTotal`**
  (live total incl. deposit as the couple toggles add-ons). Options and add-ons
  themselves still come from the proposal (Details mode), not the layout.
- `gallery`: `images[]`, `layout: grid | masonry | carousel`, `columns 2-4`, `captions`.
- `video`: `source: upload | embed`, `caption`, `autoplay` (upload only).
- `testimonials`: `items[]`, `layout: cards | carousel | single`.
- `faq`: `items[]` (question, answer as rich doc), `style: accordion | list`.
- `accept`: `acceptLabel`, `declineEnabled`, `declineLabel`, `note` (rich doc), `showExpiry`.

## 3. Editor

### 3.1 Selection

Two levels only:

1. **Section**: click the gutter, the drag handle, or anywhere in a data section.
   Coloured outline around the section; section bar appears.
2. **Inside a content section**: caret in the rich doc. Selecting text shows the
   text bar; clicking an image / button / embed / audio / column / spacer selects
   that node and shows its node bar plus resize handles.

`Esc` steps out one level (node → text → section → none).

### 3.2 Adding

- A `+` line between sections on hover and an **Add section** button at the end
  open one palette with two tabs: **Sections** (Text, Packages, Gallery, Video,
  Testimonials, FAQ, Accept) and **Presets** (Hero, Note from me, About me, How
  it works, Pricing, Close, Footer).
- Inside text: `/` at the caret and the text bar's `+` list the same node items
  (heading, image, button, columns, embed, audio, divider, spacer, table,
  variable).

### 3.3 Moving

- Sections: drag handle in the left gutter (dnd-kit sortable, as today), or
  `⌥↑` / `⌥↓`.
- Nodes move as document content: cut/paste, or drag the node handle within the
  section; dragging past the section edge drops into the neighbour at the
  nearest paragraph boundary.

### 3.4 Resizing

Every handle uses one grip component, one readout pill, one snap tolerance.

| Target | Handle | Writes | Snaps |
|---|---|---|---|
| Section height | bottom-edge grip | `style.padding` (px), or toggles `height: full` when dragged past one screen | compact / cozy / roomy stops, full |
| Section width | side handles on the column outline | `style.contentWidth` (px) | narrow / medium / wide |
| Image | corners (proportional), sides (`widthPct`) | node attrs | 25 / 33 / 50 / 100 % |
| Columns | gutter drag | `ratio` | 1/2, 1/3 |
| Spacer | bottom edge | `heightPx` | 8 px steps |

The canvas is scaled with CSS `zoom`; drag maths uses layout-vs-screen height to
recover the factor (the hero grip's approach).

### 3.5 Keyboard

`⌘Z` / `⇧⌘Z` one history across section moves and text edits; `⌫` deletes an
empty selected section outright and confirms for a non-empty one; `⌘D`
duplicates a section; `⌘K` link; `⌘B/I/U`.

### 3.6 Mobile canvas

380 px canvas, same layout: columns stack, floats go full-width, `hideOnMobile`
sections render dimmed with an eye-off badge (never removed from the editor).

## 4. Toolbars and popovers

One 32 px row per bar, built only from `components/editor/` primitives
(`ActiveTargetLabel`, `Select size="xs"`, `NumberStepper`, `ColorPopover`,
`PillToggle`, `IncludeDropdown`, `ToolbarDivider`, `PositionControl`,
`ResizeGrip`, icon buttons with tooltip + `aria-label`). Overflow `⋯` when a bar
would not fit at 380 px. No captions above controls. Any control deeper than one
step opens a popover from that control, never a second row.

**Section bar** (bounded to the canvas scroll area, never over the page chrome):
`name` · Background (swatch → colour / image / video / overlay slider) · Width
(narrow / medium / wide) · Height (fit / full) · Padding (icon → slider) · Text
colour · Align · data kinds add `Layout ▾` and `Include ▾` · `⋯` (hide on
phone, duplicate, reset style, delete).

**Text bar** (TipTap bubble): Style `Heading 1 ▾` · font · size · weight ·
colour · B I U S · align · list · link · `+` insert · `Aa` case.

**Node bar**: image → layout (inline / left / right / full) · width % · caption
· alt · replace / remove; button → label · action · variant · size · colour ·
radius · align; embed → replace link · remove; audio → title · replace /
remove; columns → 2 / 3 · reset ratio; spacer → height.

Override dots: a control whose value differs from the brand rail shows a small
dot; `⋯ → Reset` clears the section back to the rail.

## 5. The Proposals feature

### 5.1 Navigation

Sidebar: one entry, **Proposals**. Inside `/proposals`, a segmented nav:

- **Proposals** (`/proposals`): the list plus an analytics strip (sent / opened
  / accepted this month, acceptance rate, median time-to-open, revenue
  accepted). Row → builder.
- **Templates** (`/proposals/templates`, `/proposals/templates/[id]`): list of
  named templates with default badge; the section editor. First run shows the
  role picker (MC / Celebrant / both) which seeds the first template from the
  presets.
- **Analytics** (`/proposals/analytics`): section-level engagement (time per
  section, drop-off, device split) for the account and per proposal, from the
  existing engagement tables.
- **Settings** (`/proposals/settings`): account defaults for `PageSettings`
  plus deposit % and expiry days.

### 5.2 Builder (`/proposals/[id]`)

Two modes in one shell:

- **Details**: couple · packages & add-ons (with quantity settings) · deposit /
  expiry / contract template · share & send · readiness. Note, cover and wording
  fields are removed; they are content.
- **Design**: the section editor on `proposals.layout`. Data sections show this
  proposal's real options; variables resolve to the couple's values (chips keep
  a hover showing the source). Every section shows a dot when it differs from
  the template; `⋯ → Reset to template` per section; header actions "Reset
  design to template" and "Save as template" (both confirm).

Lifecycle: create → copy default (or chosen) template with fresh ids; duplicate →
copy layout; send → freeze; accepted / declined / expired → read-only with a
banner. Autosave debounced into `proposals.layout`, one undo history per mode.

### 5.3 Module boundary

```
features/proposals/
  index.ts        the only import path for the rest of the app
  model/          types, Zod schema, migration, presets, sample data, variables
  editor/         section editor, bars, palette, resize engine, hooks
  render/         renderProposalLayout (page | edit | print), rich-doc HTML
  builder/        Details + Design workspace
  analytics/      queries + charts
  data/           Supabase access: templates, proposals, media, settings
  routes.ts
```

Rules (ESLint `no-restricted-imports`, added in phase 1):

- Nothing outside `features/proposals/` imports from inside it except via
  `index.ts`.
- The module imports `lib/`, `components/ui/`, `components/editor/`, `types/`
  only; never another feature and never `app/(dashboard)/branding`.
- `lib/proposals/*` moves in during phase 1 with re-exports left behind, deleted
  in phase 5.
- Feature gating per account: one flag in `app_metadata`, read through
  `lib/auth/entitlements`.

Shared editor chrome moves to `components/editor/`: `IncludeDropdown`,
`ToolbarDivider`, `PositionControl`, `ResizeGrip`, `ActiveTargetLabel`,
`PillToggle`, `NumberStepper`, the canvas frame and zoom widget. The Branding
editor and the proposal editor both consume them; neither imports the other.

## 6. Public render

`renderProposalLayout(layout, ctx)` with `mode: 'page' | 'edit' | 'print'`
renders every consumer (couple page, editor canvas, PDF) from one component set.

- Section: full-bleed `<section>` with background layers (colour → image →
  video → overlay), `min-height: 100svh` for `full`, centred column at
  `max-w-doc-narrow` (560) / `max-w-doc-prose` (720) / `max-w-doc-page` (1100), or a px width,
  vertical padding from the density scale, `color` from `textColor`,
  reveal-on-scroll except on the first section.
- Rich doc: one `renderRichDoc()` shared by page and print; headings from brand
  roles with `clamp()` sizes; images with `srcset`; embeds lazy in sandboxed
  iframes; buttons: `accept` scrolls to the Accept section, `decline` opens the
  decline flow, `jump` scrolls to a section; variables resolved server-side.
- Section nav (when on): slim sticky bar of section names.
- Password: server-side gate on `/proposal/[token]` with a rate-limited form.
- Mobile: columns stack under 640 px via a container query on the page root;
  floats go full-width; tables scroll; `hideOnMobile` sections are omitted from
  the HTML on phones.
- Print: no `full` heights (480 px opening), video → poster + link, no reveal,
  2 columns stay side by side, 3 stack, avoid page breaks inside cards.
- The public route ships none of the editor code.

## 7. Migration

`migrateProposalTreeToLayout(blocks: Block[]): ProposalLayout`, pure and unit
tested against one real v1 tree per role plus hand-made edge cases.

| v1 | v2 |
|---|---|
| `hero` | content section: `height: full`, background from `background`, `textColor: #FFF` when media, H1 (heading rich text) + paragraph (subheading), align from `textAlign` |
| `introNote` | content section `narrow`: H2 (heading) + paragraph with `{{ intro_note }}`; for proposals, the actual `intro_note` text is inlined |
| `aboutMe` | content section `medium`, 2 columns (image + text), side from `imageSide` |
| `howItWorks` | content section `wide`, 3 columns of H3 + paragraph |
| `text`, `image`, `divider`, `spacer`, `action` | nodes inside a content section (consecutive chrome blocks merge into one section) |
| `title`, `businessName`, `tagline` | text at the top of the first content section |
| `footer` | Footer preset with the footer's include flags |
| six data blocks | data sections, data carried over, `sectionBackground` → `style.background` |
| `sectionBackground` on any block | `style.background` |

Runs on first read of a v1 tree (template or proposal). The v1 tree is written to
`user_branding.blocks_proposal_v1_backup` and swept after 30 days by a cron.
Sent proposals keep their frozen snapshot, remapped through the same function.
`get_public_proposal` returns `layout` instead of `branding_blocks`.

## 8. Rollout

Flag `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2`. Staging only until all phases land.

1. **Foundation**: `features/proposals/` module + lint rule, `/proposals` nav
   shell, `proposal_templates` + `proposals.layout` migrations, Zod schema,
   node/mark spec, renderer (page / print), migration function, public page
   serving v2. Nothing editable yet. ≈ 3-4 days.
2. **Template editor**: section editor (content sections), three bars, palette +
   presets, resize engine, mobile canvas, `components/editor/` extraction.
   ≈ 5-7 days.
3. **Data sections + media**: six data sections, quantities + live totals,
   audio, generic embeds, Footer preset. ≈ 4-5 days.
4. **Builder**: Details + Design modes, per-proposal layout lifecycle, page
   settings, analytics strip, Settings tab. ≈ 4-5 days.
5. **Finish**: section nav, wider font library, Analytics tab, other-surface
   toolbar rebuild, remove Branding's Proposal tab, drop v1 types / columns /
   backup sweep, ratchet gates. ≈ 3-4 days.

Roughly 4-5 working weeks of agent time including review cycles; each phase is
a stopping point.

## 9. Testing

- **Unit**: node/mark spec ↔ editor ↔ renderer parity (every node renders in
  page, edit and print); migration fixtures; resize maths (zoom factor, snaps,
  clamps); bar targeting; variable resolution; Zod rejects oversize layouts,
  unknown nodes, disallowed embed hosts; pricing totals with quantities.
- **Integration** (local Supabase): RLS on `proposal_templates`,
  `proposals.layout`, `proposal_settings`; `get_public_proposal` serves v2 by
  token only; password gate; media sweep on delete; cross-tenant denial for
  every new table (tick `security.md`).
- **E2E** (desktop, Pixel 5, iPhone 12): create template from role picker, add
  a preset, drag a section, resize an image, insert columns, create a proposal
  from it, edit the note in Design mode, send, open as the couple (logged-out
  context), toggle an add-on quantity, accept and pay in Stripe test mode;
  mobile stacking and `hideOnMobile`; PDF download; password gate.
- Gates: `typecheck` 0, strict and lint gates ratchet down as v1 files go.

## 10. Security checklist (per `security.md`)

- Zod on every layout write; `toPlainJSON` before validation.
- Embed allowlist by host; iframes `sandbox="allow-scripts allow-same-origin"`,
  no `allow-top-navigation`.
- Rich-doc HTML rendered from JSON only (never stored HTML); links get
  `rel="noopener"`, `javascript:` rejected.
- Password hashed (bcrypt) at rest; public gate rate-limited via
  `lib/api/rate-limit`; token lookups constant-time as today.
- Media uploads: type + size checks server-side; keys scoped by user and
  proposal; RLS on storage.
- No service-role key in any `'use client'` file (CI gate).
- New entitlement flag read only through `lib/auth/entitlements`.

## 11. Docs to update in the same PRs

`page-specs.md` (Proposals feature), `frontend-design.md` (editor primitives,
tokens), `database-schema.md` (new tables/columns), `security.md` (RLS matrix,
password gate), `proposals.md` (rewrite for v2), `payments.md` (quantities +
totals), `testing.md` (selectors), `production-readiness.md` (roadmap), plus
`/design-system` entries for every `components/editor/` primitive.

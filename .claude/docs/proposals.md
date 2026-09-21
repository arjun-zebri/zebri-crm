# Proposals

Source-of-truth doc for the Proposals feature (Phase A, landed
2026-09-13; Phase B, the design surface, landed 2026-09-14). Read this
before touching anything under `lib/proposals/`,
`app/(dashboard)/proposals/`, `app/(dashboard)/branding/` (the
`proposal` surface), `app/proposal/[token]/`, `lib/branding/`, the
couple profile's Proposals tab, or
`components/builders/proposal-builder-modal.tsx`.

Spec: `docs/superpowers/specs/2026-09-12-proposals-engine-design.md`
(sections 5, 6, 13 cover Phase A in full detail; this file is the
one-screen summary).

## Layout v2 (Phase 1)

Spec: `docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md`.
Plan: `docs/superpowers/plans/2026-09-16-proposal-layout-v2-phase1-foundation.md`.
Branch `feature/proposal-layout-v2`, staging-only, behind
`NEXT_PUBLIC_PROPOSAL_LAYOUT_V2`. This section covers Phase 1
(foundation) only; the v1 block model described below (What a proposal
is, RPCs, RLS) stays live and unchanged until Phase 5.

A new feature module, `features/proposals/`, holds the v2 layout
model and renderer behind one public face, `features/proposals/index.ts`.
An ESLint `no-restricted-imports` rule in `eslint.config.mjs` ("Feature
boundary") enforces it: outside code may import only
`@/features/proposals`, never a path inside it.

- **`model/`** - `layout.ts` (`ProposalLayout` v2: `{ version: 2,
  sections, page? }`; section kinds `content | packages | gallery |
  video | testimonials | faq | accept`), `rich-doc-spec.ts` (21 node
  types, 8 marks, the embed host allowlist), `doc.ts` (rich-doc
  builders), `schema.ts` (Zod `proposalLayoutSchema` +
  `parseProposalLayout`), `variables.ts` (proposal merge variables),
  `migrate-v1.ts` (`migrateProposalTreeToLayout`, one-way; keeps text,
  media and data; see the migrate-v1.ts TSDoc for what is dropped),
  `presets.ts` (starter sections + `defaultTemplateLayout`).
- **`render/`** - `rich-doc.tsx` (`RichDocView`), `embed-src.ts`,
  `text-roles.ts`, `section-style.ts`, `data-section.tsx` (the Phase 1
  adapter: renders the six data-driven section kinds through the
  existing v1 `lib/branding/public-blocks/proposal/*` components until
  Phase 3 gives them native v2 shapes), `section.tsx`, `layout.tsx`
  (`ProposalLayoutView`).
- **`data/`** - `templates.ts` (`'use server'` actions: list, get,
  create, update, rename, set default, delete, ensure-default) and
  `template-schemas.ts` (the Zod inputs, kept in a plain module per
  `use_server_value_exports`).

**Database** (`supabase/migrations/20260927000000_proposal_layout_v2.sql`):
`proposal_templates` (named layouts per user, one default enforced by a
partial unique index), `proposal_settings` (one row per user: password,
download, section-nav, expiry/deposit defaults, link preview),
`proposals.layout` (reserved; nothing writes it until Phase 4) +
`proposals.template_id` (reserved; nothing writes it until Phase 4), and
`user_branding.blocks_proposal_v1_backup(_at)` (the v1 tree backed up
when a user is first migrated). RPC `get_public_proposal_layout(token)`
returns the proposal's own `layout`, or null - never a template's
layout, so a couple's link never renders an unpersonalised template.
Full column tables and the RPC: `.claude/docs/database-schema.md`.

**Public page**: `app/proposal/[token]/page.tsx` calls
`get_public_proposal_layout` alongside `get_public_proposal`, and
`ProposalPage` renders `ProposalLayoutView` when the proposal has its
own v2 layout, else falls back to the v1 block tree. Because Phase 1
never writes `proposals.layout`, every existing proposal's public link
stays on the v1 tree even after the MC creates templates on the
Templates tab - v2 only reaches a couple once Phase 4 gives proposals
their own layout copy. The public page is not flag-gated (D14): turning
`NEXT_PUBLIC_PROPOSAL_LAYOUT_V2` off after a proposal has its own
layout would not revert that proposal's link to v1.

**Dashboard**: `/proposals` is a single page, not the 4-tab segmented
nav this section originally planned — see "Layout v2 (single-page
consolidation)" below for what replaced it and why. Template
create/rename/set-default/delete and the ensure-default migration flow
(`app/(dashboard)/proposals/templates/`) are functional; opening a
template into an editor is disabled ("Layout editor coming soon")
until Phase 2.

**Not in Phase 1**: no section editor (Phase 2), data sections still
render through the v1 adapter rather than native v2 shapes (Phase 3),
builder design mode (Phase 4). Per-proposal engagement analytics (time
per section, drop-off, device split — Phase 5) remains future,
separate work; it is not the stat row the single-page consolidation
added. The MC-side PDF button
(`app/(dashboard)/proposals/[id]/proposal-pdf-button.tsx`) and the
Branding preview still render v1 only until Phase 2.

## Layout v2 (Phase 2)

Spec: `docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md`
section 8 item 2. Plan:
`docs/superpowers/plans/2026-09-16-proposal-layout-v2-phase2-template-editor.md`.
Same branch, same flag, still staging-only. Ships the section editor at
`/proposals/templates/[id]` the Templates tab's Open link now opens
(`app/(dashboard)/proposals/templates/[id]/page.tsx`). Full page
behaviour: `.claude/docs/page-specs.md` ("Templates editor (Phase 2)").

**New code, two places:**

- **`components/editor/`** - toolbar and canvas primitives lifted out
  of `app/(dashboard)/branding/` so the Branding editor and this
  section editor share one set: `toolbar-primitives.tsx`
  (`PillToggle`, `ActiveTargetLabel`, `ToolbarDivider`,
  `IncludeDropdown`), `position-control.tsx`, `select.tsx`,
  `slider.tsx` (`onCommit(v)` for the undo-history point),
  `number-stepper.tsx`, `resize-grip.tsx` + `resize-math.ts` (`Snap`,
  `applySnaps`, `dragValue`, ...), `canvas-frame.tsx` (the zoomable,
  pannable viewport; its `scrollRef` prop exposes the scroll element
  so a floated control bar's popovers stay inside the canvas). The old
  Branding import paths still work as re-export shims until the
  Phase 5 toolbar rebuild. Rendered on `/design-system`
  (`app/design-system/editor-primitives.tsx`).
- **`features/proposals/editor/`** - everything the template editor
  itself needs: `state.ts` (`LayoutAction`, `layoutReducer`,
  `newSectionFor`), `use-layout-editor.ts` (the one history, below),
  `extensions/` (the spec-parity TipTap set with `undoRedo: false`,
  the slash menu, the history keymap, node/columns commands),
  `content-section-editor.tsx` (one TipTap `Editor` per content
  section, registered in `editor-registry.ts` so a bar rendered
  elsewhere in the tree can reach it by section id), `section-canvas.tsx`
  (dnd-kit sortable rows; owns the add palette), `editable-section.tsx`
  + `content-section-frame.tsx`, `add-line.tsx` (the 40-section cap,
  `SECTION_CAP_MESSAGE`), `add-palette.tsx` + `use-add-palette.ts`,
  `insert-items.ts` (image/audio/embed run through
  `proposalEditor.callbacks`, wired to `insert-media-host.tsx` +
  `use-insert-media.ts` - see below; every other item is a direct
  editor command), `node-views/` (React NodeViews with resize grips
  for image/button/embed/audio/spacer/columns), `bars/` (section, text,
  and per-kind node bars, `bar-shell.tsx`, `override-dot.tsx`),
  `resize/` (section height/width resize maths and grips),
  `template-editor.tsx` + `template-editor-body.tsx` +
  `editor-header.tsx` + `use-template-autosave.ts` +
  `use-editor-shortcuts.ts` + `use-canvas-keys.ts` +
  `step-selection-out.ts`, `editor-styles.ts` (`EDITOR_PROSE_CLASS`,
  the mobile-canvas stacking rules).
- **`features/proposals/data/media.ts`** - `uploadProposalMediaFile`
  (client-side upload to the `proposal-media` bucket, mirroring
  `app/(dashboard)/branding/upload-proposal-media.ts`'s raw-XHR
  progress pattern as a standalone copy: the module boundary below
  forbids importing that file directly). `MEDIA_LIMITS`: image 10MB
  (`jpeg`/`png`/`webp`/`gif`), audio 25MB (`mpeg`/`mp4`/`x-m4a`/`wav`),
  video and hero `background` 50MB (`mp4`/`webm`).
- **Inserting a fresh image/audio/embed** (not replacing an existing
  node's src/url, which the node bars handle directly) goes through
  `insert-media-host.tsx`'s `InsertMediaHost`, mounted once in
  `template-editor-body.tsx` beside `useEditorShortcuts`.
  `use-insert-media.ts` wires its imperative `open` handle into every
  registered editor's `proposalEditor.callbacks` (mirrors
  `use-editor-shortcuts.ts`'s pattern). Picking a file uploads via
  `uploadProposalMediaFile` and inserts the node through
  `insert-atom-node.ts`'s `insertAtomNode`, which leaves it
  node-selected so its node bar opens immediately; a busy/error pill
  (`insert-media-status-pill.tsx`) floats over the canvas while the
  upload is in flight. Embed goes through a url-first modal
  (`embed-insert-modal.tsx`) instead of an upload, gated by the same
  `detectEmbedProvider` allowlist the node bar's Replace-link popover
  uses - no bare `url: null` placeholder node can ever reach the
  document through this path (an earlier direct-insert path could, and
  broke autosave for the whole template; see the Phase 2 final-fix
  ledger).

**One history, not two.** `useLayoutEditor` runs the layout through
`lib/branding/use-history.ts`'s `useHistory<ProposalLayout>`; the
selection lives beside it in a plain `useState` so clicking a
different section never pushes an undo step (`use-layout-editor.ts`'s
module doc has the full ordering rationale). TipTap's own history is
off (`undoRedo: false` in `extensions/index.ts`) - two undo stacks
fighting over the same keystroke is worse than one - so
`HistoryKeymapExtension` (`extensions/history-keymap.ts`) is what lets
⌘Z/⌘⇧Z reach the layout's real history while a section's text editor
has focus, via callbacks `use-editor-shortcuts.ts` sets on every
mounted editor's storage (`extensions/proposal-editor-storage.ts`).

**Every editor output is validated before it lands anywhere.** Rich
text JSON passes through `toPlainJSON` (`@/lib/utils`, TipTap's
`getJSON()` output carries a null prototype that server actions
silently drop) before it enters the reducer's `setContent` branch,
and the full layout passes through `parseProposalLayout`
(`model/schema.ts`) again before every autosave
(`use-template-autosave.ts`). A layout the editor itself produced must
always pass its own schema - a failure there means a bug upstream, so
it logs `proposal_layout_invalid_editor` and shows "Save failed"
rather than reaching the server with a broken layout.

**Limits** (`model/rich-doc-spec.ts`'s `LAYOUT_LIMITS`): 40 sections
per template, 200 nodes per rich doc, 2MB serialised.

**Nothing the MC types is ever held only in React state** (2026-09-20
hardening, after work was lost on refresh three times). The root cause
was three defects stacking: a failed save was invisible (the header's
status readout had been removed) and never retried; the hook marked a
value "sent" before the save resolved, so a failed value skipped the
unload beacon; and the beacon raced the reload's read, so a reloaded tab
could mount on stale content and autosave it over the newer copy (the
update had no guard). `use-template-autosave.ts` now has four layers,
each covering the hole the one above leaves:

1. **Debounced save with automatic retry**
   (`lib/branding/use-autosave.ts`): 800ms after the last change, one
   request on the wire at a time, and on failure an automatic retry at
   1s, 2s, 4s ... capped at 30s until it lands. "Sent" is recorded only
   once the server confirms. The header's `SaveStatusLabel`
   (`editor-header-name-field.tsx`) is back: a muted "Saved" almost all
   of the time, "Save failed" + "Retry save" (skips the backoff) on a
   failure, "Changed elsewhere" + "Reload" on a conflict.
2. **Revision guard** (`proposal_templates.revision`, migration
   `20260930000000_proposal_template_revision.sql`): every
   `updateTemplateLayoutAction` call carries `baseRevision`, the update
   matches `revision = base` and bumps it, and a miss returns
   `conflict: { revision, layout }` (the current row) instead of writing.
   The hook adopts the server revision when the conflict's content is
   already what the editor holds (our own beacon landing first), and
   stops with `'conflict'` when it differs: re-sending would overwrite
   whatever another tab or device wrote. Reload discards the local
   edits, which the label says.
3. **Local draft** (`editor/local-draft.ts`): every change is mirrored
   into `localStorage` under `zebri:proposal-draft:<userId>:<templateId>`
   with the revision it was edited on, before the debounce elapses, and
   cleared once the server confirms it. `template-editor.tsx` reconciles
   it on load: a draft whose `baseRevision` equals the row's revision is
   what the editor mounts with and is saved straight away
   (`initialDirty`); an older one is stale and the row wins. The route
   page resolves the user id server-side for the key (a browser-global
   key would leak one account's draft to the next sign-in).
4. **Unload beacon and prompt**: a hard refresh or tab close never runs
   React's unmount cleanup, so `beforeunload` beacons the unconfirmed
   layout through `navigator.sendBeacon` to
   `POST /api/proposals/templates/layout-beacon` (a plain route, since a
   Server Action can't be a `sendBeacon` target; same Zod schema and
   RLS ownership check as the action, no rate limit). The beacon matches
   on the same revision guard but does NOT bump it: the client never
   learns whether it landed, so a bump would make the reloaded tab's
   first real autosave (restored from the draft, still on the old
   revision) fail as a conflict for content it wrote itself. The browser
   is also asked to prompt before leaving only while a save has actually
   failed, never inside the plain debounce window (the draft covers that
   and prompting on every quick refresh would nag).

Dev-only gotcha that the live check caught: React StrictMode double-
mounts every effect, and the fake unmount's cleanup cancelled the
initial save's timer (a restored draft never saved in development) and
left the hook's "unmounted" flag set (disabling every automatic retry).
Both are handled in `use-autosave.ts`; `use-autosave.test.ts` pins them
under `<StrictMode>`.

**Module boundary**: `extensions/index.ts` carries its own `'use
client'` - the `[id]` route is a server component importing the
`@/features/proposals` barrel, and the node extensions value-import
`@tiptap/react`'s `ReactNodeViewRenderer` (a class, undefined on the
server) at module evaluation. Without the directive the barrel pulled
that import into the RSC module graph and the route 500'd.

**Not in Phase 2**: the public page still renders v1 or the Phase 1
v2 fallback only - nothing here writes `proposals.layout`, so a link
stays untouched until Phase 4. Data-section editing (Layout/Include
controls, quantities, gallery, video, testimonials, FAQ, accept) is
Phase 3. The editor's `role` is fixed to `'mc'` (flavours the add
palette's Presets tab only) until Phase 4's role picker; no per-
proposal Design mode or page settings form yet.

## Layout v2 (single-page consolidation, 2026-09-18)

Same branch, same flag, still staging-only. Replaces the Phase 1 plan
of a 4-tab segmented nav (Proposals, Templates, Analytics, Settings)
with a single `/proposals` page: the Templates tab duplicated the
sidebar's Templates hub (which already had a Proposals tab rendering
the same `TemplatesGrid`), and Analytics/Settings were still
`Empty`-state placeholders with nothing planned to fill Analytics
beyond a per-proposal drill-down anyway. `proposals-nav.tsx` and the
`/proposals/templates`, `/proposals/analytics`, `/proposals/settings`
routes are deleted.

While the flag is on, `/proposals` (`app/(dashboard)/proposals/page.tsx`)
now also renders:

- **A stat row** (`proposals-stats-row.tsx` + the pure
  `computeProposalStats` in `proposals-stats.ts`): total / sent /
  viewed / accepted, computed client-side from the already-fetched
  list. Deliberately no trend/delta — there is no historical
  comparison data to back one. This is not Phase 5's per-proposal
  engagement analytics (time per section, drop-off, device split),
  which stays future, separate work and needs event-tracking
  instrumentation that doesn't exist yet.
- **A templates shortcut** (`proposal-templates-shortcut.tsx`): the
  default template plus the next couple most-recently-edited, sharing
  the Templates tab's `TEMPLATES_QUERY_KEY` cache. "See all" links to
  `/templates?tab=proposals` (the hub's Proposals tab is the real home
  for rename/duplicate/delete/set-default) — `templates-client.tsx`
  now reads an initial tab from `?tab=`, previously hardcoded to
  Emails.
- **Per-row view counts**: `use-proposals.ts` now selects `view_count`;
  `proposals-list.tsx` shows it beside the already-shipped status pill
  when greater than zero.
- **A settings gear** on the header opening a `Modal`
  (`proposal-settings-modal.tsx`, scope `account`; it was a `SidePanel`
  flyout until 2026-09-19) with a REAL account-defaults form —
  password protection, PDF download, expiry days, deposit percent,
  link preview title/image — persisted to `proposal_settings`
  (`features/proposals/data/settings.ts`). This table shipped with
  Phase 1's migration but nothing read or wrote it until now; pulling
  the form forward from its original Phase 4 slot was possible because
  the columns and RLS already existed.
  **Persist-only**: nothing on the public proposal page or the
  proposal-creation path reads these values yet (no password gate, no
  PDF-download enforcement, no expiry/deposit default applied to a new
  proposal, no link-preview meta tags). That enforcement wiring is
  separate future work, not this pass.

## Per-template settings, card menu icons, no sample pill (2026-09-19)

- **Per-template settings.** `proposal_templates.settings jsonb`
  (`20260929000000_proposal_template_settings.sql`) holds a template's
  own copy of the account settings shape, or `null` to follow the
  account defaults. The same `ProposalSettingsModal` opens in scope
  `template` from "Settings" in a template card's `...` menu (both on
  `/proposals` and the `/templates` hub, since `template-cards.tsx`
  hosts it). The draft seeds from
  `resolveTemplateSettings(account, template.settings)`: a template
  with no snapshot shows the account values, and only diverges once
  Save writes a full snapshot (`updateTemplateSettingsAction`, validated
  with `updateTemplateSettingsSchema`, all fields required so a partial
  can never be stored). "Reset to account defaults" (offered only when a
  snapshot exists) writes `null`. Duplicating a template copies its
  snapshot. `listTemplatesAction` / `getTemplateAction` select and parse
  `settings` (`parseStoredSettings`; a corrupt value reads as `null`).
  **Persist-only**, exactly like the account row: the enforcement
  wiring, when it lands, should read `template.settings ?? account`.
- **Card menu icons.** Every item of the template card's
  `RowActionsMenu` carries a Lucide icon (Pencil / Star / Copy /
  Settings / Trash2).
- **No rename on the card** (2026-09-19, founder's ask). The name is
  plain text and the menu has no Rename item; a template is renamed in
  the builder's header (`EditorHeader`'s `NameField`) only.
  `useTemplateMutations` lost `renameTemplate` with it.
- **Outcomes as chips on the thumbnail.** `TemplateStatsChips` (was
  `TemplateStatsLine`, a caption line under the card) renders sent /
  accepted / won as icon chips over the thumbnail's top-left corner,
  with the full "5 sent" reading in a tooltip and as screen-reader
  text, and nothing when nothing has been sent. The card's `...` menu
  moved from the caption row to the thumbnail's top-right. `TemplateCard`
  takes this as `overlay` (was `footer`). No "Sample data" pill; the
  figures are still `SAMPLE_TEMPLATE_STATS` until
  `proposals.template_id` is written. The detail page's engagement
  placeholders keep their pill.
- **Editor back link goes to `/proposals`** (was the Templates hub's
  Proposals tab): the cards an MC edits from live on `/proposals`.
- **Skeleton loading.** The templates grid (both hosts) waits as
  `TemplateCardsSkeleton` (card-shaped placeholders in the same grid),
  and the editor waits as `EditorSkeleton` (header row + page sheet),
  built from the `Skeleton` primitive; no centred spinner on either.

## Section background, hide on phone, undo (fixes 2026-09-18)

- **Background tabs are exclusive** (Colour / Image / Video): every
  choice replaces the media wholesale, keeping only `overlay`
  (`editor/bars/section-background.tsx`'s `only()`); a leftover colour
  under a transparent PNG was the tell. Remove clears the media.
- **`SectionBackground.position`** (`{ x, y }` percentages, unset =
  centre) is the image's focal point, rendered as `object-position` by
  `render/section-backdrop.tsx` (shared by canvas and public page). Set
  by **drag on the section itself**: the Image tab's Reposition button
  (`bars/section-background-media.tsx`) closes both popovers and
  `editable-section.tsx` mounts `editor/background-reposition.tsx`, a
  full-section drag surface with a "Drag to reposition / Done" pill
  (Done is a sibling of the surface, never a child, or its pointerdown
  starts a drag and swallows the click). Moves dispatch uncommitted,
  release commits one undo step, Escape/Done exit. Maths in
  `background-reposition-math.ts` (`dragFocalPoint`, cover-overflow
  based, pure). A 3x3 focal grid in the popover was rejected. No UI yet
  for `overlay` or `poster`.
- **Hide on phone** is a container query (`@max-3xl/doc:hidden`, 48rem =
  the old 768px viewport cut-off), not `max-md:`: the mobile canvas and
  mobile Preview are a ~390px `@container/doc` inside a desktop window,
  so a viewport query never fired there. `rich-doc-nodes.tsx` still uses
  viewport `max-md:` for image float and column stacking, so those two
  do not yet reflect mobile in the Preview overlay.
- **Undo/redo flush the pending debounce first** (`lib/branding/
  use-history.ts`): Cmd+Z straight after typing used to skip the
  uncommitted edit (a no-op with nothing committed yet, a double undo
  otherwise). The header has no Undo/Redo buttons; the shortcuts
  (`history-keymap.ts` in-editor, `useHistory`'s window listener
  elsewhere) are the only way in. `ColorPopover` now carries the same
  16px `collisionPadding` as the other editor popovers.

## Global style (canvas theme, 2026-09-18)

Canvas-level styling for the whole proposal, owned by the template:
`ProposalLayout.theme` (`features/proposals/model/theme.ts`, Zod in
`model/schema.ts`). Decisions locked with the user on 2026-09-18:

- **Proposals only.** Quotes, invoices, contracts and the portal keep
  reading Branding directly; they move onto this model later.
- **Seeded from Branding once.** A template with no `theme` (saved before
  this existed) gets `defaultTheme(branding)` the first time the editor
  opens it (`withTheme`, `template-editor-body.tsx`) and the first
  autosave writes it back. Public page, print, thumbnails and the Preview
  overlay resolve a missing theme the same way (`resolveTheme`), so
  nothing needs a migration. `withTheme` also drops `padding: 'cozy'`
  from content sections (the old fixed default) so the theme's padding
  control reaches them; `SectionStyle.padding` is now optional and means
  "inherit `theme.sectionPadding`".
- **Paragraph colour starts black** (`CONTENT_TEXT_COLOR`, `#111827`),
  not Branding's body grey. Every other role copies `roleDefaults`
  exactly, so an untouched template renders as before.
- **Step flow is scroll-snap over pages**, not a stepper, and a page is
  not a section (2026-09-19: "sections themselves shouldn't be the thing
  that are full height"). A `pageBreak` section (`SectionKind`, the last
  card in the add palette, `model/pages.ts` `splitPages`) marks where the
  next page starts; the sections between two breaks share one page.
  `render/layout.tsx` wraps each page in a `data-page-id` box
  (`pageCss`: `min-height: var(--doc-screen, 100svh)`, `snap-start`,
  `flex-col`); sections on it keep their natural height (the founder's
  second ruling the same day: sharing the page read as "still forcing
  all sections to be full height"), and only a section whose own Height
  is `full` grows (`grow`) to fill its page, so a hero still fills the
  screen. The section gap never sits above a page's first
  section (`pageStart`). A page with nothing on it (leading, trailing or
  doubled break) is skipped on the public page. The scroll container
  snaps (`globals.css`, keyed on `data-flow="step"` for `html` on the
  public page and `[data-doc-scroll]` in the Preview overlay, which also
  sets `--doc-screen` to its own box height), and a dot rail
  (`render/step-rail.tsx`, one dot per page, labelled by the page's first
  section) marks the current page. Stack flow and print render the flat
  list and drop the breaks, so switching flow never loses them. The
  section Height pill shows in both flows: in step flow "Full" means
  "fill this page".
- **Page breaks on the canvas**: `editor/canvas-pages.tsx` groups the
  rows into 80svh pages in step flow (flat in stack flow);
  `editor/editable-page-break.tsx` is the break's row (dashed rule +
  "Page break" tag, sortable, click to select, Delete / its own Remove
  button with no confirm since `isSectionEmpty` is true for it, and an
  "Only shown in One at a time" hint while the flow is Stacked). A break
  has no toolbar and no style; `newSectionFor('pageBreak')` gives it the
  schema's required `style` at the content default. An empty page keeps
  its break row on the canvas so it can still be deleted.
- **Page width** (`theme.contentWidth`, Narrow / Medium / Wide / Custom
  px): the content column width a section inherits until it picks its
  own in its Style popover (`SectionStyle.contentWidth` is optional;
  `effectiveWidth`). Fresh Text sections and `blankTemplateLayout` set
  none. The schema leaves it optional on read; `resolveTheme`/`withTheme`
  complete a pre-field theme with `medium` (`completeTheme`), and
  `withTheme` also releases content sections still on the old fixed
  `medium` so the control reaches them. Data sections keep their own
  deliberate widths.
- **Section spacing is three controls**: `sectionGap` (outer gap, page
  background shows through; `marginTop` on every section but the first,
  on the canvas too), `sectionPadding` (the inherited vertical default;
  "Vertical padding" in the Page tab and in each section's Style) and
  `sectionPaddingX` (the horizontal inset of the content column;
  "Horizontal padding", theme default with a per-section
  `SectionStyle.paddingX` px override via `effectivePaddingX`, stops
  Compact 16 / Cozy 32 / Roomy 64 / Custom, `SECTION_PADDING_X_PX`).
  Rendered as `paddingInline: min(<x>px, 10cqw)` on the column so a wide
  desktop inset caps on a phone. The schema defaults a missing
  `sectionPaddingX` to 32, the inset every column had before it was
  adjustable, so older themes need no migration. Both section-level
  controls are one generic `SectionSpacingControl`
  (`bars/section-padding.tsx`), each axis with its own stops and icon.
- **A section that matches the page follows the page**
  (`inheritMatchingDefaults`, `model/theme.ts`): a section value equal to
  the theme's default (width, vertical or horizontal padding) is stored
  as "inherit", on every editor load (`withTheme`) and on every
  `updateStyle`. Before this Global style's padding reached almost
  nothing (2026-09-19): `migrate-v1`'s `baseStyle` stamped `padding:
  'cozy'` on every data section, and a content section once set to the
  default kept it as an override. `baseStyle` no longer writes a default
  padding. A value that differs from the default (a dragged 38px hero, a
  Roomy section on a Cozy page) is a real override and stays - until the
  page value for that field changes: **a Global style width or padding
  change applies to every section** (`setTheme` clears each section's
  own value for that field, one undoable step), because an override the
  author cannot see (a 38px hero left by a height drag) otherwise made
  the Global control look dead (2026-09-19). Set a section's own value
  again afterwards to make it differ.
- **Text sizes are fluid past 32px** (`lib/branding/fluid-type.ts`):
  every theme role, Branding role and per-selection `fontSize` mark
  renders as `clamp(max(32, 0.6·S)px, (S/560·100)cqw, Spx)` once S
  exceeds 32; at or below that it is a fixed px. Full size at any doc
  container 560px or wider, ~70% on a 390px phone, never below 32. The
  editor canvas gets the same via `FluidFontSizeExtension` (content
  sections and data-section inline fields); data sections' public HTML
  gets it in `render-rich-text.ts` after sanitising, because the server
  build of `generateHTML` (happy-dom) drops a `clamp()` font-size.
- **A cell or column never ends in an atom** (`extensions/trailing-paragraph.ts`):
  an image, embed, spacer or button inserted as the last thing in a
  `tableCell` / `tableHeader` / `column` gets an empty paragraph after it
  (an `appendTransaction` plugin, plus one pass on `create` for a saved
  doc), so there is always a text position to click into and open `/`
  from. TipTap's own `trailingNode` covers only the doc root.
- **Table border colour**: `TableAttrs.borderColor` (`#RRGGBB` or null),
  set from the Table bar's Border colour swatch; the editor's `TableView`
  and the public `TableNode` both publish it as `--table-border` on the
  `<table>`, and every cell's border reads
  `var(--table-border, color-mix(currentColor 20%))`, so an unset table
  looks exactly as before.
- **Blank lines survive the render**: an empty paragraph, or one ending
  in a hard break, gets the trailing `<br>` ProseMirror gives it on the
  canvas (`rich-doc.tsx`'s `needsTrailingBreak`, `render-rich-text.ts`'s
  `keepBlankLines`), so Enter-for-spacing shows on the couple's page.
- **Animation**: `mode` none / section (reveal on scroll, first section
  static) / together (all on load), `type` fade / slide, `speed`
  slow 1100 / medium 700 / fast 400ms. Rendered as `data-reveal` +
  `data-anim` attributes with the keyframes in `globals.css`; duration
  is `--doc-anim-ms` on the layout root. Never plays on the editor
  canvas; reduced-motion and print force everything visible.
- **Text**: four roles (Heading 1/2/3, Paragraph), each with font, size,
  weight, colour, case, letter spacing, line height, alignment.
  `roleCss(branding, role, { theme })` resolves those four from the
  theme and every other role (`sectionLabel`, `finePrint`, `total`) from
  Branding. The editor mirrors them into the `--doc-*` vars
  (`editor-styles.ts`), with `--doc-<role>-align` new and the precedence
  node attr > section align > theme role align. Any catalogue font is
  allowed, script faces included (`SCRIPT_FONT_IDS`, added 2026-09-19).
- **Font loading**: the editor loads the whole catalogue
  (`ensureBrandFontsStylesheet`); the public page and PDF load only what
  the layout uses. `layoutFontIds(layout, branding)`
  (`model/layout-fonts.ts`) collects the theme's four roles plus every
  `textStyle` override, and `ProposalPage` hands the result to
  `useBrandingHead({ fonts })`. Before this, any face other than
  Branding's heading + body pair silently fell back on the couple's page.

**UI**: one "Global style" button (`editor/global-style/`) pinned to the
top-left of the canvas workbench, opening a 320px popover with Page and
Text tabs and a "Reset to brand" footer. Every control dispatches
`setTheme` (a shallow-by-level `ThemePatch`), committed, so undo/redo and
autosave treat theme edits like section edits.

**Verified live 2026-09-18** on the running editor: button, both tabs,
live re-render, persistence across reload, step flow snapping in the
Preview overlay, Reset. Gotcha: the dev server on :3000 served stale
`globals.css` (the new keyframes/snap rules were missing until the
Turbopack cache was cleared); `rm -rf .next/dev` and restart if a CSS
change does not land.

## Packages live in the block (2026-09-18)

Founder ruling after rejecting the static packages section ("Qwilr-style:
click a package and edit it"). This reverses the v2 spec's "options and
add-ons come from the proposal, never the layout" line for templates:

- **Model**: `PackagesData.options?: PackageOption[]`
  (`features/proposals/model/packages.ts`; camelCase, `toPublicOption`
  adapts to the snake_case `PublicProposalOption` the shared card
  renderer and `lib/proposals/pricing` already take, with `subtotal`
  derived, never stored). Typed Zod on `options` in `model/schema.ts`
  (`PACKAGE_LIMITS`: 6 cards, 20 lines, $1,000,000). A section with no
  `options` (saved before this) renders `starterPackages()` on every
  surface (`resolvePackageOptions`) and the editor writes them into the
  layout on the first edit. A v2 packages section never reads
  `doc.proposal.options`; Phase 4 fills `options` from the proposal's
  rows when a proposal is created (and the same in-place editor edits
  the proposal's real options in Design mode).
- **Renderer slots**: `PackagesSlots.card(option, index) -> PackageCardSlots`
  (`title`, `description`, `price`, `item`/`addon` row content, `footer`,
  `corner`) and `PackagesSlots.trailing` (a grid cell after the cards).
  `RenderPackages` takes `options` to render in place of the proposal's.
  Row slots replace only the row's content; the `<li>` and its brand
  typography stay in `package-card.tsx` / `package-addons.tsx`.
- **Editor** (`editor/data/edit-packages.tsx`, `edit-package-card.tsx`,
  `package-card-menu.tsx`, `inline-number.tsx`): title, description and
  every line typed in place (`InlineField`, plain text via `docText`,
  variable chips become `{{ id | fallback }}` tokens); amounts and a
  fixed price in `InlineNumber` (rests as `1,650.00`, edits as bare
  digits, commits once on blur/Enter); an add-on's checkbox sets
  "ticked by default"; per-line remove on hover; "Add inclusion" /
  "Add add-on" in the card; an always-visible pencil per card opening
  Recommended (one per section), Sum of lines / Fixed price, Price incl.
  GST, move left/right, Remove package; a dashed "Add package" tile as
  the last grid cell (hidden at the cap; explains hidden-while-empty).
- **Section settings moved to the toolbar**: the floating hover-only
  `Options`/`Layout` pills (`data-pill-trigger.ts`, deleted) are gone.
  `SectionToolbar` renders `DataOptionsButton` after Style: Packages
  (layout, show inclusions, button label) and Gallery (layout), both on
  `bars/toolbar-popover.tsx` (same trigger, `rounded-control`, and an
  `alignOffset` that lands every toolbar popover on the toolbar's left
  edge).
- **Fixed on the way**: `EDITOR_FIELD_PROSE_CLASS` (no `[&_p]:mb-3`, no
  `min-h`) for data fields, since a caller's `[&_p]:m-0` could not beat
  the shared class and every inline field carried 12px of bottom margin;
  `InlineField` now registers `ProposalEditorStorageExtension` and takes
  undo/redo from `FieldShortcutsProvider` (`editor/data/field-shortcuts.tsx`,
  mounted by `template-editor-body.tsx`), so Cmd+Z/Escape inside any data
  field work instead of throwing on `storage.proposalEditor.callbacks`;
  `history-keymap.ts` optional-chains that read.

Not done: weekend loading % and line quantity have no in-card control
(the model carries them); "Add package from my saved Packages" picker;
the text bar for inline fields.

## Data sections carry no text of their own (2026-09-19)

Founder ruling: "packages, gallery, video, faq, testimonials and accept
sections should not have any text above the main content or below. If
we want text, we can just add a text section above or below." Gallery
already worked that way; this brought the other five in line, and the
founder chose **drop** over hoisting the old copy into text sections.

- **Model**: `DATA_TEXT_FIELDS` (`features/proposals/model/layout.ts`:
  `heading`, `headingStyle`, `caption`, `captionStyle`, `textBelow`,
  `textBelowStyle`, `reassurance`) is `Omit`ted from `PackagesData`,
  `VideoData`, `TestimonialsData`, `FaqData` and `AcceptData`, so no
  editor can read or write them. The Zod schema stays loose, so a
  template saved earlier still parses with those keys in its JSON.
- **Render seam**: `toV1Block` (`render/data-section.tsx`) deletes the
  same keys before handing the block to the v1 renderer. That is the
  one place every surface (canvas, public page, print, thumbnails)
  passes through, so an old template's `"Your options"` /
  `"Kind words"` / deposit line stops rendering everywhere without a
  data migration. The heading-alignment folding that lived there
  (`BLOCK_TEXT_STYLE_KEYS`) went with it; item text still inherits the
  column alignment.
- **Migration / new sections**: `dataSection()` in `model/migrate-v1.ts`
  strips the keys, so a section from the add palette
  (`newSectionFor` runs the v1 default through that migration) and the
  starter presets both arrive without the copy.
- **Editor slots** (`editor/data/edit-*.tsx`): packages is `card` +
  `trailing`; faq and testimonials are `item` (plus the `after` add
  button); video is `media`; accept is `button`. No `InlineField` for
  a heading, caption, text-below or reassurance anywhere.
- **`RenderAccept`** (`lib/branding/public-blocks/proposal/accept.tsx`)
  now gates its `<h2>` and reassurance `<div>` on content-or-slot, the
  way the other four blocks already did; the legacy Branding proposal
  surface still shows them because its blocks carry text.

Left alone: `Section.intro` (typed and rendered by `render/section.tsx`,
never written by anything) and the v1 Branding "proposal" surface and
its block controls, which are outside the builder.

## Tables in the builder (2026-09-19)

Founder feedback: "adding content to a table shouldn't resize the width
of columns, should just be the height. We should be able to add rows and
columns and resize the table to make it wider/taller."

- **Root cause of the reflow**: `TableKit` was configured
  `resizable: false` and the table had no column widths, so the browser's
  auto table layout re-distributed every column on each keystroke. Both
  surfaces now use `table-layout: fixed` (`table-fixed`); only row height
  reacts to content.
- **One width model, prosemirror-tables' own**: a column's width is its
  cells' `colwidth` (px, one entry per spanned column); a table whose
  every column is sized renders at their sum, otherwise it stays fluid
  (`w-full`) with the sum as `min-width`. `render/table-layout.ts`
  (`tableLayout`) mirrors TipTap's `updateColumns` exactly and drives
  `render/table-node.tsx`'s `<colgroup>` + inline size, so the public
  page and the canvas agree. The Zod schema already round-tripped cell
  attrs; the `table` node gained `attrs.height` (`TableAttrs`,
  `model/doc.ts`). `TABLE_CELL_MIN_WIDTH` (48) is the shared floor.
- **Editor** (`editor/extensions/table.ts`): `Table.extend` with the
  `height` attr, `resizable: true` (drag a column border; the handle and
  cell-selection tint are the prosemirror-tables classes styled in
  `editor-styles.ts`), `lastColumnResizable: false` because the table's
  right edge belongs to the width grip, and `ProposalTableView extends
  TableView` applying `height`, stamping `--col-pct` on each `<col>`
  and dropping the stale inline `width` TipTap leaves on a column that
  loses its `colwidth` (Reset size).
- **Table bar** (`bars/node-bar-table.tsx`): Add row below / Delete row
  / Add column right / Delete column / Reset size / Remove, acting on
  the caret's row and column. The last row and column cannot be deleted
  from the bar (disabled at one; Remove is the explicit way). Shown
  while the caret is anywhere inside a table: a table is never a
  `NodeSelection`, so `editor/node-selection-for.ts` reports the
  enclosing table at its own position and `content-section-editor.tsx`
  re-reports on focus too (a click back onto the exact caret spot after
  a workbench click emits no `selectionUpdate`, and `select` had cleared
  the node).
- **Grips** (`bars/table-resize-overlay.tsx`, mounted next to
  `NodeBarAnchor` in `use-node-bar-content.tsx` because the table view is
  not a React node view): the right-edge grip scales every column's
  `colwidth` in proportion (`writeTableColumnWidths`,
  `extensions/table-commands.ts`), snapping to the column's full width,
  which clears the widths back to fluid; the bottom grip writes `height`
  (rows share the extra space) and clears it when the commit lands
  below the content's own height. `editor-canvas-region.tsx`'s
  click-outside-to-deselect now exempts `[role="slider"]`, or a grip
  click deselected the section mid-drag.
- **Phones**: a fully sized table is rendered at the host's width with
  each column's percentage share (`@max-3xl/doc:` container rules on
  both surfaces, `--col-pct`), so a table sized on desktop keeps its
  proportions on a phone instead of scrolling sideways. Header cells
  (`th`) stay vertically middle-aligned on both surfaces, as before.

## What a proposal is

An MC offers a couple up to three priced **options** (each a snapshot
of a package, or hand-built), plus optional **add-ons**, an intro note,
an expiry date, a deposit percent or payment schedule, and a contract
template. The couple opens a public link, and in later phases chooses
an option and signs. Phase A ships everything up to and including that
public link; choosing, signing, and paying land in Phase C.

## Tables

- **`proposals`** - one row per proposal. Owner `user_id`, `couple_id`,
  `status` (`draft`, `sent`, `viewed`, `accepted`, `declined`,
  `expired`), `version`, `share_token` (+ `share_token_enabled`),
  engagement stamps (`view_count`, `first_viewed_at`,
  `last_viewed_at`), and the fields that drive the close: expiry,
  deposit percent, payment schedule, contract template. `contract_id`
  and `invoice_id` are null until Phase C fills them in.
- **`proposal_options`** - 1-3 per proposal. A snapshot, not a live
  reference: it copies a package's pricing at save time, so editing the
  source package later never changes an already-saved proposal.
- **`proposal_option_items`** - line items on an option, `is_addon`
  splitting the base inclusions from optional extras.

Full column tables: `.claude/docs/database-schema.md` (Proposals
section).

## RPCs (Phase A)

- **`generate_proposal_number(p_user_id)`** - `PR-001`, sequential per
  user. Same shape as `generate_invoice_number`.
- **`get_public_proposal(token)`** - `security definer`, granted to
  `anon`. Returns null unless `share_token_enabled` is set (this is
  what makes an unsent proposal 404 on the public page). Merges
  branding, derives `expired` from `expires_at`, and bumps `view_count`
  on every read; the first read additionally stamps `first_viewed_at`
  and, if the proposal is still `sent`, flips status to `viewed`.

Phase C adds `accept_proposal`, `finalize_proposal_acceptance`, and
`decline_proposal`; Phase D adds `proposal_events` and
`record_proposal_events`; Phase E adds the lifecycle trigger and the
expiry cron. None of these exist in Phase A.

## RLS

Owner-only on all three tables. `proposal_options` and
`proposal_option_items` also carry a parent-ownership `exists` check in
`with check` (`_owns_proposal`, `_owns_proposal_option`), since a
foreign key is validated with elevated privileges and does not consult
RLS on its own. Coverage matrix + test path: `.claude/docs/security.md`.

## Status machine

```
draft --(send)--> sent --(first public open)--> viewed
```

Saving a `sent` or `viewed` proposal bumps `version`, clears every
`accepted_*`/`declined_*` field, keeps the same `share_token`, and sets
status back to `sent` (a re-send is implied by any edit). The public
page always renders the latest saved version. `accepted` and
`declined` are Phase C outcomes; `expired` is a Phase C/E cron stamp.
Revert to draft is available from any non-draft, non-accepted status
(`sent`, `viewed`, `declined`, `expired`), never from `accepted`.

## Dashboard surfaces (Phase A)

- **Sidebar:** "Proposals", between Couples and Calendar.
- **List** (`/proposals`): number, couple, title, status pill,
  headline total, expiry. Search across title/number/couple/status.
- **Detail** (`/proposals/[id]`): status, version, engagement facts,
  options with subtotals, decline reason (once Phase C exists), links
  to the couple and the generated contract/invoice.
- **Builder** (`ProposalBuilderModal`): couple + expiry
  (`BuilderMetaRow`, shared with Quote/Invoice), title, intro note,
  options editor, add-ons, deposit/schedule/contract-template terms, a
  readiness checklist, the shared `ShareAndSend` footer, and a live
  preview pane.
  - `ProposalPreviewPane` renders the real `ProposalPage` from the MC's
    branding and saved `proposal` block tree, fed by `previewProposal()`
    from the live (possibly unsaved) form, so the MC sees the couple's
    page before sending. It passes no `token`, which keeps the accept
    stepper and decline form unmounted, and `embedded`, which suppresses
    `useBrandingHead`'s favicon swap so the dashboard tab keeps its own
    icon while the modal is open. This matters because a draft's share
    link is dead (`share_token_enabled` defaults to false), so before
    this there was no way to see a proposal until after sending it.
  - An option starts either by applying a package or as a blank option
    (`blankOption()` in `lib/proposals/form-mapping.ts`), so a one-off
    offer never requires creating a throwaway package first. Both
    controls disappear at `MAX_OPTIONS`.
  - Base line items add and remove exactly like add-ons do. An option is
    a snapshot, so editing its items never touches the source package.
  - `ProposalOptionTerms` surfaces the three fields that reach the
    couple's package card but used to be invisible to the MC: GST
    inclusive, weekend loading percent, and fixed-price mode (which
    disables the line-item amounts, since the total stops using them).
- **Couple profile:** a Proposals tab mirroring the Contracts tab.
- **Send:** `app/api/email/send-proposal/route.ts` flips
  `share_token_enabled`, emails the couple, stamps `email_sent_at`, and
  logs a `couple_emails` row.
- **Public page:** `app/proposal/[token]/page.tsx` composes
  `ProposalPageClient` (`app/proposal/[token]/_components/proposal-page.tsx`),
  the couple's full branded page-mode block tree with selection state
  for the packages block and a "Download PDF" call. Tapping the accept
  block opens the Phase C accept stepper (`AcceptStepper`: Choose,
  Sign, Pay, Done in one `ProposalSheet` dialog named "Confirm your
  booking"); the decline link opens the "Not the right fit?" sheet.
  The stepper names its position ("Step 2 of 4: Sign") rather than
  relying on dots alone, the sign step's contract pane expands to the
  dialog's own scroll via "Read the full agreement" instead of trapping
  a legal document in a short nested scroller, and the accept block
  carries a factual expiry line while the proposal is open ("This offer
  is open until 1 December.", with today, tomorrow or a day count added
  only inside three days, since a day count on a date months away reads
  as a pushed deadline rather than a fact).

## What Phases B-E add

- **B - Design surface:** the Proposal page-mode surface, ten public +
  editor block renderers, uploads/embeds, starter templates per role,
  variables, PDF export. Landed 2026-09-14; see "Phase B: the design
  surface" below.
- **C - The close:** accept/decline RPCs, a choose-and-sign stepper,
  contract generation, invoice + payment stages, couple moved to
  `confirmed`, the expiry cron, MC notifications.
- **D - Engagement:** `proposal_events`, an events API, a tracker, an
  engagement summary and timeline on the detail page.
- **E - Integrations:** workflow triggers (`proposal_sent`,
  `proposal_opened`, `proposal_accepted`, `proposal_declined`,
  `proposal_expiring`), a portal card, and the doc/gate sweep.

## Phase B: the design surface

Spec: `docs/superpowers/specs/2026-09-12-proposals-engine-design.md`
§5.5, §7 (7.1-7.6), §12, §13 row B. Plan (with the full ruling
rationale): `docs/superpowers/plans/2026-09-13-proposals-engine-phase-b.md`.

Phase A's public page was a stopgap (title, intro note, options in the
shared 720px document frame). Phase B replaces it with the branded,
full-bleed proposal a couple actually sees: `'proposal'` joins
`SurfaceTab` in the branding editor, and a couple's link renders a
block tree of up to thirteen types (three chrome blocks shared with
every surface, ten proposal-only) in a new **page frame**.

### Page frame

`PublicBlockRenderer` (`lib/branding/public-renderer.tsx`) takes a
`frame: 'document' | 'page' | 'print'` prop. In `page` mode (used only
by the proposal surface), every top-level block is wrapped in a
full-width `<section>` by `PageSection` (`lib/branding/page-section.tsx`):
an optional `sectionBackground` (colour and/or image with a 0-100
overlay), and the content itself centred in an inner column at
`max-w-doc-page` (1100px, `--container-doc-page` in `app/globals.css`,
kept in sync with `DOC_PAGE_MAX_WIDTH_PX` in
`lib/branding/document-frame.ts`). The hero block is the one
exception: it owns the section's full width, with no inner column.

Sections reveal on scroll with `animate-reveal-up` (a 700ms rise-and-
fade), driven by `useReveal`: it starts hidden only when the animation
is enabled AND `IntersectionObserver` exists, so SSR, print, and old
browsers always paint visible from the first frame (R9). The hero and
the `print` frame never animate. `/design-system` ("Page frame" entry)
renders a live demo.

The hero's height is a share of the couple's viewport, `heightVh`
(30-100), set by dragging the grip on its bottom edge in the editor
(`HeroResizeGrip`, measured against the canvas's simulated 720px
viewport, snapping to a full screen within 4%). The page frame renders
it as `min-height: Nsvh`; document and print scale a 480px full-screen
opening. Blocks saved before the grip carry the legacy `height` preset
(`full` = 100, `tall` = 70, `short` = 45), resolved by `heroHeightVh`.
The heading has a fluid default size on the page frame
(`clamp(40px, 10.5cqw, 56px)`) unless the MC sets one, so a long couple
name on a phone does not run to three lines. `showHeading` /
`showSubheading` (absent = shown) hide either part; the editor exposes
them through the toolbar's Include dropdown.

### The ten blocks

All defined in `app/(dashboard)/branding/blocks/types.ts`; markers
render nothing until `doc.proposal` is present (R1), so the editor
canvas (which always has sample data) and the public/print pages (real
proposal data) share one renderer with no page-level tree splitting.

| Block | Config | Marker? |
|---|---|---|
| `hero` | `background` (none / image / video / embed), heading + subheading (rich text), `showHeading` / `showSubheading`, `overlay`, `heightVh` (legacy `height` preset as fallback), `textAlign` + `verticalAlign` | No, at-most-one (R4) |
| `introNote` | `heading`, `headingStyle`, `textStyle` (its `align` also places the 720px prose box) | Yes, renders the proposal's own `intro_note` |
| `video` | `source` (uploaded MP4/WebM or YouTube/Vimeo embed), `heading` (rich text, optional), `caption` | No |
| `gallery` | up to 12 `images`, `layout` (grid/masonry/carousel) | No |
| `testimonials` | `items` (quote/names/detail/imageUrl), `layout` (carousel/cards), `mobileLayout` (stack/carousel, cards layout only), `cardBackgroundColor`, `textBelow`, `carouselBackgroundColor`/`carouselIconColor` (2026-09-19: brought to the same Style-popover parity as packages/gallery) | No |
| `aboutMe` | `portraitUrl`, `body` (rich text), `imageSide` | No |
| `howItWorks` | `steps` (title/description/`HowItWorksIcon`) | No |
| `faq` | `items` (question/answer) | No |
| `packages` | `heading`, `layout` (cards/stacked), `showInclusions`, `ctaLabel` | Yes, renders the proposal's 1-3 options with add-on toggles and a live total (D7) |
| `accept` | `heading`, `buttonLabel`, `reassurance` (rich text), `buttonColor` | Yes, the accept CTA; Phase C mounts the real stepper behind it |

`introNote`, `packages`, and `accept` are the three markers: locked
(cannot be duplicated) and clearable (can be deleted and re-added),
deduped by `repairBlocks`.

`REQUIRED_BY_SURFACE.proposal = ['accept']`: the accept CTA is the only
block a proposal cannot do without, since without it the page is a
brochure the couple cannot act on. The hero, the personal note and even
the packages block are the MC's call, because the accept stepper renders
the option cards from the proposal's own data, so a couple can still
choose and pay on a page that never lists them inline.

`AT_MOST_ONE_BY_SURFACE.proposal = ['hero']` caps the hero at one
without requiring it (a second hero would give the page two openings,
R4). It is deliberately NOT in `EXACTLY_ONE_BY_SURFACE`, which also
complains about zero: listing the hero as both required and exactly-one
is what used to render a missing hero twice in the readiness panel, once
as "Hero" and once as "A Hero". All in
`app/(dashboard)/branding/blocks/policy.ts`.

Editor renderers live one per file under
`app/(dashboard)/branding/blocks/proposal/`, dispatched from
`render-proposal.tsx` (`renderProposalBlock`), which
`block-renderer.tsx`'s `renderBlock` calls first, falling through to
its own switch for every other block type; toolbar controls dispatch
from `proposal-controls.tsx` (`ProposalBlockControls`), called the
same way from `block-toolbar.tsx`'s `BlockSpecificControls`. Neither
`block-renderer.tsx` nor `block-toolbar.tsx` grows a case per proposal
block type (see `component-library.md`). Public renderers live one per
file under
`lib/branding/public-blocks/proposal/`.

### Uploads

- **Images** (hero background, gallery, about-me portrait,
  testimonials): `uploadBlockImage(file, key)` in
  `app/(dashboard)/branding/upload-brand-asset.ts`. 4MB cap, `branding`
  Storage bucket, path `${userId}/${key}`.
- **Video** (hero background, video block): `uploadProposalMedia(file,
  key, options)` in `app/(dashboard)/branding/upload-proposal-media.ts`.
  50MB cap, MP4/WebM only, `proposal-media` Storage bucket (public
  read, owner-only write), progress reported via `XMLHttpRequest`
  (`fetch` has no upload-progress event). Bucket + storage policies:
  `supabase/migrations/20260924000000_proposal_surface.sql`.
- **Per-proposal cover** (D3, R7): the builder's `ProposalHeroOverride`
  (`components/builders/parts/proposal-hero-override.tsx`) uploads to
  the `branding` bucket under key `proposal-${proposalId ?? 'draft'}-hero`
  (a draft has no id yet, so the key falls back to `draft`; the URL is
  what's stored, so the key only matters for overwrite) or accepts a
  YouTube/Vimeo link, overriding the account's Proposal design cover
  for that one document only. No per-proposal video upload in Phase B
  (the block-level hero already supports one).

### Embeds

`lib/proposals/embed-url.ts`: `parseEmbedUrl(url)` accepts only
YouTube and Vimeo hosts (an explicit allowlist; every other host
returns `null`, so nothing else is ever embedded) and returns a
provider + video id; `embedIframeSrc(parsed, opts)` builds a
privacy-enhanced `src` (`youtube-nocookie.com`, Vimeo `dnt=1`), with a
`background` variant that autoplays muted and looped for hero use.

### Starters, role chooser, and variables

The role chooser (`ProposalRoleChooser`, title "What do you offer?")
shows the first time an MC opens the Proposal branding tab and asks
which services they sell: `mc`, `celebrant`, or `both`
(`ProposalRole`/`PROPOSAL_ROLE_LABELS` in `lib/proposals/types.ts`). The
choice picks a starter block tree (`proposalStarterBlocks(role)` in
`app/(dashboard)/branding/blocks/proposal-starters.ts`: hero, note,
about, how-it-works, packages, testimonials, FAQ, accept, footer, with
role-flavoured copy in the steps and FAQ) and, via
`chooseProposalRoleAction` (`app/(dashboard)/branding/proposal-role-actions.ts`),
persists the choice to `user_branding.proposal_role` and seeds two
starter packages for that role (`PROPOSAL_STARTER_PACKAGES` in
`lib/proposals/starter-packages.ts`), but only the very first time: an
MC who already owns at least one package (starter, manual, or a prior
role choice) keeps exactly what they have. The chooser is
non-dismissible (no Escape or outside-click) since there's nothing to
design before a role is picked; it never shows again once
`proposal_role` is set. It waits for the branding onboarding wizard
(`user_branding.onboarded_at` set), which asks the same question on its
Documents step; skipping the wizard leaves `proposal_role` null so the
chooser runs on the first visit to the tab.

Until a role is chosen, every fallback (`defaultBlocksFor('proposal')`,
the public page of an MC with no saved tree, the PDF, "Reset to
default") is the neutral tree `proposalNeutralBlocks()`: hero, note,
packages, accept, footer. It carries no claims about the MC, and the
testimonials template ships empty, so no invented quote or role copy can
reach a couple unless the MC chose a starter (the public renderers hide
an empty testimonials/FAQ/how-it-works block).

Variables (`lib/branding/document-variables.ts`, `PROPOSAL_DOC`):
`proposal_number`, `expiry_date`, `deposit_percent`, plus the shared
couple and business variables. **No `mc_name`** (R3): Zebri has no MC
personal-name field, only `business_name`, so a separate `mc_name`
variable would just alias it.

### PDF

"Download PDF" on `/proposals/[id]` (`proposal-pdf-button.tsx`) and the
public page's own download call the same path: `toPublicProposal(row,
branding, blocks)` (`lib/proposals/to-public.ts`) maps the dashboard's
full row to the public `PublicProposal` shape, then `printProposal`
(`components/print/print-proposal.tsx`) renders the exact same
`ProposalPage` component in the `print` frame (no reveal animation, no
playing media, no accept note): there is no second PDF layout, the
file is the link.

### Rulings (R1-R10)

Recorded in the plan header so nobody re-derives them:

- **R1.** Markers render through `PublicBlockRenderer` only when
  `doc.proposal` is present (null otherwise), instead of splitting the
  tree at each marker.
- **R2.** Storage values on blocks are public URLs (`url`,
  `posterUrl`, `portraitUrl`, `imageUrl`), matching `ImageBlock.url`,
  even where the spec says "path". `HeroOverride.imagePath` keeps its
  Phase A name and also holds a public URL.
- **R3.** `mc_name` is not a variable (see Variables above).
- **R4.** `hero` is exactly-one; `introNote`/`packages`/`accept` are
  markers (deduped, locked, clearable).
- **R5.** Toolbar controls for proposal blocks are structural (layout,
  height, overlay, add/remove items, media kind, embed URL) plus one
  `TextStyleControls` for the block's heading style. Per-target
  sub-styles are out of scope for Phase B.
- **R6.** Hero heights: `min-h-svh` / `min-h-[70svh]` / `min-h-[45svh]`
  in the page frame; 480 / 360 / 240px in document and print.
- **R7.** Per-proposal hero override is image URL or embed URL only;
  no per-proposal video upload (the block-level hero covers it).
- **R8.** A missing `proposal` entry in `enabled_surfaces` resolves to
  enabled (same rule as `lead`); the column default gains `proposal`,
  existing rows are not rewritten.
- **R9.** `useReveal` falls back to "revealed" when
  `IntersectionObserver` is undefined; the hero never animates, so the
  first paint is always visible.
- **R10.** The accept CTA opens an inline note ("reply to the email
  this proposal came with") rather than a real accept flow: the
  stepper is Phase C. The block renders the button through an
  `onAccept` slot so Phase C only swaps the handler.

## Phase C: the close (status 2026-09-14)

Built and reviewed (whole-branch + security pass), uncommitted on
`feature/proposals-engine`. Plan:
`docs/superpowers/plans/2026-09-14-proposals-engine-phase-c.md` (rulings
C1-C9 in its header; the execution rulings are summarised here).

**What exists**

- Migration `20260925000000_proposal_close.sql`: `accept_proposal`,
  `decline_proposal` (anon, share-token gated), `finalize_proposal_acceptance`
  and `expire_proposals` (service role only; PUBLIC execute revoked),
  and `get_public_proposal` extended with `pending_contract` (incl.
  `signed_at`), `invoice`, `bank_*`, `stripe_connect_enabled`, plus
  `deposit_percent` nulled when a payment schedule is chosen. The Phase A
  `proposals` policy gained owner EXISTS checks on `contract_id`,
  `invoice_id`, `contract_template_id`, `payment_schedule_id`, and every
  RPC read of those pointers is owner-matched as well.
- `POST /api/proposal/accept` (creates the draft contract from the MC's
  template via the RPC, renders and countersigns it with
  `publishContractSnapshot`, returns the couple's signer token),
  `POST /api/proposal/decline`, and a hook in `/api/contract/sign`
  (`lib/contracts/after-sign.ts`) that calls
  `lib/proposals/finalize.ts` once the signature completes: the invoice
  payload is computed server-side (`invoice-payload.ts`, shared pricing
  maths) and written atomically by the RPC (invoice, items, stages,
  proposal `accepted`, couple `confirmed`), idempotently.
- Stage precedence: explicit proposal schedule, else a Deposit + Balance
  pair from `deposit_percent`, else the MC's default schedule, else one
  full payment. The deposit the page shows is the deposit the invoice
  carries.
- Public page: `AcceptStepper` (Choose, Sign, Pay, Done) in a
  `PublicBranding`-styled `ProposalSheet`, `DeclineForm`, resume on
  reload from `deriveState` (`signing`, `paying`), and a server-side
  self-heal (`app/proposal/[token]/_lib/self-heal.ts`) that finalizes a
  signed-but-unfinalized contract on the next visit.
- MC notifications: `sendProposalAcceptedEmail`,
  `sendProposalDeclinedEmail`; alerts `proposal_accepted`,
  `proposal_declined`, `proposal_close_failed`.
- Contract variables `package_name`, `total_amount`, `deposit_amount`.
- One client signer per proposal contract: the `contracts_seed_signers`
  trigger's second partner row is dropped (D5: one light signature).
- Changing the choice before signing replaces the draft; a signed
  contract can never be re-published (`accept_proposal` returns
  `already_accepted`; `publishContractSnapshot` refuses non-drafts).
  Declining drops an unsigned draft; an MC re-save mid-close does the same.

**Deferred (cheap exit, 2026-09-14):** the expiry cron route
(`expire_proposals` has no caller yet; `vercel.json` unchanged), the
detail-page acceptance summary, the live check on the isolated server,
the Playwright journeys, the full docs sweep (page-specs, testing,
database-schema tables for the new columns), and the gate ratchet.

## Phase D: engagement

Plan: `docs/superpowers/plans/2026-09-15-proposals-engine-phase-d.md`
(rulings E1-E7 in its header, summarised below). Adds a record of what
a couple actually did on their proposal link, surfaced on the detail
page: how many times they opened it, which sections and packages held
their attention, how far they got, and how it ended.

### Events vocabulary

`lib/proposals/engagement-events.ts` defines every event the public
page can emit and validates a batch with Zod:

| Type | Payload | Meaning |
|---|---|---|
| `opened` | none | A session opened the public page. |
| `section_viewed` | `blockId`, `blockType`, `seconds` | Time spent with one page-mode block in view, reported as a delta since the last flush, not a cumulative total. |
| `package_viewed` | `optionId`, `seconds` | Same, for one packages-block option card. |
| `package_selected` | `optionId` | The couple picked an option (may change before accepting). |
| `addon_toggled` | `itemId`, `on` | An add-on switched on or off. |
| `step_reached` | `step` (`choose`, `sign`, `pay`, `done`) | Progress through the accept stepper. |
| `accepted` | none | The accept flow completed. |
| `declined` | `reason` | The decline form was submitted. |

A batch is `{ token, sessionId, events }`, at most 50 events, posted to
`POST /api/proposal/events`. Unknown types are rejected by the route's
Zod schema and dropped again by the RPC, so a tampered or stale client
can never smuggle in a type neither side recognises (E6).

**M1 (ruling, no code change):** `addon_toggled` and `declined.reason`
are captured in the table above but not read by any aggregation
function or shown anywhere on the dashboard today. The decline reason
an MC actually sees comes from `proposals.declined_reason` (Phase C),
rendered on `proposal-detail.tsx`; an add-on breakdown is a display
feature to build later, not a defect in what Phase D set out to do.
Both raw event types stay recorded so that later work has the data.

### RPC and table

`proposal_events` (migration `20260926000000_proposal_events.sql`):
`proposal_id`, `user_id`, `session_id`, `type`, `payload` (jsonb),
`created_at`, `client_event_id` (text). Owner-only RLS plus a
parent-ownership `exists` check on insert (same shape as
`proposal_options`); see `security.md` for the full row and
`database-schema.md` for the column table.

**Idempotency.** `client_event_id` is a client-generated id, stamped
once per event when the public page's tracker queues it (`newEventId`
in `engagement-session.ts`), not when it flushes. A unique index on
`(proposal_id, client_event_id)` means a retried batch (the tracker
requeues a batch it believes failed to post: an unload-time keepalive
racing navigation, a proxy that times out after the origin already
committed, sendBeacon's own ambiguity about delivery) inserts nothing
the second time instead of duplicating rows. This matters most for
`section_viewed`/`package_viewed`, whose duplication would double-count
banked reading seconds, and for the discrete `accepted`/`declined`/
`step_reached` rows. The column defaults to a random value so a row
seeded directly rather than through the RPC (the owner's own tooling,
or a test) never needs to supply one.

`record_proposal_events(p_token, p_session_id, p_events)` is
`security definer`, granted to `anon`. It locks the target proposal row
(`for update`) before reading whether an `opened` event already exists,
so two tabs flushing in the same second can never both report a first
open; inserts every event whose type is known and whose `id` is present
and well-formed, `on conflict (proposal_id, client_event_id) do
nothing` (a missing or malformed id is dropped, same as a malformed
payload); and returns `{ ok: true, inserted, first_open }`, where
`inserted` counts only rows the insert actually wrote, so a full replay
reports 0. `first_open` is true only when no `opened` row existed
before this call (read from the table itself) AND this call actually
inserted one: a batch whose only `opened` event was dropped (bad id,
bad payload, or a replayed id that conflicted) never reports a first
open it did not actually record. `POST /api/proposal/events` (Task 3)
sends `sendProposalOpenedEmail` and `sendAlert('proposal_opened')` when
`first_open` is true, after the response has been sent (`after()`,
from `next/server`). See `alerts.md` and `security.md` for the
notification and RPC inventory entries.

Because the RPC is directly callable with the public anon key (the
route's own Zod schema and rate limit are bypassable by anyone holding
a share token), it re-asserts its own bounds rather than trusting the
route to have run:

- **The proposal's own MC is a no-op (C1).** When `auth.uid()` (the
  caller's JWT, resolved even inside a `security definer` function)
  equals the proposal's owner, the RPC records nothing and returns
  `{ ok: true, inserted: 0, first_open: false }`. Without this, the MC
  clicking their own "Open" button to preview a sent proposal consumes
  the one and only `first_open`, so the MC gets emailed and Slacked
  about their own click and the couple's real first open is never
  announced.
- **Payload shape and size (M4).** A single event's `payload` must be a
  plain JSON object no larger than 2048 bytes (a genuine payload is well
  under 200); anything else is dropped, silently, without failing the
  rest of the batch.
- **Duration clamp (M4).** Any `seconds` field in a payload is clamped
  to 0-3600 (one hour), mirroring the route's own Zod bound but
  re-asserted in the RPC since the route cannot be relied on to have run.
- **Per-proposal row ceiling (M4).** Once a proposal already has 20000
  stored events, a further batch is accepted (so a sender's own retry
  logic never sees an error) but writes nothing, reporting
  `{ ok: true, inserted: 0, first_open: false }`.

### Tracker (public page)

The public page (`app/proposal/[token]/_components/`) watches which
blocks and package cards are visible, banks whole seconds per id while
they are, and flushes batches through the events route; choice and
step events reach it from the existing accept-flow hook, page component
and decline form through a small in-page bus (`engagement-bus.ts`)
rather than new props, since those files are already near their size
budget (E5). Disabled in print/preview: a downloaded PDF or the print
frame never emits events.

### Detail page

`/proposals/[id]` reads the raw rows with `useProposalEvents` (React
Query over `proposal_events`, capped at 5000 rows) and aggregates them
client-side, purely, with `lib/proposals/engagement.ts`
(`summarizeEngagement`) and `lib/proposals/engagement-sessions.ts`
(`sessionTimelines`):

- **`ProposalEngagement`**: a facts line ("2 sessions · first opened 15
  Sep · last active 15 Sep · 4m 12s reading"), the top four sections as
  horizontal bars sized against the largest, the package the couple
  lingered on longest, the furthest accept-stepper step reached, and
  the outcome pill (Accepted / Declined) once there is one -- rendered
  whenever that data exists, not only when there are section rows
  (M7). "Sessions" here is every distinct `session_id` among the rows
  (E4, revised by C2), which is not the same number as the facts line's
  own `view_count` above it (every RPC read, including the self-heal
  double read): the two coexist deliberately, so the labels say
  "sessions"/"last active" rather than repeating "views"/"last seen"
  next to a different number (M6).
- **`ProposalEngagementTimeline`**: one calm list, newest session
  first, capped at 20 sessions (E7): when it happened, how long it
  lasted, the package chosen, and the furthest step, with that
  session's own top three sections underneath in muted text.

Both are token/primitive-only (`Loading`, `Empty`, `StatePill`) and
render nothing (`Empty`, "No opens yet") until the first session opens.
`blockTypeLabel`/`stepLabel`/`formatSeconds` (`lib/proposals/engagement-labels.ts`)
supply the MC-facing copy; block-type labels mirror `BLOCK_LABELS` in
`app/(dashboard)/branding/blocks/types.ts` (e.g. `introNote` reads
"Personal note") rather than inventing a second name for the same block.

### Rulings (E1-E7)

- **E1.** `section_viewed` carries `blockType` alongside `blockId`;
  `package_viewed` carries `optionId` only. The dashboard has no block
  tree to join against, so the type label is what the tracker sends.
- **E2.** Time is reported as deltas, not cumulative totals, so a lost
  batch only loses its own slice; aggregation is a plain sum.
- **E3.** `first_open` is true only when the batch inserted the first
  `opened` event the proposal has ever had (computed under the row
  lock). The route sends the first-open email/alert on that flag.
- **E4 (revised by C2).** "Sessions" on the detail page means every
  distinct `session_id` among a proposal's rows, not only sessions with
  a surviving `opened` event: a session whose `opened` was lost to a
  dropped POST (C2) still produced real rows, and hiding the whole
  session because one event out of many did not land is worse than
  counting it. `view_count` stays the raw RPC-read counter, and the two
  numbers are labelled differently on screen so they never read as a
  contradiction (M6).
- **E5.** Choice and step events reach the tracker through a small bus
  rather than new props, keeping `use-accept-flow.ts` and
  `proposal-page.tsx` at their size budget.
- **E6.** Unknown event types are rejected by the route's Zod schema
  and dropped again by the RPC; a batch of 0 or more than 50 events is
  a 400.
- **E7.** The timeline shows the last 20 sessions, newest first; the
  summary aggregates every row.

### Fix wave (2026-09-15, whole-branch review)

A whole-branch review of Phase D found 2 Critical and 8 Major findings
before this landed; all but two are fixed (see `C1`/`C2`/`M3`-`M7`/`m1`-`m7`
above and inline in the code they touch). Two are deliberate rulings with
no code change:

- **M1.** `addon_toggled` and `declined.reason` stay write-only for now
  (see the events vocabulary table above).
- **M8.** No Playwright e2e coverage for the engagement feature yet,
  consistent with deferring e2e for this batch; see `testing.md`.

## Gotchas

- **The share link is off until send.** `share_token_enabled` defaults
  false; `get_public_proposal` returns null for a draft's token, which
  the public page turns into a plain 404. There is no way to preview
  the public page before the first send.
- **Editing after send bumps the version and re-arms `sent`.** A saved
  edit on a `sent`/`viewed` proposal clears any partial acceptance or
  decline state and resets status to `sent`, on the assumption that an
  edited proposal needs a fresh look. This is silent: nothing prompts
  the MC that editing un-declines a declined proposal (Phase C behaviour).
- **`accepted` is locked.** Once accepted, the builder disables the
  couple picker, the title, and every part; the detail page hides Edit
  entirely. There is no "unaccept".
- **`PaymentsTableItem` was widened to `{ id: string }`.** The shared
  `PaymentsTable` (also used by Invoices/Contracts) originally assumed
  a richer row shape; proposals only need the row's `id` for the click
  handler, so the generic constraint was relaxed rather than padding
  `ProposalListRow` with fields it doesn't have.
- **Two FK paths exist between `proposals` and `proposal_options`**
  (`proposal_options.proposal_id` and `proposals.accepted_option_id`).
  Any PostgREST embed of options from a proposals query must hint the
  relationship explicitly
  (`proposal_options!proposal_options_proposal_id_fkey(...)`) or it
  fails with `PGRST201`.
- **The "New proposal" button needs its own `aria-label`.** Its visible
  label collapses to icon-only below `sm`; without an explicit
  `aria-label="New proposal"` the button had no accessible name at all
  on a phone viewport.

# Templates master-detail + preview — design

**Date:** 2026-06-27
**Status:** Approved (architecture + per-tab breakdown), pending spec review
**Surface:** `/templates` (`app/(dashboard)/templates/`)

## Goal

Turn each Templates tab from a single-column list into a **master-detail
layout**: a narrow list on the left, a read-only **preview pane** on the
right showing the selected template. Selecting a row previews it; editing
still happens through the existing editor modal. Applies to all seven tabs
(Emails, Packages, Quotes, Invoices, Timelines, Contracts, Questionnaires).

Reference mockup: Emails tab — left list grouped by lifecycle stage, right
pane rendering the email subject/body with variables shown as labelled
chips, header with `Duplicate · Edit template · ⋯` actions and an
"Edited X ago" line.

## Decisions (locked)

- **Approach A** — one shared responsive shell, per-tab list + preview.
- **Edit flow** — preview is read-only; `Edit` opens the **existing**
  editor modal per tab (no inline editing). Reuses all current editor code.
- **Where-used / automation badges** — **deferred** to a follow-up PR
  (needs a new `automation_actions` JSON query). Not in this build.
- **CTA buttons in email previews** — out of scope (email templates don't
  support CTA blocks today).
- **Mobile** — list view; selecting a row shows a full-screen preview with
  a `←` back bar that clears selection.

## Architecture

### Shared shell — `TemplatesTwoPane`

New component: `app/(dashboard)/templates/templates-two-pane.tsx`.

Owns the responsive split and the mobile list↔preview switch. It is a dumb
layout primitive — it holds no data and no selection state.

```ts
interface TemplatesTwoPaneProps {
  /** Left master list (grouped or flat — the tab decides). */
  list: ReactNode
  /** Right detail/preview for the selected item, or a placeholder. */
  detail: ReactNode
  /** True when an item is selected (drives the mobile full-screen switch). */
  selected: boolean
  /** Clears selection — wired to the mobile back arrow. */
  onBack: () => void
}
```

Layout:
- Desktop (`lg+`): `flex` row. Left pane `w-[clamp]` (~360px, `shrink-0`,
  `border-r border-border`, own `overflow-y-auto`). Right pane `flex-1`,
  own `overflow-y-auto`.
- Mobile (`< lg`): render **one** pane at a time. `selected === false` →
  list. `selected === true` → a back bar (`← Back`) above the detail,
  full width.
- The shell sits inside the existing content area (below the tab row).
  The tab-row search + actions stay portaled via `TemplatesActions`
  (unchanged).

### Per-tab ownership

Each manager keeps its data hooks/mutations exactly as today and adds:

- `const [selectedId, setSelectedId] = useState<string | null>(null)`
- Auto-select the first visible item once data loads (and re-resolve when
  the selection is filtered out by search or removed by delete: fall back
  to the first visible item, else `null`).
- Renders `<TemplatesTwoPane list={…} detail={…} selected={!!selectedId}
  onBack={() => setSelectedId(null)} />`.
- Clicking a list row calls `setSelectedId(id)` instead of opening the
  editor modal. The editor modal is now opened from the **preview pane's**
  `Edit` action.

### Selection + search interaction

- The existing toolbar search still filters the **list** (`visible`).
- Selection is independent of search. If the selected item is filtered out
  of `visible`, the preview still shows it (selection is not cleared by
  typing); but auto-select-first only runs when nothing valid is selected.
- Drag-reorder (Packages/Quotes/Invoices/…) is unchanged and still
  disabled while searching (existing behavior).

## Left list per tab

- **Emails** — grouped by lifecycle stage with quiet section headers
  (`ENQUIRY`, `QUOTE`, `BOOKING`, `PLANNING`, `WEDDING WEEK`, `FOLLOW-UP`),
  rows = mail icon + name + subtitle. Reuses the existing grouping logic in
  `templates-library.tsx`; rows become selectable (highlight the selected
  row) and lose their inline overflow menu (actions move to the preview
  header; keep Duplicate/Delete reachable from the preview `⋯`).
- **All other tabs** — flat, drag-sortable list (unchanged dnd), compact
  rows in the narrow pane. Row click selects.

Selected-row styling: subtle card highlight (`bg-surface`/border or
`bg-surface-muted`), matching the mockup's highlighted row. Tokens only.

## Right preview per tab

Shared preview header (small component, e.g. `preview-header.tsx`):
- Title (template name) + optional meta chip (Emails: lifecycle stage;
  line-item tabs: total) + "Edited {relativeTime(updated_at)}".
- Actions: `Duplicate`, `Edit` (opens that tab's existing editor modal),
  and a `⋯` overflow with `Delete` (and Duplicate on mobile).

Preview bodies:
- **Emails** → email preview. Subject + body rendered with variables shown
  as **labelled chips** (not filled sample values). Reuses the existing
  TipTap → HTML render path (`lib/email/templates.ts` /
  `template-preview.tsx`) with a chip presentation for mention nodes and
  subject tokens. Chip styling uses tokens (brand/indigo pill).
- **Packages / Quotes / Invoices** → existing `LineItemPreview`
  (`app/(dashboard)/templates/line-item-preview.tsx`).
- **Questionnaires** → existing `questionnaire-preview.tsx`.
- **Timelines** → new small run-sheet preview: ordered list of items
  (time · title · duration · description). ~1 small component.
- **Contracts** → read-only render of the rich-text body (TipTap content
  → HTML, or `RichTextEditor` with `editable={false}`). ~1 small component.

## States

- **Loading** — existing per-tab skeletons (left pane); right pane shows a
  matching skeleton or the placeholder.
- **No items at all** — the centered empty state (current behavior),
  spanning the full content area (no split).
- **Items, none selected** (desktop only, transient before auto-select) —
  right pane shows a quiet "Select a template to preview" placeholder.
- **No search matches** — left pane shows the existing "No matches." line;
  the preview keeps showing the last selected item.
- **Error** — existing error handling per tab.

## Components added / changed

Added:
- `templates-two-pane.tsx` — responsive shell.
- `preview-header.tsx` — shared preview header (title/meta/actions).
- `timeline-template-preview.tsx` — run-sheet preview.
- `contract-template-preview.tsx` — read-only contract body.
- (Emails) an email preview wrapper that renders variables as labelled
  chips, if the existing `TemplatePreview` can't be configured for it.

Changed (each gains `selectedId` + two-pane wiring, row-click selects,
Edit moves to preview):
- `emails-tab.tsx` (+ `templates-library.tsx` becomes the left list)
- `packages-manager.tsx`
- `quote-template-manager.tsx`
- `invoice-templates-manager.tsx`
- `timeline-template-manager.tsx`
- `contract-template-manager.tsx`
- `questionnaire-template-manager.tsx`

Unchanged: the editor modals, data hooks/mutations, the tab-row toolbar +
search slot, starter catalogs.

## Non-goals / out of scope

- Automation usage badges and the "Where it's used" section (follow-up).
- CTA buttons in email previews.
- Inline editing in the preview pane.
- Any schema/migration change (purely frontend; reuses existing data).

## Testing

- Unit/RTL: row-click selects and renders the matching preview;
  auto-select-first on load; delete falls back to first item; search
  filters the list but keeps the selection visible.
- E2E (desktop + mobile, per testing.md): select a template → preview
  shows; Edit opens the modal; mobile shows full-screen preview with a
  working back arrow.
- Design-system: tokens + primitives only; no off-token colours; explicit
  loading/empty/error states; works on Pixel 5 + iPhone 12.
- Gates: `typecheck` 0, `lint:gate` within budget, components ≤ ~150 lines
  (split previews/list out of the managers to stay under).

## Risks

- The seven managers are large; keep changes mechanical and shared logic in
  the shell to avoid per-file drift.
- Variable-as-chip rendering for emails must not regress the editor's live
  preview (which fills sample values) — the chip view is a separate
  presentation, not a change to the editor.
- Left-pane width on mid-size screens: ensure the list stays readable and
  the preview doesn't get too narrow (test at `lg` breakpoint).

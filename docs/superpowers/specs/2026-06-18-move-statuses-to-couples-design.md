# Move Statuses management from Settings → Couples page

**Date:** 2026-06-18
**Status:** Approved (design), pending implementation

## Goal

Relocate the couple-status management UI (rename, recolor, reorder,
add, delete statuses) out of the Settings page and onto the Couples
page, where the statuses are actually used (they define the Kanban
columns, list badges, filters, and the couple-modal selector). Open it
from a gear button in the Couples header via a centered modal.

This is a **pure UI relocation**. No backend, schema, RLS, or
data-hook changes.

## Scope

In scope ("just the move"):
- Remove the Statuses tab + section from Settings.
- Add a gear button to the Couples header that opens the Statuses
  editor in a modal.
- Relocate the editor into `couples/`, split into smaller files (the
  current file is 417 lines vs the ~150-line guideline).
- Verify it builds and runs.

Out of scope:
- The `couple_statuses` table, migration, RLS, and the
  `use-couple-statuses.ts` React Query hooks — untouched.
- New automated tests and full Definition-of-Done hardening (can be a
  later pass).

## Current state

- **Settings tab:** `app/(dashboard)/settings/page.tsx`
  - `tabs` array line 77: `{ id: "statuses", label: "Statuses" }`
  - Render line 230: `{activeTab === "statuses" && <StatusesSection />}`
- **Editor:** `app/(dashboard)/settings/statuses-section.tsx` (417 lines)
  - `StatusRow` (lines 39–143): draggable row — name input, color
    popover, delete.
  - `StatusesSection` (lines 145–417): dnd-kit reorder, save-changes,
    add-status `<Modal>` + form.
- **Hooks (stay put):**
  `app/(dashboard)/couples/use-couple-statuses.ts` — `useCoupleStatuses`,
  `useCreateStatus`, `useUpdateStatus`, `useDeleteStatus`,
  `useReorderStatuses`.
- **Couples header:** `app/(dashboard)/couples/couples-header.tsx` —
  toolbar with search / filter / sort and the List/Board view tabs.
  Already receives `statuses`.
- **Couples page:** `app/(dashboard)/couples/page.tsx` — composes
  `CouplesHeader` (line 269) and owns view/modal state.

## Design

### New files (under `app/(dashboard)/couples/`)

| File | Responsibility | ~lines |
|------|----------------|--------|
| `statuses-editor.tsx` | Main editor: data hooks, local-state, dnd context, save-changes, list of rows, "Add status" trigger. Exports `StatusesEditor`. | ~150 |
| `status-row.tsx` | The single draggable `StatusRow` (drag handle, name input, color popover, delete). | ~110 |
| `add-status-modal.tsx` | The "Add New Status" modal + create form (name + color popover). | ~90 |
| `statuses-modal.tsx` | Thin modal shell: wraps `StatusesEditor` in the shared `Modal`, titled "Manage statuses". Exports `StatusesModal({ isOpen, onClose })`. | ~30 |

The editor body is lifted verbatim from `statuses-section.tsx` — same
hooks, same handlers, same toast behavior — just decomposed and with
the outer `max-w-2xl` section chrome dropped (it now lives in a modal).
The intro copy ("Customise the statuses that appear in your couples
kanban board") is kept as a subtitle in the modal.

### Couples header change

`couples-header.tsx`:
- Add a gear icon button (`Settings2` from lucide, `size` matching the
  adjacent toolbar icons, `strokeWidth={1.5}`, `rounded-md`/`rounded-xl`
  per surrounding style, `cursor-pointer`) in the toolbar's right-side
  group, before/alongside the "New couple" button so it's visible in
  both List and Board views.
- New prop `onManageStatuses: () => void`, invoked on click.

### Couples page change

`page.tsx`:
- Add `const [statusesOpen, setStatusesOpen] = useState(false)`.
- Pass `onManageStatuses={() => setStatusesOpen(true)}` to
  `CouplesHeader`.
- Render `<StatusesModal isOpen={statusesOpen} onClose={() =>
  setStatusesOpen(false)} />` alongside the other couples modals.

### Settings page change

`settings/page.tsx`:
- Remove the `{ id: "statuses", label: "Statuses" }` entry from `tabs`.
- Remove the `{activeTab === "statuses" && <StatusesSection />}` render.
- Remove the now-unused `StatusesSection` import.
- Delete `settings/statuses-section.tsx`.
- If `"statuses"` was a reachable deep-link, no redirect is added
  (out of scope); the default tab handles unknown values.

## Data flow

Unchanged. The editor calls the same `use-couple-statuses` hooks, which
hit the `couple_statuses` table under existing RLS. React Query cache
invalidation already drives the Kanban/list/filter/modal to refresh, so
opening the manager from the Couples page (rather than Settings) means
edits reflect immediately in the board behind the modal.

## Design-system notes

- Use the shared `@/components/ui/modal` `Modal` (already used by the
  add-status form) for the shell.
- Gear icon `strokeWidth={1.5}`; buttons `rounded-xl`/`rounded-md` to
  match neighbors; interactive elements `cursor-pointer`.
- The relocated code keeps its current raw-Tailwind styling (faithful
  move); token/primitive cleanup is deferred to a hardening pass.

## Verification

- `npm run typecheck` stays at 0 errors.
- App builds; open Couples → gear → modal; rename/recolor/reorder/add/
  delete a status and confirm the board reflects it; confirm the
  Statuses tab is gone from Settings.

## Risks / notes

- `statuses-section.tsx` currently carries no TSDoc; new split files
  should get TSDoc on exports per the repo comment style.
- The 417→split keeps each file under the ~150-line guideline.

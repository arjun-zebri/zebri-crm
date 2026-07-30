# Zebri Component Library

This file defines the **core reusable UI components** for Zebri.

Claude should always prefer these components instead of creating new UI
patterns.

Goal: Consistency, speed, and minimal design.

---

## Core form primitives (Phase 0.5.5)

Use these everywhere instead of raw `<button>` / `<input>` / `<select>` markup —
they share the same token vocabulary so brand changes propagate
automatically.

### `<Button />` — `@/components/ui/button`
Variants: `primary` (brand-fg / inverse text), `secondary` (subtle grey fill +
border), `outline` (white fill + border), `ghost` (transparent), `danger`,
`success`. Sizes: `sm` / `md` / `lg`. `loading` shows a spinner,
sets `aria-busy`, and disables the click. Defaults `type="button"` to avoid
accidental form submits.

### `<Input />` — `@/components/ui/input`
Labelled input with optional `help` and `error`. All accessible wiring
(`htmlFor`/`id`, `aria-describedby`, `aria-invalid`, `role="alert"` on the
error) is built in — pass a `label` and trust the primitive.

### `<Select />` — `@/components/ui/select`
Built on Radix Select for full keyboard + screen-reader support, styled to
match `<Input />`. Pass an `options: { value, label }[]` array and a
controlled `value` + `onValueChange` (or uncontrolled `defaultValue`).
Standalone (no companion components to import).

### `<Checkbox />` — `@/components/ui/checkbox`
Custom `<button role="checkbox">` per the frontend-design §Checkboxes
spec (emerald fill + white checkmark when checked) — never a native
`<input type="checkbox">`. Takes controlled `checked` + `onChange`
and an optional clickable `label`. Always visible (form variant);
table rows keep their own hover-reveal selection checkbox.

### `<AddressAutocomplete />` — `@/components/ui/address-autocomplete` (Phase 14, onboarding)

Address search + autocomplete using Google Places API. Extracted from Settings page during onboarding wizard work. Props:

- `value: string` — current search input text
- `onChange: (v: string) => void` — fires on every keystroke (with `null` coordinates during typing)
- `onSelect: (place: PlacePrediction) => void` — fires when user picks a place from the dropdown (includes resolved lat/lng)
- `placeholder?: string` — input placeholder text
- `className?: string` — wrapper class override

Internal state mirrors the value so it survives parent re-renders during async coordinate resolution. The Places API call happens on `onSelect` (per-place); coordinate resolution completes asynchronously and does not block the `onSelect` callback.

Conventions:
- All of the above use design tokens only — no raw hex / arbitrary values.
- Unit-tested in `tests/unit/components/ui/{button,input,select,checkbox}.test.tsx`.
- Existing raw-button / raw-input call sites stay until each page is
  hardened (per-page adoption, consistent with the ratchets).

---

## Foundational primitives (Phase 0.5)

Every page's Definition of Done requires an explicit **loading**, **empty**,
and **error** state. Use these primitives rather than ad-hoc spinners /
"No data" text / inline error banners.

### `<Loading />` — `@/components/ui/loading`
Accessible (`role="status"`), centered or inline, optional label. Use for
any pending fetch / mutation. Drives the loading branch of every data view.

### `<Empty />` — `@/components/ui/empty`
Empty-state for lists / collections. Always pass an `action` that lets the
user move forward (the only valid empty state without an action is a
deliberately read-only surface). Optional `icon` from `lucide-react`.

### `<ErrorState />` — `@/components/ui/error-state`
Accessible (`role="alert"`). Pass `error` (an `Error`) or `description`;
always include a recovery path via `onRetry` (default "Try again" button) or
a custom `action`. **Never** render `error.stack` — only `.message`, and
only when it is human-safe (no PII).

### `<StatePill />` — `@/components/ui/state-pill` (Phase 2C.2)
Shared tonal pill used wherever a "what state is this thing in?"
badge appears (Billing tab, Quote modal, Invoice modal, payment-
schedule stages). 5 tones (`neutral` / `info` / `success` / `warning`
/ `danger`) + optional leading dot (`'filled'` for active states,
`'hollow'` for due states). Tonal background via `bg-{tone}/10
text-{tone}`. Never use raw `bg-emerald-50 text-emerald-600` etc. —
the pill is the canonical surface.

Conventions:
- All four honour the design tokens (`text-text`, `text-text-muted`,
  `text-danger`, `text-body`, `text-section`, `bg-success/10`, …).
  Don't override with raw hex.
- Unit-tested under `tests/unit/components/ui/{loading,empty,
  error-state,state-pill}.test.tsx`.

## Builder parts — `components/builders/parts/*` (Phase 2C.2)

Shared subcomponents used to compose the Quote + Invoice builder
modals. Each one is purely presentational with callbacks for state
changes; the parent modals own the actual form state + mutations.

| Part | Used by |
|---|---|
| `builder-modal-shell.tsx` | Modal frame + hero title input + state pill + ⋯ overflow menu + contextual primary CTA |
| `builder-meta-row.tsx` | Couple picker + payment terms (invoice) + expiry / due date |
| `line-items-table.tsx` | description + amount table; dnd-kit reorder; empty-state CTA |
| `totals-panel.tsx` | Subtotal / (optional) Discount / (optional) GST / Total |
| `discount-control.tsx` | Collapsed "+ Add discount" link → inline editor with % / $ switch |
| `tax-control.tsx` | "+ Apply 10% GST" toggle |
| `notes-field.tsx` | Tokenised textarea wrapper |
| `share-and-send.tsx` | Footer: share-link affordance + Save + primary "Send to couple" CTA |
| `payment-schedule.tsx` | Vertical-timeline schedule for invoices (deposit ┊ final) |
| `template-picker.tsx` | Quote templates — empty-state card + inline popover variants |
| `builder-preview-pane.tsx` | Right pane: PDF / Email / Payment page tabs + "Update branding" link (Phase 2C.2 redesign) |
| `preview-pdf.tsx` | PDF preview — renders `buildPdfHtml()` output in a sandboxed iframe |
| `preview-email.tsx` | Email preview — `From/To/Subject` envelope + `quoteHtml()`/`invoiceHtml()` body in a sandboxed iframe |
| `preview-payment-page.tsx` | Payment-page preview — uses `PublicBlockRenderer` with `useCurrentBranding(surface)` for pixel-faithful render |
| `preview-shared.ts` | The `PreviewDoc` shape the parent modals pass into every preview tab |

All parts are ≤200 LOC, TSDoc'd, and unit-tested under
`tests/unit/components/builders/parts/*.test.tsx`.

## Public Blocks components — `components/public-blocks/*` (Phase 11)

Shared branded surface renderers. Each public surface (quote, invoice, contract, proposal, vendor timeline, questionnaire) consumes a block tree and renders it with the MC's branding (colours, fonts, corner radius, spacing).

**Slots + Chrome Pattern:** The public component is the sole markup source. The editor injects `InlineText` slots (for editable fields: business name, heading, button text) as React node props. The editor's toolbar is a chrome overlay sitting above the public renderer without modifying DOM structure. **Two binding amendments:**
1. Slots always render, even if empty (undefined slots render as nothing, not errors).
2. Editor slot classes match static classes exactly (`edit-mode-{fieldName}` class prefix) — ensures clicking a slot in the preview reflects the edit without layout flicker.

| Component | Used by | Notes |
|---|---|---|
| `public-block-renderer.tsx` | All surfaces | Orchestrator: renders a block tree by type (HeaderBanner, BusinessName, Text, Image, Spacer, Divider, Footer, Action, and surface-specific fixed cores). |
| `header-banner.tsx` | All surfaces | Header image + overlay gradient. |
| `business-name.tsx` | All surfaces | Logo + business name + tagline. |
| `action-block.tsx` | Quote, Invoice, Proposal | Accept/Download/etc button. |
| `text-block.tsx` | All surfaces | Rich text with font/colour overrides. |
| `image-block.tsx` | All surfaces (chrome) | Image with fit, focal point, rounding, padding. |
| `spacer-block.tsx` | All surfaces (chrome) | Vertical spacing. |
| `quote-body.tsx` | Quote surface (fixed) | Renders proposal options + acceptance flow. |
| `invoice-items.tsx` | Invoice surface (fixed) | Line items + totals + payment schedule. |
| `contract-body.tsx` | Contract surface (fixed) | Contract text content. |

**Shared helper:** `upload-brand-asset(file, type)` in `lib/branding/upload.ts` handles logo/favicon/header/image uploads to Supabase Storage (`branding/{user_id}/{type}`), returns a public URL via signed URL (1-hour TTL cached in-memory). Used by the editor's file picker, brand-panel upload controls, and image-block drag-drop.

## Events components — `components/events/*` (Phase 4A)

Shared event-related components used by the couples profile + the
standalone `app/(dashboard)/events/[id]/timeline` route. Lifted out
of the `app/(dashboard)/events/` route group in Phase 4A (recon
§7.7) so the route group no longer holds shared component modules.

| Component | Notes |
|---|---|
| `event-overview.tsx` | Read-only summary card for an event row (date / venue / status). |
| `event-vendors.tsx` | Contact-link manager. Imports `ContactPicker` from `app/(dashboard)/couples/`. |
| `event-tasks.tsx` | Per-event task list. |
| `event-timeline.tsx` | TipTap-rich timeline editor for an event. |
| `event-timeline-modal.tsx` | Create/edit timeline-item modal. Also exports `TimePicker`. |
| `event-timeline-share.tsx` | Share-link affordance for an event timeline. |
| `event-day-calendar.tsx` | Day-grid calendar visualisation of timeline items. |
| `event-profile.tsx` | Full-screen event-detail modal with overview/vendors/tasks/timeline tabs. |

---

# Core Components

## Button

Primary CTA button.

Styles: - bg-black - text-white - rounded-xl - px-4 py-2 -
hover:bg-neutral-800 - transition - cursor-pointer

Variants: - primary - secondary - ghost

Props: variant size icon loading disabled

---

## Input

Standard text input.

Styles: border border-gray-200\
rounded-xl\
px-3 py-2\
focus:ring-2\
focus:ring-green-200

Props: label placeholder value onChange error

---

## Select (Custom)

A fully custom dropdown select component used across Zebri instead of the native HTML <select>.

This component should provide a modern SaaS-style searchable dropdown that matches the rest of the UI system.

Native <select> elements should not be used anywhere in Zebri.

The Select component should be built using a combobox pattern.

Recommended libraries:

@radix-ui/react-popover - cmdk - lucide-react

Structure:

Button Trigger
Popover
Search Input
Options List

The Select trigger should visually match the Input component.

Trigger styles:

border border-gray-200 - rounded-xl - px-3 - py-2 - bg-white - flex - items-center - justify-between - text-sm

Focus state:

ring-2 - ring-green-200

Dropdown menu styles:

bg-white - border - rounded-xl - shadow-lg - max-h-60 - overflow-y-auto p-1

Option styles:

px-3 - py-2 - rounded-md - cursor-pointer - hover:bg-gray-50

Selected option:

bg-green-50 - text-green-700

---

## Card

Used for dashboard modules and containers.

Styles: bg-white\
border\
rounded-xl\
shadow-sm\
p-6

Props: title description actions

---

## Table

Used for lists such as Couples, Vendors, Events.

Built using: tanstack-table

Features: sorting\
pagination\
search

Style: Notion-style clean table. No card wrapper (no border/rounded-xl container). White header with bottom border, sentence-case text. No clickable sort on table headers (sorting via header toolbar dropdown). Plain text pagination (Previous/Next). Rows: hover:bg-gray-50.

Table styling rules:
- Container: `flex flex-col flex-1 overflow-hidden`, inner `overflow-y-auto overflow-x-auto flex-1`
- Table element: `w-full table-fixed min-w-[400px] md:max-w-[1800px]`
- Header row: `sticky top-0 bg-white z-10`, `border-b border-gray-200`
- Header cells: `px-3 md:px-6 py-3 text-left text-sm font-medium text-gray-900`
- Body rows: `border-b border-gray-100 last:border-0 cursor-pointer transition hover:bg-gray-50`
- Body cells: `px-3 md:px-6 py-3.5 text-sm overflow-hidden`
- Skeleton loading: inside tbody, 5 rows, `animate-pulse`, `h-4 bg-gray-100 rounded-md`
- Pagination: `px-6 py-3 border-t border-gray-100 text-sm`, Previous/Next text buttons
- Column visibility: use `meta: { hidden: "hidden sm:table-cell" }` (or `lg:`) on column defs, apply via `(col.columnDef.meta as any)?.hidden` in `<th>` and `<td>` classNames

---

## Badge

Status indicator with colored dot prefix. Uses `rounded-full`, `px-2 py-0.5`, `text-xs font-medium`.

Variants (Couple status):

- `new`: amber-50 bg, amber-700 text, amber-400 dot
- `contacted`: blue-50 bg, blue-700 text, blue-400 dot
- `confirmed`: purple-50 bg, purple-700 text, purple-400 dot
- `paid`: emerald-50 bg, emerald-700 text, emerald-400 dot
- `complete`: gray-100 bg, gray-600 text, gray-400 dot
- `default`: gray-50 bg, gray-600 text, gray-400 dot

Variants (Vendor category):

- `venue`: rose-50 bg, rose-700 text, rose-400 dot
- `celebrant`: violet-50 bg, violet-700 text, violet-400 dot
- `photographer`: sky-50 bg, sky-700 text, sky-400 dot
- `videographer`: indigo-50 bg, indigo-700 text, indigo-400 dot
- `dj`: fuchsia-50 bg, fuchsia-700 text, fuchsia-400 dot
- `florist`: pink-50 bg, pink-700 text, pink-400 dot
- `hair_makeup`: orange-50 bg, orange-700 text, orange-400 dot
- `caterer`: amber-50 bg, amber-700 text, amber-400 dot
- `photo_booth`: teal-50 bg, teal-700 text, teal-400 dot
- `lighting_av`: cyan-50 bg, cyan-700 text, cyan-400 dot
- `planner`: lime-50 bg, lime-700 text, lime-400 dot
- `other` (vendor): gray-50 bg, gray-600 text, gray-400 dot

---

## Modal

Centered modal dialog. `rounded-2xl shadow-xl max-w-lg max-h-[85vh]`, centered with `flex items-center justify-center`. Footer has `rounded-b-2xl bg-gray-50`. All modals now have `role="dialog"` for accessibility (app-wide change in Phase 14).

Used for: - create couple - create task - edit vendor - welcome onboarding

Features: overlay background escape to close click outside to close

---

## Sidebar

Main navigation.

Contains: Dashboard, Couples, Vendors, Settings

Desktop: fixed 68px icon-only, expands to 240px on hover (`group/sidebar` pattern). Nav labels hidden via `md:opacity-0 md:group-hover/sidebar:opacity-100`.

Mobile: hidden by default (`-translate-x-full`), opens as a 280px left drawer when `mobileOpen` prop is true. Labels always visible on mobile (`opacity-100`).

Props:
- `mobileOpen?: boolean`  -  controls mobile drawer visibility
- `onMobileClose?: () => void`  -  called when backdrop or any nav Link is clicked

Mobile top bar is rendered in `DashboardLayout` (not in Sidebar): fixed h-14, z-30, hamburger + centered logo.

---

## Command Palette

Keyboard shortcut: Cmd + K

Functions: - create couple - create task - search vendors - navigate pages

Style inspired by: Linear / Vercel

---

## VendorPicker

Reusable inline vendor picker component used in both couple and event vendor assignment workflows.

Purpose: Allow users to search active vendors and add them to a couple or event.

Props:
- `excludeVendorIds: string[]`  -  vendor IDs already assigned (excluded from search results)
- `onAdd: (vendorId: string) => void`  -  callback when user selects a vendor
- `onClose: () => void`  -  callback to close the picker
- `isAdding: boolean`  -  loading state while mutation is pending

Styles:
- Container: `border border-gray-200 rounded-xl bg-white shadow-sm p-3`
- Search input: matches standard Input styles with focus:ring-2 focus:ring-green-200
- Vendor rows: text-left, p-2, hover:bg-gray-50, rounded-xl
- Empty state: centered gray text
- Close button (X) top-right of search bar

Behavior:
- Fetches all active vendors for the current user
- Filters client-side by vendor name as user types
- Excludes already-assigned vendors
- Shows vendor name + category badge
- Max height with scrollable overflow
- Inline presentation (does not open a modal)

## RichTextEditor — `components/ui/rich-text-editor.tsx`

TipTap rich-text editor with a toolbar + an "Insert variable" popover.
Originally the contract editor; now generalised with an optional
`variables` prop so other surfaces (email templates) can supply their
own merge-field list.

Props:
- `value: JSONContent` / `onChange: (v: JSONContent) => void`
- `placeholder?`, `editable?`, `className?`
- `variables?: EditorVariable[]` — popover list; defaults to
  `CONTRACT_VARIABLES`. Email templates pass `EMAIL_TEMPLATE_VARIABLES`
  (`lib/email/template-variables`). The chosen `id` is stored verbatim
  on the inserted mention node (`attrs.id`).

Toolbar: H1/H2, bold/italic, lists, a **Link** button (set/update/remove
an `<a>` on the selection; bare domains get `https://` prepended;
StarterKit v3's bundled Link with `openOnClick: false`), undo/redo, and
the Insert-variable popover. The blockquote button was removed
(2026-07). When `showVariableInserter` is on, typing **`@` or `{{`** in
the body opens the inline variable suggestion
(`components/ui/variable-suggestion.tsx` — keyboard-navigable floating
list built on TipTap's suggestion plugin; Enter/Tab inserts the mention
and swallows the trigger).

## Email Templates components — `app/(dashboard)/templates/*`

- `TemplatePreview` — renders subject + body through
  `lib/email/templates`, highlighting unresolved variables in amber
  (`preview` mode). With `shell` it instead renders the **finished
  email** — the branded shell from `wrapTemplateHtml` — in a sandboxed
  iframe (the editor's WYSIWYG preview). Reused by the library editor
  (sample context) and the couple Send-email modal (real context).
- `SubjectField` — labelled subject input + Insert-variable popover
  that appends `{{ expression }}` tokens.
- `TemplateEditorModal` — fullscreen create/edit (editor + WYSIWYG
  preview + attachments + test-send), uses the `Button`, `Modal`,
  `Input` primitives.
- `CategoryPicker` (+ `CategoryManageRow`, `ColorSwatches`) — the
  Notion-style category control: Select-like trigger, pick list with
  colour dots, inline "New category", and an Edit mode with rename /
  recolour / delete / dnd-kit drag-reorder. Colour keys map to
  named-palette classes in `category-colors.ts`.
- `TemplateAttachments` — upload/list/remove the files sent with a
  template (browser → private bucket; metadata via server actions).
- `TemplatesLibrary` — category-grouped, searchable list with
  `Loading` / `Empty` / `ErrorState` states.

Shared across the non-email tabs (Packages / Quotes / Invoices /
Contracts):

- `StarterCatalogModal`: generic "Browse starters" catalog modal (flat
  list, no lifecycle grouping). Props: `title`, `blurb`, `noun`,
  `catalog` (`{name, subtitle}[]`), `existingNames` (hidden when already
  owned), and `onAdd(names) => Promise<number>` (caller owns the insert +
  cache invalidation; the modal owns the toast). Mirrors the Emails
  `StarterLibraryPanel`.
- `LineItemPreview`: the line-item counterpart to `TemplatePreview`,
  reusing the same card chrome. Renders a name/subtitle header + priced
  line items + total for package / quote / invoice editors.

All use semantic tokens (`bg-card`, `text-text`, `border-border`,
`bg-brand`) and the shared primitives — no ad-hoc colours.

## Onboarding preview components — `app/(dashboard)/@modal/(.)welcome/previews/*` (Phase 14)

High-fidelity mocks of real screens used in the welcome wizard steps 5–8. Mocks are hand-built and held to a resemblance bar by review against running-app screenshots side-by-side; there is no drift-detection mechanism, so when a real screen changes materially, the matching preview must be manually updated.

### `PreviewFrame` — `preview-frame.tsx`

Renders a mock app frame with the real sidebar nav (Dashboard through Templates) and active-state marking. Props:

- `children: ReactNode` — content to render in the main pane
- `activeNav?: string` — marks the nav item with `data-active="true"` after the click beat
- `className?: string` — wrapper class override

The active nav item is marked via a `data-active` attribute on the nav button, allowing tests to verify navigation state (see testing.md selectors).

### Preview script hook — `usePreviewScript`

Hook that manages preview-specific timing and reduced-motion detection. Props:

- `onReady?: () => void` — fires when the preview is ready to animate (reduced-motion respected)
- `delayMs?: number` — stagger animation start (default 100ms)

Returns an object with `isReady`, `prefersReducedMotion`. Used by step 5–8 previews to coordinate entrance animations.

### Reduced-motion detection — `useReducedMotion`

Hook that reads `window.matchMedia('(prefers-reduced-motion: reduce)')` and returns a boolean. Used by preview scripts to respect system accessibility settings — when true, skip entrance animations and show all content immediately.

### Preview content components

- `preview-couples.tsx` — Kanban board mock with sample couple cards (name, status pill, event date, venue)
- `preview-templates.tsx` — Two-pane layout: left pane shows LineItemsTable + controls, right pane shows sample email template render
- `preview-emails.tsx` — Couple-profile Emails tab mock: contact picker + "Send email" button + sent-history list
- `preview-automations.tsx` — Automation canvas mock with sample triggers and actions (placeholder copy to be replaced per brief)

All previews use the design system primitives and tokens; none are pixel-perfect renders, but all are visually recognisable as analogues of their real counterparts.

### `PreviewScriptProps` contract

Type definition for preview script configuration:

```typescript
type PreviewScriptProps = {
  onReady?: () => void;
  delayMs?: number;
  prefersReducedMotion?: boolean;
};
```

## Time-tracking components  -  `components/time-tracking/*`

Used by the couple timer (see `page-specs.md` "Time tracking").

- **`TimerProvider`**  -  mounted once in the dashboard layout. Owns the
  start/stop mutations, the running-timer query, the stop-note dialog, and
  the pill, so any surface can start a timer without prop drilling. Reads
  the `zebri_is_shadowing` cookie itself via `useSyncExternalStore` (it is
  set `httpOnly: false` for exactly this), which keeps the dashboard
  layout a synchronous server component. Exposes `useTimerSurface()`:
  `{ shadowing, running, clockOffsetMs, isRunningFor, start, stop,
  claimSurface }`. `claimSurface()` increments a counter and returns its
  release function; the pill hides while the count is above zero, which is
  how the couple-profile overlay takes over the control.
- **`TimerPill`**  -  the fixed top-right running pill
  (`data-testid="timer-pill"`). Owns the only one-second interval;
  elapsed is always recomputed from `started_at` plus the clock offset, so
  it cannot drift.
- **`StopNoteDialog`**  -  the timesheet prompt shown after a stop. The
  inner form is keyed by entry id so a second stop cannot inherit the
  previous note or category.
- **`TimeCategoryPicker`** + **`TimeCategoryRow`**  -  type-to-create
  category picker, trigger fixed at `w-56` so it does not stretch to the
  dialog width, with the popover matching the trigger width. Each row is a
  single hover/selected surface spanning the rename and delete icons (a
  background on the name button alone read as a half-painted row); the
  selected row is marked by that tint plus a medium weight, with no check
  icon. Filters as you type, offers `Create "<typed>"` only when
  the name is genuinely new, and each row has inline rename and delete.
  Categories are **plain chips with no colour**: couple statuses are this
  product's coloured vocabulary and a second colour system would compete
  with them. Every write is **optimistic** (`useTimeCategories`): create,
  rename, and delete all land in the list before the round-trip and roll
  back on failure. A created category shows on the trigger immediately via
  a local pending name, while `value` keeps holding only real ids, so
  saving during that window can never send a placeholder to the server.
- **`useTimerTick(active, clockOffsetMs)`**  -  the shared one-second tick.
  It lives in a hook rather than the provider because a ticking provider
  would re-render the whole dashboard once a second.

Pure duration maths (`formatElapsed`, `formatDuration`, `entryDurationMs`,
`sumByCategory`, the 8h cap helpers) lives in `lib/time-tracking/format.ts`
and is unit-tested directly.


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
Variants: `primary` (brand-fg / inverse text), `secondary` (subtle), `ghost`
(transparent), `danger`. Sizes: `sm` / `md` / `lg`. `loading` shows a spinner,
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

Conventions:
- All three use design tokens only — no raw hex / arbitrary values.
- Unit-tested in `tests/unit/components/ui/{button,input,select}.test.tsx`.
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

Centered modal dialog. `rounded-2xl shadow-xl max-w-lg max-h-[85vh]`, centered with `flex items-center justify-center`. Footer has `rounded-b-2xl bg-gray-50`.

Used for: - create couple - create task - edit vendor

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

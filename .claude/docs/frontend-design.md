# Zebri Frontend Design System

Design inspiration: - https://21st.dev/home -
https://employmenthero.com/

Goal: minimal, calm, modern SaaS design.

------------------------------------------------------------------------

## The showroom: `/design-system`

A dev-only route (`app/design-system/`, 404s in production) that
renders every primitive, page pattern and feature composite from its
real source, and flags inline where two of them disagree. Use it before
adding a component: if a variant already exists, it is on that page.

Usage counts on the page come from `app/design-system/audit-data.json`.
Regenerate after any sweep so the page reports today's reality:

```sh
npm run design-system:audit
```

### Radius: two tokens only

```
--radius-control  6px      everything with corners
--radius-pill     9999px   pills, chips, avatars, dots
```

That is the whole scale. The 12px card tier and the 16px overlay tier
were removed on 2026-08-06 after the app was found rendering six radii
against three tokens. Cards, modals, inputs and buttons all share 6px.
Do not reintroduce a third value without a deliberate decision.

Exceptions, both intentional: two arbitrary values (a 12px colour swatch
and a 2px progress segment, where 6px would round them into blobs), and
public branded surfaces, which set `borderRadius` inline from each MC's
brand kit.

### Typography: tokens carry their line-height

Three sizes, no more:

| Token | Size / line-height | Use |
|---|---|---|
| `text-display` | 30 / 36px | Page titles, with `font-semibold` |
| `text-section` | 20 / 28px | Section titles, with `font-semibold` |
| `text-body` | 14 / 20px | Everything else |

Each ships a paired `--text-*--line-height`, so `text-body` and
`text-sm` are byte-identical and `leading-*` still overrides.

**There is no caption size.** `--text-caption` (12px) was removed on
2026-08-07 and its 777 uses swept to `text-body`. Secondary text is
distinguished by *colour* (`text-text-muted`, `text-text-subtle`), never
by shrinking it. That includes form labels, help text, error messages
and dense toolbar chrome.

1,186 sites were swept onto tokens. `text-2xl`, `text-lg` and
`text-base` remain because no token defines them.

### Portalled panels carry their own type size

Any panel rendered into `document.body` (Radix `Select`/`Popover` content,
the `DatePicker` calendar, `Tooltip`) is outside its trigger's subtree, so
it inherits the document's 16px rather than the control's 14px. Every one
of them sets `text-body` on the panel root. If you add a new floating
surface, do the same: the symptom is dropdown rows that read noticeably
larger than the placeholder they replaced.

`AudioPlayButton` has the same shape of trap for a different reason: it
takes all its styling from `className`, so it sets `text-body` as a floor
that callers can still override.

### Controls: one height, no `size` prop

`Button`, `Input`, `Select` and `DatePicker` are all **32px** (`h-8`).
None of them takes a `size` prop. Content never grows a control
either: `Select` truncates a too-long selected label inside the 32px
trigger (added 2026-08-07 after long email-template names wrapped and
overflowed the automation inspector).

Four button sizes, two input sizes and two select sizes existed until
2026-08-07. Roughly 80% of the 193 call sites passing a `size` passed
the same value; the rest were an invitation to drift, and a control
that disagreed with the one beside it was the most common visual bug in
the app. A toolbar or form row now lines up with no effort.

The corollary: never reach for `h-9`, `h-10` or `py-2` on a control to
make it "match" something. If two controls disagree, one of them is not
using the primitive.

`DatePicker` lost its `variant` prop the same day. It had three chromes
(`outlined`, `underline`, `meta`), so a date field looked like a
different species depending on which form it landed in, and `meta`
rendered at 34px against everything else's 32px. There is now one
treatment: the `Input` chrome. Two knock-ons, both intentional:

- The couple and event modals used a bespoke underline vocabulary for
  every field. A boxed 32px date field among 37px underlined text fields
  read as two forms spliced together, so those modals moved to the boxed
  `Input` geometry. Their textareas use a `textareaClass` that drops the
  `h-8`.
- The builder meta row's couple and terms pickers were `py-1.5` (34px)
  and are now `h-8`.

**`Textarea` is `Input`'s sibling for prose** (2026-08-15,
`components/ui/textarea.tsx`). Same chrome — control radius, border
darkening to `brand-fg` on focus, `danger` border on error, label /
help / error linked by `aria-describedby` — with the one deliberate
difference that height comes from `rows` rather than the 32px control
height, and the field resizes vertically only. It exists because
multi-line fields were being hand-rolled with a copied class string
that drifted from `Input` (the automations inspector had seven of
them behind a local `TextArea`). Reach for it wherever a form needs
more than one line.

`MenuItem` and `RowActionsMenu` keep a `size` prop, but it is a **row
density** (padding and min-width), not a height or a type size. Menu
rows do not sit in a line with page controls.

### Controls never resize when you click them

A control that changes size mid-action moves everything beside it. Two
primitives cover the cases, and both are on `/design-system` under
Foundations → "State changes never resize":

- **`BusyLabel`** overlays the spinner on the label instead of adding it
  beside, and the label itself does not change. `Button` uses it, so
  `<Button loading={saving}>Save</Button>` is all a call site needs.
  Reach for `BusyLabel` directly only inside a button that cannot be a
  `Button` — the public branded surfaces (portal, questionnaire,
  invoice, contract) style their buttons from the MC's brand kit via
  inline `style`.
- **`CopyButton`** stacks its idle and confirmed labels in one CSS grid
  cell, so the button is always as wide as the longer one. It owns the
  clipboard write and the revert timer. `plain` renders bare text for
  meta rows that read as a sentence.

**Never write `{saving ? 'Saving…' : 'Save'}` inside a button.** That
pattern was swept out on 2026-08-07: 10 `Button` call sites moved to
`loading`, 8 raw buttons moved to `Button`, and 8 branded-surface
buttons moved to `BusyLabel`. Where a text-link button in a meta row
needs an in-flight signal, swap the *icon* to a spinner (same box, no
reflow) and leave the label alone.

### Route-level loading is a skeleton, not a spinner

`app/(dashboard)/loading.tsx` is the Suspense fallback every dashboard
page inherits. It renders a skeleton in the shape of a dashboard page
(title, toolbar, list), not a centred spinner. Until 2026-08-07 it was a
spinner, so one sidebar click produced two layout changes: spinner, then
the page's own skeleton, then the content.

### Cursor: buttons are covered globally

`globals.css` sets `cursor: pointer` on every `button` and
`[role="button"]` that is not disabled, in `@layer base`. It has to be
in that layer so it lands after Tailwind's preflight (which sets
`cursor: default`) but still loses to the utilities layer, leaving a
deliberate `cursor-not-allowed` on a call site working.

So: do **not** add `cursor-pointer` to a `<button>` or to `Button`.
Do add it to non-button clickables — table rows, cards, and anything
whose click handler is on a `div`.

### Colour: mind the Tailwind 4 palette shift

Tailwind 4 changed its default grays, so the raw classes and our tokens
are **not** the same colour:

| Class | Tailwind 4 | Token | |
|---|---|---|---|
| `text-gray-900` | `#101828` | `--text` `#111827` | differ |
| `text-gray-500` | `#6a7282` | `--text-muted` `#6b7280` | differ |
| `text-gray-400` | `#99a1af` | `--text-subtle` `#9ca3af` | differ |
| `border-gray-200` | `#e5e7eb` | `--border` `#e5e7eb` | same |
| `bg-gray-100` | `#f3f4f6` | `--surface-emphasis` | same |

Always use the token. Mixing raw grays with tokens puts two palettes on
the same screen. 1,735 sites were swept onto tokens on 2026-08-06;
`gray-600`, `gray-700` and `gray-50` remain because no token matches.

Known divergences the showroom still reports:

- **Buttons.** The CLAUDE.md "buttons are `rounded-xl`" rule contradicts
  the `Button` primitive, which is `rounded-control` (6px). The
  primitive is the intended look; the rule is stale.
- **Status chips.** Four implementations coexist: `StatePill` (tokens,
  keep), `Badge` (21 raw-palette variants), `StatBadge` inside
  `dashboard-stats.tsx`, and the vendor badges.
- **Missing primitives.** `SectionNav` and `DataTable` are still
  copy-pasted markup. `PageHeader` and `Card` were extracted (see below).

### Layout primitives

- **`<PageHeader title count actions />`** (`components/ui/page-header.tsx`)
  is the title row for every dashboard page. Title is `text-2xl` below
  `sm` and `text-display` above it. `count` renders as "N total"; use
  `meta` for anything else. Page gutters stay with the page, since a
  full-height calendar and a scrolling list legitimately differ.
- **`<Card padding surface borderless />`** (`components/ui/card.tsx`)
  is the standard bordered panel: `rounded-control`, `border-border`, and
  a padding scale of `none` / `sm` (16px) / `md` (24px, default) /
  `lg` (32px). Do **not** use it for popovers, dropdowns or menus:
  those carry their own z-index, shadow and entry animation and should
  keep their own markup.

  22 sites are migrated (dashboard panels, admin lists, template
  previews, auth forms). The rest of the roughly 89 bordered containers
  convert as each page is hardened.

------------------------------------------------------------------------

## Overlays and the z-index ladder

`Modal`, `SidePanel` and `ConfirmDialog` all take their behaviour from
**`components/ui/use-overlay.ts`**. Never hand-roll Escape handling or
body-scroll locking in a new overlay; call `useOverlay({ isOpen, onClose })`
and you get depth-aware Escape (only the topmost overlay reacts) plus a
scroll lock that releases when the last overlay closes.

`useBackdropDismiss(onClose)` covers click-to-dismiss while ignoring
drags that began inside the panel.

Stacking comes from `OVERLAY_Z`, keyed by `layer`:

| Layer | Backdrop / panel | Used by |
|---|---|---|
| `base` | `z-50` / `z-[60]` | `Modal` (default), `SidePanel` |
| `nested` | `z-[75]` / `z-[80]` | a modal opened from another modal |
| (popover) | `z-[90]` | `Select` dropdown and other popovers |
| `top` | `z-[120]` / `z-[130]` | `ConfirmDialog` |
| (toast) | `z-[200]` | `Toast`, above everything by design |

`Modal` takes `layer="nested" | "top"`. The older `nested` boolean still
works and maps to `layer="nested"`.

Known gap: roughly a hundred call sites still hard-code raw `z-[…]`
values across fifteen tiers, including a `z-[9999]` in
`add-status-modal.tsx`. Point those at `OVERLAY_Z` as each page is
hardened rather than in one sweep.

------------------------------------------------------------------------

## Design tokens (Phase 0.5) — source of truth

Tokens live in `app/globals.css` as Tailwind 4 `@theme` CSS variables; each
becomes a Tailwind utility automatically. **Always prefer the semantic
token over a raw hex or arbitrary value** — ESLint warns on `bg-[#…]` etc.
The branding system in `lib/branding/*` is end-user-facing brand
customisation, intentionally separate from these internal tokens.

### Colour

| Token | Utility | Hex | Use |
|---|---|---|---|
| `--color-surface` | `bg-surface` | `#ffffff` | Primary panel background |
| `--color-surface-muted` | `bg-surface-muted` | `#fafafa` | Card background |
| `--color-surface-emphasis` | `bg-surface-emphasis` | `#f3f4f6` | Hovered / selected row |
| `--color-text` | `text-text` | `#111827` | Body text |
| `--color-text-muted` | `text-text-muted` | `#6b7280` | Secondary text |
| `--color-text-subtle` | `text-text-subtle` | `#9ca3af` | Placeholder / meta |
| `--color-text-inverse` | `text-text-inverse` | `#ffffff` | On dark / brand background |
| `--color-border` | `border-border` | `#e5e7eb` | Default divider |
| `--color-border-strong` | `border-border-strong` | `#d1d5db` | Emphasised border |
| `--color-brand-fg` | `bg-brand-fg`, `text-brand-fg` | `#000000` | Primary CTA / mark |
| `--color-brand-bg` | `bg-brand-bg` | `#ffffff` | Brand inverse |
| `--color-success` | `bg-success`, `text-success` | `#059669` | Success / paid |
| `--color-danger` | `bg-danger`, `text-danger` | `#dc2626` | Destructive / error |
| `--color-warning` | `bg-warning`, `text-warning` | `#f59e0b` | Caution |
| `--color-info` | `bg-info`, `text-info` | `#2563eb` | Informational |

### Typography

CLAUDE.md anchors are preserved (`text-3xl font-semibold` page titles,
`text-xl font-semibold` section titles, `text-sm` body) — the semantic
tokens below are equivalent and preferred in new code:

| Token | Utility | Size | Use |
|---|---|---|---|
| `--text-display` | `text-display` | 1.875rem / 2.25rem | Page titles (pair with `font-semibold`) |
| `--text-section` | `text-section` | 1.25rem / 1.75rem | Section titles (pair with `font-semibold`) |
| `--text-body` | `text-body` | 0.875rem / 1.25rem | Everything that is not a title |

### Radius

| Token | Utility | Value | Use |
|---|---|---|---|
| `--radius-control` | `rounded-control` | 6px | Everything with corners |
| `--radius-pill` | `rounded-pill` | 9999px | Pills, chips, avatars, dots |

Spacing uses the Tailwind default scale; no custom spacing tokens.

### Dark mode (Phase 0.5b)

Class-based dark variant (`<html class="dark">`), scoped to the
authenticated CRM. The token *names* don't change — the SAME utility
(`bg-surface`, `text-text`, …) resolves to a different colour per theme via
the underlying CSS variables. No `dark:` modifier required at call sites.

Dark-mode token values:

| Token | Light | Dark |
|---|---|---|
| `bg-surface` | `#ffffff` | `#0a0a0a` |
| `bg-surface-muted` | `#fafafa` | `#171717` |
| `bg-surface-emphasis` | `#f3f4f6` | `#262626` |
| `text-text` | `#111827` | `#fafafa` |
| `text-text-muted` | `#6b7280` | `#a1a1aa` |
| `text-text-subtle` | `#9ca3af` | `#71717a` |
| `border-border` | `#e5e7eb` | `#27272a` |
| `border-border-strong` | `#d1d5db` | `#3f3f46` |
| `bg-brand-fg` / `text-brand-fg` | `#000000` | `#ffffff` (flips) |
| `bg-success` | `#059669` | `#10b981` |
| `bg-danger` | `#dc2626` | `#ef4444` |
| `bg-info` | `#2563eb` | `#3b82f6` |

Activation:
- A synchronous bootstrap in `app/layout.tsx` reads `localStorage.zebri-theme`
  before paint (no FOUC). Defaults to the OS `prefers-color-scheme`.
- `<ThemeToggle />` (`components/ui/theme-toggle.tsx`) flips the `dark` class
  on `<html>` and persists the choice. Place it once, typically in the
  sidebar / settings.

Out of scope:
- **Public surfaces** (portal / quote / invoice / contract / timeline) follow
  each MC's brand kit, not the dashboard theme — they currently use raw
  colours via `lib/branding/*` and remain visually unchanged.
- **Auth pages** (login / signup / reset) use raw colours today; they pick
  up dark mode automatically only after migration to tokens.

> The hex / hard-coded colour values **below** are the pre-0.5 reference and
> are kept for context; new code uses the token utilities above. Legacy
> off-token usage is burned down per page.

------------------------------------------------------------------------

# Colours

Primary (CTA): #111111

Secondary accent: #A7F3D0

Neutrals: Background: #FFFFFF\
Card: #FAFAFA\
Border: #E5E7EB\
Text Primary: #111827\
Text Secondary: #6B7280

------------------------------------------------------------------------

# Typography

Primary font: Inter

Fallback: system-ui

Example: font-family: "Inter", system-ui, sans-serif;

------------------------------------------------------------------------

# Typography Scale

These are the **desktop defaults**. Always apply the responsive mobile variants below on any page visible on mobile.

| Element | Mobile | Desktop (sm+) |
|---|---|---|
| Page title | `text-2xl font-semibold` | `sm:text-3xl` |
| Section title | `text-base font-semibold` | `sm:text-xl` |
| Stat / chart value (large) | `text-xl font-semibold` | `sm:text-2xl` |
| Chart total (hero number) | `text-2xl font-semibold` | `sm:text-3xl` |
| Data row label | `text-xs` | `sm:text-sm` |
| Data row count / amount | `text-xs font-medium` | `sm:text-sm` |
| Body / descriptions | `text-sm` |  -  (unchanged) |
| Labels | `text-sm font-medium text-gray-700` |  -  (unchanged) |
| Dense section titles | `text-sm font-medium text-gray-900` |  -  (unchanged) |
| Dropdown items | `text-xs` | `sm:text-sm` |

Dense page section titles (e.g. settings): text-sm font-medium text-gray-900

------------------------------------------------------------------------

# Layout

## Outward-facing document frame

`lib/branding/document-frame.ts` is the single source of truth for how a sent
document is framed, so the branding builder, the previews, and the public
pages stay in lockstep:

- `DOC_MAX_WIDTH_PX = 720` — the shared content width. Used by the branding
  builder canvas, the branding preview page, the builder-modal preview, and
  the public invoice / contract / run sheet / questionnaire pages. Apply it as
  `style={{ maxWidth: DOC_MAX_WIDTH_PX }}` with `mx-auto w-full`, not a
  `max-w-*` class, so there is one numeric source.
- `DOC_CANVAS_BG = '#F4F4F1'` — the light-grey page canvas the white document
  card sits on. The public invoice and contract pages set their page
  background to this (the card keeps its own `surface_color`) so the card
  reads as a document, matching the builder backdrop. Run sheet and
  questionnaire share the width but not the canvas: they have no white card,
  so grey would leave their content floating (revisit if they gain a card).
- The couple portal is intentionally wider (`max-w-5xl`) and is out of scope.

Sidebar width: 240px (desktop expanded), 68px (desktop collapsed)

Structure: Sidebar \| Main Content

## Mobile Breakpoint Strategy

Breakpoints follow Tailwind defaults: `sm` = 640px, `md` = 768px, `lg` = 1024px.

**Sidebar:**
- Mobile (`< md`): hidden by default, opens as a 280px drawer from the left via hamburger button in top bar
- Desktop (`md+`): fixed 68px icon-only sidebar, expands to 240px on hover

**Couple Profile modal:**
- Wrapper: `fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4`  -  `p-3` creates visible gaps on all edges on mobile
- Modal box: `w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] rounded-2xl`  -  full-bleed with gaps on mobile, bounded on desktop
- Navigation: horizontal scrollable tab strip (`overflow-x-auto`, `min-w-max`) on mobile (`sm:hidden`); vertical 200px sidebar on desktop (`hidden sm:block`)
- Header actions: consolidated into a single `⋯` (MoreHorizontal) Popover dropdown  -  all actions (Call, Email, WhatsApp, Portal, Delete) inside it
- **VendorProfile** (slide-over): Mobile `w-full`, Desktop `w-[640px]`

**Tables:**
- Wrapper: `overflow-x-auto`; table: `min-w-[400px]`
- Couples column visibility: name+status always; email+event_date at `sm`; phone+venue at `lg`
- Vendors column visibility: name+status always; category at `sm`; contact_name+phone+email at `lg`

**Dashboard grids:**
- Top section: `grid-cols-1 lg:grid-cols-7`  -  fixed height only on desktop: `lg:h-[560px]`. No fixed height on mobile.
- Calendar column: `lg:col-span-2 lg:h-full`  -  no hardcoded mobile height; calendar fills naturally
- Bottom section: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`  -  2-col at 640px (not 768px)
- Stats: `grid-cols-1 sm:grid-cols-3`

**Calendar filter sidebar:**
- Mobile: hidden, opens as overlay drawer via SlidersHorizontal button
- Desktop (`md+`): always visible inline

------------------------------------------------------------------------

# Mobile Responsiveness Rules

These rules apply to **every page**. Follow them when building or auditing any component.

## Heights

**Never use `h-[Npx]` as a mobile fallback.** Fixed pixel heights cause blank space or overflow on phones.

| Situation | Pattern |
|---|---|
| Component must fill desktop container | `lg:h-full` (parent must have a fixed height at `lg:`) |
| Component needs a minimum on mobile | `min-h-[Npx] lg:h-full` |
| Scrollable list inside a flex card | `flex-1 min-h-0 overflow-y-auto` |
| Chart / card on mobile | `h-[260px] sm:h-[340px] lg:h-full` |

## Cards

- Padding: `p-4 sm:p-6` (not just `p-6`)
- Border radius, border, bg: unchanged at all breakpoints

## Grids

- Start with `grid-cols-1` for all grids
- Use `sm:grid-cols-2` (640px) for 2-column layouts  -  not `md:grid-cols-2` (768px) which is too late for most phones in landscape
- Use `xl:grid-cols-4` for 4-column dashboard cards
- Stats rows: `sm:grid-cols-3`

## Hiding / showing content on mobile

- Hide a section on mobile, show on tablet+: `hidden sm:block` / `hidden sm:grid`
- Example: dashboard calendar grid is `hidden sm:grid`  -  only the events list shows on phones
- Hide desktop-only labels: `hidden sm:inline`, `hidden md:inline`

## Responsive label text in dropdowns / buttons

When a label is too long for mobile, use two spans:

```tsx
<span className="sm:hidden">{shortLabel}</span>
<span className="hidden sm:inline">{fullLabel}</span>
```

Example: period selector shows `6m` on mobile, `6 months` on desktop.

## Charts (Recharts)

- XAxis: `interval={1}`  -  shows every other tick, halves label density
- YAxis: `tickCount={4}`, `width={40}`  -  4 increments, narrower axis
- Tick font: `fontSize: 11` (down from 12)
- Wrap the stats row with `flex flex-wrap` so badge + "vs previous period" never overflow

## Anti-patterns to avoid

- `h-[Npx]` on a mobile container  -  use `min-h` or natural height instead
- Fixed label widths narrower than the longest label (causes wrapping): keep `w-28` for "Word of Mouth"-length labels
- `md:grid-cols-2` on bottom-section cards  -  use `sm:grid-cols-2` instead
- Inline period pills (1m 3m 6m 1Y) on the same row as a title  -  use a dropdown instead

------------------------------------------------------------------------

# Buttons

Primary: bg-black text-white rounded-xl px-4 py-2 hover:bg-neutral-800 cursor-pointer

Secondary: bg-neutral-100 text-neutral-900 rounded-xl cursor-pointer

## Mobile FAB (Floating Action Button)

Use a FAB for the primary CTA on mobile when the page header is too narrow to show the full button:

```tsx
{/* Header button  -  desktop only */}
<button className="hidden md:flex text-sm px-3 py-1.5 rounded-xl bg-black text-white ...">
  + New Thing
</button>

{/* FAB  -  mobile only, fixed bottom-right above nav bar */}
<button className="md:hidden fixed bottom-20 right-4 z-20 bg-black text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg ...">
  <Plus size={22} strokeWidth={2} />
</button>
```

- `bottom-20` clears the mobile nav bar (h-14 = 56px, plus buffer)
- `right-4` = 16px from screen edge
- Circle shape (`rounded-full w-12 h-12`)  -  standard mobile FAB convention

------------------------------------------------------------------------

# Dropdowns  -  Custom Only

**Never use native `<select>` elements anywhere in Zebri.** All dropdowns must be custom-built using a `<div>`/`<button>` + popover pattern.

This applies to every context: filter pills, form fields, period selectors, sort pickers, status selectors  -  everything.

## Compact pill dropdown (filters / toolbar)

Used for small inline selectors like the dashboard period picker:

```tsx
const [open, setOpen] = useState(false)
const ref = useRef<HTMLDivElement>(null)

useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [])

<div className="relative" ref={ref}>
  <button
    onClick={() => setOpen(!open)}
    className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
  >
    {currentLabel}
    <ChevronDown className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
  </button>
  {open && (
    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => { onChange(opt.value); setOpen(false) }}
          className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition first:rounded-t-lg last:rounded-b-lg ${
            value === opt.value ? 'font-medium text-gray-900' : 'text-gray-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )}
</div>
```

## Form field dropdown (modals / forms)

For dropdowns inside modals or forms, see the **Select (Custom)** entry in `component-library.md`.

------------------------------------------------------------------------

# Cards

bg-white\
border\
rounded-xl\
shadow-sm\
p-6

------------------------------------------------------------------------

# Branding Editor Typography System (2026-07-15)

## Font catalogue

`lib/branding/fonts.ts` provides 30+ curated Google fonts, each usable as heading or body:

- **FONT_IDS**: union of all available font IDs (e.g. `inter`, `poppins`, `montserrat`, `raleway`, `nunito`, `spectral`, `eb_garamond`, `cardo`, `dm_mono`, `figtree`, etc.)
- **FONT_LABELS**: human-readable label per ID
- **FONT_STACKS**: CSS font-family stack (Google Font family + fallbacks)
- **GOOGLE_FONT_FAMILIES**: Google Fonts API family descriptor (with weight axis)
- **HeadingFont / BodyFont**: type aliases for FontId (backward compatible; both roles share one list)

## Type role defaults

`lib/branding/type-defaults.ts` resolves global type rules for each role (heading / body):

```ts
interface RoleType {
  font: FontId
  sizePx: number
  weight: FontWeight
  color: string
  align: TextAlign
  textTransform: 'none' | 'uppercase' | 'capitalize'
  letterSpacing: number
  lineHeight: number
}

interface TypeDefaults {
  heading: RoleType
  body: RoleType
}

resolveTypeDefaults(b: PublicBranding): TypeDefaults
```

Each role resolves its effective style from the global branding scalars: `heading_size`, `body_size`, `heading_case`, `body_case`, `heading_letter_spacing`, `body_line_height`, plus existing `font_heading/font_body/font_weight/font_body_weight/text_color`.

## Per-text-element styling

Text-bearing blocks (business name, tagline, text, action, line items, etc.) resolve their effective style in layered order:

1. Global type default (role heading or body)
2. Block TextStyle override (optional, per-block)
3. Inline element style (e.g. individual action label text)

`TextStyle` interface:

```ts
interface TextStyle {
  font?: FontId
  sizePx?: number
  weight?: FontWeight
  color?: string
  align?: TextAlign
  textTransform?: 'none' | 'uppercase' | 'capitalize'
  letterSpacing?: number
  lineHeight?: number
}
```

------------------------------------------------------------------------

# Branding Editor Per-Block Controls (2026-07-15)

Every block in the editor exposes a unified Canva-style toolbar:

## Shared block controls (BaseBlock)

Applied by `blockOuterStyle(block, branding)` in both the editor (`BlockFrame`) and public renderer (`BlockOuter`) so they can't drift:

- **Padding:** top, right, bottom, left (px slider per side)
- **Background:** colour (ColorPopover)
- **Border:** width (px), colour, radius (px)
- **Width:** max width in px + horizontal alignment (left/centre/right)
- **Spacing:** space above, space below (px slider)

## Block type-specific controls

Each block type offers additional controls audited per surface:

- **Header banner:** image (upload), fit (cover/contain), focal point (X/Y/scale), height (px), overlay colour + opacity, rounding
- **Business name:** layout variant, logo size, alignment
- **Tagline:** full text controls (font, size, weight, colour, alignment, case, letter-spacing, line-height)
- **Text:** full text controls + link colour usage
- **Image:** fit, focal point, height, width, alignment, padding, background
- **Spacer:** height (px)
- **Divider:** thickness (px), colour, style (solid/dashed/dotted), width, alignment
- **Action button:** variant (fill/outline), size (sm/md/lg), radius, alignment, label text + styling
- **Line items:** row style (lines/stripes/plain), header + item text controls, column spread
- **Totals:** heading/label/value text controls, show/hide rows
- **Payment details:** heading/label/value text controls
- **Footer:** note + contact text controls, show/hide contact lines

------------------------------------------------------------------------

# Global Styles (Branding Editor)

The **Global styles** accordion exposes branding defaults applied to every surface:

- **Corner radius** (px) — applied to blocks via BaseBlock border-radius
- **Link colour** (hex) — default link text colour when no block override
- **Button style** — variant (fill/outline), size (sm/md/lg), radius (px)
- **Base line-height** (unitless) — fallback for body text when not overridden per block
- **Section spacing** (px) — default space between blocks
- **Page background** — colour (hex) or optional texture ID

Density (cozy/compact) is read-only; the stored value is honoured on render but the control is removed. All new fields resolve in `_user_branding` and merge into public RPC payloads.

------------------------------------------------------------------------

# Tables

Clean Notion-style tables: no card wrapper (no border/rounded-xl container), white header with bottom border, sentence-case header text (not uppercase), plain text pagination.

## Column headers

| Property | Value |
|---|---|
| Cell class | `px-1 py-1.5 text-left text-xs text-gray-400` |
| Layout | Each header label uses `flex items-center gap-1.5` with a 12px lucide icon (`size={12} strokeWidth={1.5}`) before the text |
| Name column | Uses a small "Aa" text marker instead of an icon: `<span className="text-[11px]">Aa</span>` |
| Sticky header | `sticky top-0 bg-white z-10 [box-shadow:0_1px_0_rgb(229,231,235)]` |

## Row styling

| Property | Value |
|---|---|
| Cell padding | `px-1 py-2` (compact rows) |
| Row hover | `hover:bg-gray-50/60` |
| Row selected | `bg-emerald-50/40` |
| Row class pattern | `cursor-pointer transition group ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-gray-50/60'}` |
| Per-row borders | Use `border-separate border-spacing-0` on the `<table>` and `border-b border-gray-100` on each `<td>` |

## Checkboxes

Use a custom `<button>` (not a native `<input type="checkbox">`) so the styling matches across the app:

```tsx
<button
  type="button"
  onClick={toggle}
  className={`shrink-0 w-4 h-4 rounded border transition cursor-pointer flex items-center justify-center ${
    selected
      ? 'bg-emerald-500 border-emerald-500'
      : `border-gray-300 hover:border-gray-500 ${
          selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`
  }`}
>
  {selected && <CheckMark />}
</button>
```

- Hidden until row hover by default; always visible when row is selected or any selection is active
- Filled with `bg-emerald-500` when selected, with a white SVG checkmark inside
- Header "select all" checkbox uses the same component, with a `<DashMark />` for the indeterminate state

## Page header layout

Page headers stack vertically (title row → toolbar row → optional view tabs), matching the `/tasks` page:

```tsx
<div className="px-6 sm:px-[3.75rem] pt-6 pb-3 flex-shrink-0">
  {/* Title row */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-baseline gap-3">
      <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
      <span className="text-sm text-gray-400">{count} total</span>
    </div>
    {/* Mobile + button  -  sm:hidden, w-8 h-8 rounded-full bg-gray-900 */}
  </div>

  {/* Toolbar row  -  search, filter, sort on left; primary CTA on right */}
  <div className="flex items-center gap-2 mt-3 flex-wrap">
    <SearchInput />
    <FilterButton />
    <SortButton />
    <div className="ml-auto">
      <NewButton />
    </div>
  </div>
</div>
```

## Toolbar elements

All toolbar controls share the same compact aesthetic (no `rounded-xl`, no `text-sm`, no large icons):

| Element | Class |
|---|---|
| Search input | `w-full sm:w-56 border border-gray-200 rounded-md pl-6 pr-6 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-300` |
| Search icon | `Search size={11} strokeWidth={1.5}` at `absolute left-2 top-1/2 -translate-y-1/2 text-gray-400` |
| Clear (X) | `X size={10} strokeWidth={2}` at `absolute right-1.5` |
| Filter / Sort button | `flex items-center gap-1 border border-gray-200 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-50` with an 11px lucide icon and a text label |
| Primary CTA ("New …") | `inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700`, with `Plus size={11} strokeWidth={2}` |
| Mobile + button | `sm:hidden w-8 h-8 rounded-full bg-gray-900 text-white` with `Plus size={16} strokeWidth={2}` (in the title row, not a FAB) |
| Dropdown panel | `bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-32` |
| Dropdown item | `w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50` |

## Alignment with the page title

The title in the header sits at the page's `sm:px-[3.75rem]` left padding (60px). To make the first row content (e.g. couple names, task names) line up vertically with that title:

- Content area uses **asymmetric padding**: `pl-6 pr-6 sm:pr-[3.75rem]` (24px left, 60px right)
- A fixed-width gutter column on the left of each row fills the 36px gap. For tables: `width: '36px'` on the select column (with the checkbox `pl-3` inside it). For task-style lists: a 28px grid column with `px-2` row padding.
- Net result: row content starts at exactly 60px from the sidebar, matching the page title

# Board Views

Notion-style kanban aesthetic:
- Columns with bg-gray-50 rounded-xl containers, content-height (not equal)
- Colored pill headers (bg + text color per status)
- Cards: bg-white shadow-sm rounded-lg; hover shadow-md
- Text-only cards (no icons for metadata)
- "+ New" full-width button at column bottom with status-colored border
- Hidden scrollbar on kanban container

# Toolbar Style

Notion-style compact toolbar in header row:
- Expandable search (icon → input on click, X clears text only when present)
- Sort dropdown (ArrowUpDown icon) with sort options
- Filter dropdown (SlidersHorizontal icon)
- Small black "New" button
- All buttons use cursor-pointer

------------------------------------------------------------------------

# Inputs

border border-gray-200\
rounded-xl\
px-3\
py-2\
focus:ring-2\
focus:ring-green-200

------------------------------------------------------------------------

# Icons

Use lucide-react. All icons must use `strokeWidth={1.5}` for a lighter, more refined line weight.

------------------------------------------------------------------------

# Animations

Allowed: - hover transitions - fade in - subtle scale

Avoid: - flashy motion - bouncing effects

------------------------------------------------------------------------

# Empty States

Example:

"No couples yet.

Start by adding your first couple."

Button: Add Couple

------------------------------------------------------------------------

# Horizontal Tabs

Style: Vercel / Beyond.so underline tabs.

Container: `flex gap-6 border-b border-gray-200`

Active tab: `text-gray-900 font-medium` + 2px `bg-gray-900` bottom border

Inactive tab: `text-gray-500 hover:text-gray-700`

Tab text: `text-sm`

------------------------------------------------------------------------

# Command Palette

Shortcut: Cmd + K

Style similar to Linear / Vercel.

------------------------------------------------------------------------

# Theming on Public Pages

Public quote (`/quote/[token]`) and invoice (`/invoice/[token]`) pages support per-MC accent theming.

- **Accent color:** Use `brand_color` from the MC's `user_metadata` (returned by the public RPC) for primary CTA buttons. Fallback to `#A7F3D0` when not set.
- **Logo:** When `logo_url` is set, render the logo image (`max-h-12 object-contain`) instead of the `business_name` text header.
- **Tagline:** Shown below logo/name when `tagline` is set; `text-xs text-gray-400`.
- **Contact footer:** Rendered when `show_contact_on_documents` is true; phone, website, social links in `text-xs text-gray-400`.

All other styling (background, card, typography) remains the standard Zebri design system. See `.claude/docs/branding.md` for the full spec.

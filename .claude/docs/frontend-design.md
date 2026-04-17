# Zebri Frontend Design System

Design inspiration: - https://21st.dev/home -
https://employmenthero.com/

Goal: minimal, calm, modern SaaS design.

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
| Body / descriptions | `text-sm` | — (unchanged) |
| Labels | `text-sm font-medium text-gray-700` | — (unchanged) |
| Dense section titles | `text-sm font-medium text-gray-900` | — (unchanged) |
| Dropdown items | `text-xs` | `sm:text-sm` |

Dense page section titles (e.g. settings): text-sm font-medium text-gray-900

------------------------------------------------------------------------

# Layout

Sidebar width: 240px (desktop expanded), 68px (desktop collapsed)

Structure: Sidebar \| Main Content

## Mobile Breakpoint Strategy

Breakpoints follow Tailwind defaults: `sm` = 640px, `md` = 768px, `lg` = 1024px.

**Sidebar:**
- Mobile (`< md`): hidden by default, opens as a 280px drawer from the left via hamburger button in top bar
- Desktop (`md+`): fixed 68px icon-only sidebar, expands to 240px on hover
- Mobile top bar: fixed h-14 bar with hamburger, centered logo, z-30

**Couple Profile modal:**
- Wrapper: `fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4` — `p-3` creates visible gaps on all edges on mobile
- Modal box: `w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] rounded-2xl` — full-bleed with gaps on mobile, bounded on desktop
- Navigation: horizontal scrollable tab strip (`overflow-x-auto`, `min-w-max`) on mobile (`sm:hidden`); vertical 200px sidebar on desktop (`hidden sm:block`)
- Header actions: consolidated into a single `⋯` (MoreHorizontal) Popover dropdown — all actions (Call, Email, WhatsApp, Portal, Delete) inside it
- **VendorProfile** (slide-over): Mobile `w-full`, Desktop `w-[640px]`

**Tables:**
- Wrapper: `overflow-x-auto`; table: `min-w-[400px]`
- Couples column visibility: name+status always; email+event_date at `sm`; phone+venue at `lg`
- Vendors column visibility: name+status always; category at `sm`; contact_name+phone+email at `lg`

**Dashboard grids:**
- Top section: `grid-cols-1 lg:grid-cols-7` — fixed height only on desktop: `lg:h-[560px]`. No fixed height on mobile.
- Calendar column: `lg:col-span-2 lg:h-full` — no hardcoded mobile height; calendar fills naturally
- Bottom section: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` — 2-col at 640px (not 768px)
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
- Use `sm:grid-cols-2` (640px) for 2-column layouts — not `md:grid-cols-2` (768px) which is too late for most phones in landscape
- Use `xl:grid-cols-4` for 4-column dashboard cards
- Stats rows: `sm:grid-cols-3`

## Hiding / showing content on mobile

- Hide a section on mobile, show on tablet+: `hidden sm:block` / `hidden sm:grid`
- Example: dashboard calendar grid is `hidden sm:grid` — only the events list shows on phones
- Hide desktop-only labels: `hidden sm:inline`, `hidden md:inline`

## Responsive label text in dropdowns / buttons

When a label is too long for mobile, use two spans:

```tsx
<span className="sm:hidden">{shortLabel}</span>
<span className="hidden sm:inline">{fullLabel}</span>
```

Example: period selector shows `6m` on mobile, `6 months` on desktop.

## Charts (Recharts)

- XAxis: `interval={1}` — shows every other tick, halves label density
- YAxis: `tickCount={4}`, `width={40}` — 4 increments, narrower axis
- Tick font: `fontSize: 11` (down from 12)
- Wrap the stats row with `flex flex-wrap` so badge + "vs previous period" never overflow

## Anti-patterns to avoid

- `h-[Npx]` on a mobile container — use `min-h` or natural height instead
- Fixed label widths narrower than the longest label (causes wrapping): keep `w-28` for "Word of Mouth"-length labels
- `md:grid-cols-2` on bottom-section cards — use `sm:grid-cols-2` instead
- Inline period pills (1m 3m 6m 1Y) on the same row as a title — use a dropdown instead

------------------------------------------------------------------------

# Buttons

Primary: bg-black text-white rounded-xl px-4 py-2 hover:bg-neutral-800 cursor-pointer

Secondary: bg-neutral-100 text-neutral-900 rounded-xl cursor-pointer

## Mobile FAB (Floating Action Button)

Use a FAB for the primary CTA on mobile when the page header is too narrow to show the full button:

```tsx
{/* Header button — desktop only */}
<button className="hidden md:flex text-sm px-3 py-1.5 rounded-xl bg-black text-white ...">
  + New Thing
</button>

{/* FAB — mobile only, fixed bottom-right above nav bar */}
<button className="md:hidden fixed bottom-20 right-4 z-20 bg-black text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg ...">
  <Plus size={22} strokeWidth={2} />
</button>
```

- `bottom-20` clears the mobile nav bar (h-14 = 56px, plus buffer)
- `right-4` = 16px from screen edge
- Circle shape (`rounded-full w-12 h-12`) — standard mobile FAB convention

------------------------------------------------------------------------

# Cards

bg-white\
border\
rounded-xl\
shadow-sm\
p-6

------------------------------------------------------------------------

# Tables

border-b rows\
hover:bg-gray-50

Clean Notion-style tables: no card wrapper (no border/rounded-xl container), white header with bottom border, sentence-case header text (not uppercase), plain text pagination.

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

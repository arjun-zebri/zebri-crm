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

Page titles: text-3xl font-semibold

Section titles: text-xl font-semibold

Body: text-sm

Labels: text-sm font-medium text-gray-700

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

**Slide-over panels** (CoupleProfile, VendorProfile):
- Mobile: `w-full` (full screen)
- Desktop (`md+`): `w-[640px]`
- Action button labels hidden on mobile (icons only via `hidden sm:inline`)

**Tables:**
- Wrapper: `overflow-x-auto`; table: `min-w-[400px]`
- Couples column visibility: name+status always; email+event_date at `sm`; phone+venue at `lg`
- Vendors column visibility: name+status always; category at `sm`; contact_name+phone+email at `lg`

**Dashboard grids:**
- Top section: `grid-cols-1` → `lg:grid-cols-7`
- Bottom section: `grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-3`
- Stats: `grid-cols-1` → `sm:grid-cols-3`

**Calendar filter sidebar:**
- Mobile: hidden, opens as overlay drawer via SlidersHorizontal button
- Desktop (`md+`): always visible inline

------------------------------------------------------------------------

# Buttons

Primary: bg-black text-white rounded-xl px-4 py-2 hover:bg-neutral-800 cursor-pointer

Secondary: bg-neutral-100 text-neutral-900 rounded-xl cursor-pointer

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

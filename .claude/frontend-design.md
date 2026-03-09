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

Sidebar width: 240px

Structure: Sidebar \| Main Content

------------------------------------------------------------------------

# Buttons

Primary: bg-black text-white rounded-lg px-4 py-2 hover:bg-neutral-800

Secondary: bg-neutral-100 text-neutral-900

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

border\
rounded-lg\
px-3\
py-2\
focus:ring-2\
focus:ring-green-200

------------------------------------------------------------------------

# Icons

Use lucide-react.

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

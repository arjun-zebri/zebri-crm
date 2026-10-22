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

**Input `leadingIcon`** (2026-10-12): an icon inside the field on the
left, with the text padded past it. Use it for search boxes instead of
placing an icon beside the input by hand. Admin Outreach's prospect
search is the first user.

### v2 preview: `/design-system/v2`

A new system, themed on zebras, blue sky and green grass, built
alongside v1 (`app/design-system/v2/`). So far it holds Foundations,
and within that only the colour palette: four 11-step scales
(`zebra-*`, `azure-*`, `grass-*`, 50 to 950, plus `champagne-*`, a
warm gold kept for celebration only: never an action, status or
surface) declared in `app/globals.css`. The blue scale is `azure`, not `sky`, because
Tailwind's built-in `sky` is still used by Badge and the template
category colours. Nothing in the app consumes v2 yet; v1 stays the
source of truth until v2 is complete.

The page is set in v2 itself (`showroom-v2.tsx`: `Section`, `Group`,
`Spec`, `Demo`, `DemoRow`), never the v1 `../showroom` wrappers, which
put v1 type around v2 components. Heading ladder: page `type-display`,
section `type-title`, group `type-heading`, component `type-subheading`
with its file in `type-code`. Components are grouped as the rail lists
them: Buttons & links, Inputs, Selection, Display, Overlays, Motion,
and **every primitive in `components/ui-v2/` has its own entry**; a new
primitive lands with its entry.

#### v2 consistency rules (2026-10-14, user rulings after the audit)

These win over anything older in this section.

- **Text fields are "option G"** (user ruling 2026-10-14, picked from
  seven live options; superseded the "quiet name" rule the same day). A
  field is a line led by its icon (`size-4 text-zebra-400`), then the
  words themselves: the field's name as grey placeholder text until
  something is typed, then the value in black, all one size (no
  title-sized name line). No box, no border, no label above, nothing
  "(optional)"; the icon is what names a filled value, so every form
  field has one and it is chosen by meaning. Hovering tints exactly the
  words, placeholder or value (`FitInput`, `components/ui-v2/fit-input.tsx`:
  a hidden copy of the text sizes the field, `size={1}` drops the
  browser's minimum width), and the tint grows as you type; clicking in
  clears the tint and leaves the caret (no label appears on focus: tried
  and rejected). `Input` (`icon`, `label`, `wide`), `Dropdown` and
  `Select` in a form, `Textarea`, `DateField` and `PasswordInput` all
  draw it. A question label ("Where did you meet?") shows above, quiet,
  and the field prompts "Your answer". Choices with ticks stay
  `ChipGroup`. `raised` / `filled` are only for a search among toolbar
  buttons or atop a dialog's rail. A record that is read more than
  edited (the client Overview) keeps its rows: icon and grey name in a
  column, the value beside it. So does a setting panel (`SettingRow`,
  `payments/modal/setting-row.tsx`: icon, grey name, the value's control):
  a setting always holds a value, so a placeholder-named field would never
  say what it is (user, 2026-10-14, the invoice's "Get paid" panel).
- **Custom values are "type to find"** (user ruling 2026-10-15, picked
  from live options; the default for every custom input). A setting with
  usual values that takes any other (a deposit percent, a due date's lead
  time, a booking length, a reminder) is a `ValuePicker`
  (`components/ui-v2/value-picker.tsx`): the value on a small white button
  ("7 days ⌄"), opening a `ValueMenu` (`value-menu.tsx`) whose first line
  is a quiet "Type a number…" over the common choices. Typing replaces the
  choices with what the text could mean ("9" lists 9 days, 9 weeks,
  9 months; "9 w" narrows to weeks; `readAmount` for number-and-unit,
  a caller's own `read` for words like "1 hr 30"); Enter takes the first.
  No "Custom…" row, no second screen, no Done button: typing is the custom
  value, and a value that is not a choice is listed first, ticked. A
  second choice that shapes the value goes under a rule after the values
  (`also`: the invoice balance's "Before the event" / "After this
  invoice"), and the button then says the whole phrase ("2 months before
  the event ⌄"), one line that never wraps (`row` keeps the menu's rows
  short: "2 months"). A chip
  or row that already opens a menu (the booking chips, Journeys' "Asks
  for") renders `ValueMenu` inside it. Rejected on the way: a tinted
  number with a tiny unit menu beside it, a stepper, a settings list, a
  sentence with underlined values, Custom… opening an editor with a green
  Done and a units switch, and Custom… turning into a typing row.
- **Dialog anatomy** (`components/ui-v2/dialog-parts.tsx`): header is an
  `IconCircle`, the title in `type-label text-zebra-500`, the dialog's
  actions (`DialogHeader actions`, primary last) and Close (ghost square)
  top right, all on that one row; the big name and its subtitle sit on
  their own full-width row under it. Never a row of buttons under Close
  (user, 2026-10-14: read as clutter); no header or footer bars or rules; footer
  right-aligned, `gap-3`, primary last. **Padding is Settings'** (the
  gold standard, user 2026-10-15), the same in every size:
  `DIALOG_HEADER_PAD` (`py-3 pl-4 pr-3`: the X glyph 22px from the top
  and right) and `DIALOG_FOOTER_PAD` (`px-5.5 pb-5.5`: the last button's
  edge 22px from the right and bottom, under the X). Body stays 24px,
  40px in a large dialog. A hand-built header or footer imports these
  constants rather than copying the classes. Form dialogs have no Cancel
  (Escape, the scrim and Close are the way out); a confirmation dialog
  has a `plain` Cancel before its primary or danger button.
- **Ledger rows** (`Input`, `DateField`, `Dropdown` `row`; `LEDGER_ROW` in
  `control-styles`): the field's name on the left, its value beside it, no
  box, no icon; a field's help sits behind an info mark by the name. On a
  phone the name stacks over the value. Used by Settings (2026-10-15).
  Anywhere a field shows an error, the error replaces its help line
  rather than stacking under it.
- **Boxed fields** (`Input`, `DateField`, `Dropdown` `boxed`; `ChipGroup
  stacked`; `CalendarField` with `DatePanel`; `ComboField`; `BoxedLabel`;
  `BOXED_CONTROL` in `control-styles`): the name over a white hairline
  box, 40px tall (a step over the app's 36px), help shown under it. An
  invalid one takes a red edge through `boxedControl(error)`, never by
  appending `border-danger` to `BOXED_CONTROL` (two border colours on one
  element resolve by stylesheet order, and the neutral one won). Only
  where a stranger fills a form in once: the entry screens and the
  couple's public BDM form (2026-10-15). There, and only there,
  `optional` marks a field "(optional)"; required fields stay unmarked. A
  date is a `CalendarField`: typed DD / MM / YYYY in one box (`DateSegments`,
  auto-advancing, paste-aware), with a calendar button opening `DatePanel`,
  whose Month and Year are menus in its header (a birthday opens near 1990); a list of more than twelve
  is a typed `ComboField` with `pinned` options first. On the couple's form:
  - One card filling the window; only the questions scroll, so the bar
    and the footer ("Only Sophie sees your answers", "Powered by Zebri")
    stay in view.
  - A welcome page first: what it is for, what to have to hand, and that
    both of them confirm it at the end. No "who is filling this in".
  - A section a page (`PagedStyle`), titled by its heading, the parts
    named in a rail from `lg`; on phones a `ProgressBar edge` line along
    the bar's foot.
  - Related answers share a row (a question's `span`); choices are a
    stacked list with a hint line each; a branch few take opens from a
    quiet link (`reveal`: "I live outside Australia").
  - Each ID is a photo: pick the document on a card, take or upload a
    photo, the details are read off it to check (`id-capture.tsx`;
    pretend in the demo).
  - On phones the card is full-bleed, Back and Next split the width of a
    row at the end of the page, never stuck to the screen (`PHONE_BAR`;
    Start too), short fields pair up
    (`phoneHalf`: State and Postcode), and bar status is icon-only.
  - Check your answers, each part with Change; at its foot both confirm,
    then Send. Sent says so in place; they can change an answer and send
    the changes until the celebrant has checked the notice.
- **The celebrant's paperwork dialog** (2026-10-15): every part sits on
  one `PaperCard` (`bdm/paper-card.tsx`): initials or a glyph, the name,
  anything "to look at", then on the right "3 of 5" with a short
  `ProgressBar`, or Complete, and one action.
  - Couple's details: a card a person, then "Together". Read first, name
    over value in two columns, the names in the celebrant's voice
    (`celebrant-labels.ts`); a refused answer in red under it, one that
    only looks wrong (`oddities.ts`: postcode outside its state, a
    certificate year before the birth) in amber. "Still to come: A, B and
    14 more", where "14 more" (a `TextLink` with no href, so a button)
    opens the rest. Edit turns the card into ledger rows. Before it is
    sent, one compact `EmptyState` with Fill in for them.
  - Before the day and Lodge: a card a group; ticks for what they saw
    happen, ledger rows (`row` Input, Dropdown, DateField) for anything
    with a value, a problem under its own field.
  - The side: the facts on `ReadBack`, then the history as a `Timeline`
    (sent, back, notice signed by a month before, wedding, lodged,
    registered), with the date each was done or is due.
- **Icons are all Zebri.** Lucide is no longer used anywhere in v2; every
  icon comes from `components/ui-v2/icons/` (see Icons below). Brand logos
  (Google, Outlook, Zoom) stay real logos, one mark per brand.
- **Focus mark**: one keyboard-only treatment for every control, row and
  card, the `focus-mark` utility (a 2px grass-500 outline 2px outside the
  shape, following its corners; an outline, so it never replaces a
  button's shadow). `focus-mark-within` on a wrapper. Text fields show
  focus by the caret only (their hover tint clears); menu rows by the
  highlight fill.
  Never `outline-none` without a mark.
- **Interaction tokens**: `bg-hover` (zebra-950 at 5%) behind anything
  under the pointer, `bg-pressed` (8%) for open or current, `selected`
  (grass-800) for every picked chip, card, check or menu tick,
  `HOVER_ON_WHITE` for opaque white things. Dividers inside a v2 surface
  are `hairline` (zebra-950 at 7%: `border-hairline`, `bg-hairline`,
  `ring-hairline`), never zebra-100/200/300. The white secondary button's
  zebra-200 edge, Checkbox and ChoiceCard's zebra-300 box, and dashed
  edges (FilterChip, FileDrop, Waterfall) are edges, not dividers.
  Disabled is one recipe (`DISABLED` in `control-styles.ts`: 50%, no
  pointer) on every interactive primitive.
- **Geometry**: controls that sit in toolbars beside buttons are 36px
  (`h-9`) with `rounded-panel` corners (Button, FilterChip, Segmented
  track, raised Input, Dropdown, Stepper, Badge `control`). Chips inside
  content (ChipGroup, PropertyChip, TagList) are 32px, `rounded-button`,
  `type-body`. Nested parts take a smaller radius than their container.
- **Shared recipes** in `control-styles.ts`: `FLOATING` (menus, popovers),
  `FLOATING_BAR` + `BAR_RULE` (every floating toolbar), `MENU_ITEM`,
  `MENU_LABEL`, `MENU_RULE`, `ROW` (a clickable row or card: hover fill,
  focus mark, 150ms). New primitives: `IconCircle` (32px or `lg` 48px,
  zebra-100 with a zebra-500 glyph), `GroupLabel`, `EmptyState`, `Badge
  dot` for status dots. Square `Button`s name themselves with a Tooltip
  from their `aria-label`; never a native `title=`.
- **Scrollbars**: thin, no track, invisible at rest; a faint zebra thumb
  shows only while the pointer is over the area that scrolls (`.v2-scroll`
  in `app/globals.css`, applied by the v2 layout). Never the default grey
  bar (user, 2026-10-14).
- **Motion**: 150ms for state changes; entrances via `animate-rise-in` /
  `animate-reveal-up`; curves from tokens only (`ease-roll` for buttons,
  `ease-glide` for sliding parts); every transition has a
  `motion-reduce` off switch. Dialog and Sheet scrims are zebra-950/20.
- **Formats**: dates day first ("24 Sep", "14 Mar 2027"), money through
  one `money()`, times "9:00 am", relative times spelled out ("2 days
  ago"), merge fields `{first names}`.
- **Type**: figures use `type-numeric`; intro lines `type-lead`; group
  labels `GroupLabel`; no overrides on a role.

Typography lists each UI element (page title, heading, button, label,
…) with its role, from `app/design-system/v2/type-scale.ts`. Each one
renders with a `type-*` role class in `app/globals.css` that bundles
size, line height, weight and tracking. Everything is Inter. Never add a
weight, size or tracking override to a role: if a role is missing, add
it. `type-lead` (16px regular) is an intro line, a description or
prompt text (it replaced `type-subheading font-normal`); `type-eyebrow`
(13px medium caps, 0.1em) is a kicker above a title in a proposal (it
replaced `type-label tracking-widest uppercase`). A group label ("Today",
"Get paid") is `type-body text-zebra-400`.

Background and surface: **Backdrop** (`components/ui-v2/backdrop.tsx`,
`bg-backdrop` utility) is the app background: a bone base with pale
grass (100 step) tinting the bottom-left corner and pale sky the top
right, plus soft white clouds from an inline SVG `feTurbulence`
texture, drawn on a fixed layer (iOS ignores `background-attachment:
fixed`). Colour stays at the edges; the middle is near-neutral.
**Panel** (`components/ui-v2/panel.tsx`, `rounded-panel` 10px; `raised`
adds `shadow-xl` and a hairline ring for a panel floating alone, like a
dialog or the onboarding card) is the
one raised surface. `surface-glass` (2026-09-30: every card now uses the
recipe that began as the Payments chart's "clear" tone, so the app is one
material): 72% white (40% read as no card at all), 28px backdrop blur, a
white hairline and inner top highlight, so the backdrop's wash shines
through. Its edge is drawn by the shadow, not a border: a 5% dark ring,
a 1px contact shadow and a soft 24px lift (2026-09-30, user: white cards
vanished over the backdrop's near-white middle). `tone="highlight"`
(`surface-highlight`, `rounded-button` 6px) is for the key block inside a
panel: pure white with a grass-300 to azure-300 gradient hairline.
Dialogs, sheets and form controls stay solid `bg-field`. Never hand-write `-webkit-backdrop-filter`: Lightning CSS then drops
the standard property and Chrome gets no blur.

Icons: every icon in v2 is a Zebri icon from `components/ui-v2/icons/`
(user ruling 2026-10-14: the 117 Lucide icons v2 used were redrawn in
the Soft glyph style and Lucide removed), `size-4` by default and
`size-3.5` in compact spots. A new icon is drawn with the `/new-icon`
skill (`.claude/skills/new-icon/SKILL.md`), never as a hand-rolled
svg in a component. Each icon is built by `createIcon` (`icon-base.tsx`)
with Lucide's props and type, so it fills any `icon` prop a Lucide icon
does. It is decorative (`aria-hidden`) unless given a `title`, and it
ignores a passed `strokeWidth`, because the weight belongs to the
drawing. There are three tiers: **glyph** (24 grid, inline, currentColor only;
locked to the Soft style: stroke 1.5, `rx` 4 objects, dots as list
markers, no folded corners), **tile** (48 grid, Blocks art) and
**spot** (160 grid, empty states). Tile and spot may add one palette
accent and one muted fill, and their style is locked the first time
one is drawn. Every icon is listed on the Icons entry under
Foundations.

Components so far: **Button** (`components/ui-v2/button.tsx`; variants
primary (grass-800), secondary, danger, plus `loading`). 36px tall with
10px corners (`rounded-panel`), see the consistency rules above. Minimal at rest; hover is only a one-shade step
darker in the fill (150ms), and it presses to 96% on click. `loading`
uses the disabled colour (50% fade) with a spinner beside the label.
All motion is dropped under `prefers-reduced-motion`. Tailwind 4 moves
elements with the `translate` / `scale` properties, so a custom
`transition-[…]` list must name those, not `transform`.

Forms (`components/ui-v2/`): **Input**, **PasswordInput** (show/hide
toggle with `aria-pressed`), **Textarea**, **Checkbox**, **TextLink** (always black, zebra-950, always underlined; semibold on hover, with an invisible semibold copy reserving the width so nothing shifts; `inheritSize` takes the surrounding text's size for a link inside a larger line),
built on **Field** (the accessible name, shown only for a question, see
the consistency rules above;
optional `labelAside`; a help line and any error under the control;
help stays when an error shows and both describe the control via
`aria-describedby`; `aria-invalid`, error `role="alert"`). Hints are
never tooltips: phones cannot hover.
ChipGroup's `description` and FileDrop's `help` follow the same rule and
`control-styles.ts`. Same API as v1 `Input` (`label`, `help`, `error`).
Fields are option G (see the consistency rules above) and 36px tall; a
`raised` field keeps a white fill for toolbars. Checkbox keeps the native input
(appearance reset), fills grass-800 when checked, `rounded-check` 4px.

Selection & pickers (`components/ui-v2/`): **ChipGroup** (single or
multi, `aria-pressed` toggle buttons in a labelled group, grass tint and
a check when on), **ChoiceCard** (large pick-one card, 2px grass border
when selected; a top-aligned flex column because buttons centre their
content; selected is the grass border only, the fill stays white; `check` adds a corner check mark for multi-select groups), **Badge** (neutral / brand, plus `warning` (amber tint, near-black text) and `danger` (red tint and text) for a status that asks for attention; `size="control"` is 32px, for a status standing in
for a button), **Select** (native select,
restyled), **ColorField** (swatch plus hex text; the swatch opens the
app's own `ColorPopover` from `components/ui/color-popover.tsx`, never
the browser's native picker; `inline` is the settings-row trigger,
a small square swatch, the hex and a chevron, like an inline Dropdown),
**FileDrop** (dashed drop box with image preview; `face` is the tile
form, the caller's own picture as the whole target, as the brand kit's
logo on light and dark), **Tooltip** (`components/ui-v2/tooltip.tsx`:
a small dark label naming an icon-only button on hover after a beat or
on keyboard focus, never on click; repeats the aria-label, so it is
hidden from screen readers), **Dropdown** (`components/ui-v2/dropdown.tsx`:
Radix Select in the v2 control look with a custom floating menu, for
options that must be shown rather than named; `fontFamily` renders an
option and the trigger in its own face; `inline` drops the label row and
the box for a pick inside a sentence ("Popular with MC ⌄"), `label` then
naming it for screen readers; inside a modal dialog the menu portals into
that dialog. Plain text options in a form stay on the native Select). Button gained a **ghost** variant, a **plain** variant (muted text, no
fill or padding, for actions inside a document-like form such as "Add
another"), and a **square** icon-only shape. **TagList**
(`components/ui-v2/tag-list.tsx`): soft zebra-100 tags the user wrote,
each with its own X (`Remove <tag>`), plus an `after` slot for an add
control. A removed tag fades where it stands (120ms), then the rest
slide over (auto-animate with a custom plugin that has no exit of its
own); tags never wrap, or a fading tag spills its text out of the pill. **Collapse**
(`components/ui-v2/collapse.tsx`): eases content open and shut by
height (`grid-rows` 0fr to 1fr) on one shared timeline: outgoing content
fades (100ms), every height moves together (200ms), incoming content
fades up 4px (180ms); unmount a shut one after `COLLAPSE_MS` (300), stays mounted, `inert`
while shut. Gotcha: never unmount an auto-animate root inside another
auto-animate root (the nested exit throws `HierarchyRequestError`);
keep it mounted and swap with Collapse instead. **InlineInput**
(`components/ui-v2/inline-input.tsx`): a boxless field that takes its
size from a type role and draws no line of its own (focus shows only
the caret); `underline` adds a dark underline, grass on focus, and
`suffix` puts a unit inside it and sizes the field to its value. Gotcha: Tailwind orders same-property
utilities by value, so a call-site `px-0` or `justify-between` loses to
the base `px-4` / `justify-center`; primitives choose these per prop
instead of letting callers override them.

Dates (`/design-system/v2#dates`, 2026-09-27): **DateField**
(`components/ui-v2/date-field.tsx`) takes a typed date day first
("1 Jul 2026", "1/7/26", "2026-07-01"), reads it back as "1 Jul 2026"
on blur or Enter, and shows an error under the field rather than
guessing; `formatDate` and `parseDate` are exported. Month names are
spelled out by hand because en-AU writes "June" and "Sept".
**RangeCalendar** (`range-calendar.tsx`): one month, Monday first, 32px
days, with filled grass ends and a grass-100 band between them. It only
reports clicks. **DateRangePicker** (`date-range-picker.tsx`) puts From
and To DateFields over the calendar (first click sets the start, the
next the end; focusing a field sets which end; never backwards), sized
for a `card` Popover.

Lists & figures (`/design-system/v2#data`, 2026-09-27): **StatStrip** /
**Stat** (`components/ui-v2/stat-strip.tsx`) hold up to four figures on
one glass panel split by the panel's 5% hairline (`border-zebra-950/5`),
not separate cards. Each has a label with an optional chart swatch, the
figure in `type-heading` (red via `danger` only while it needs attention)
and one line on what it means. **FilterChip** (`filter-chip.tsx`,
2026-09-30, in Selection): one MULTI-select filter on a view whose
options can grow; a dashed "+ Service" chip unset, a filled "Service
MC, Celebrant" chip (a count past two) with a × set; the menu is a
search box over checkboxes, stays open while ticking, with Clear.
**CardField** (`card-field.tsx`, 2026-10-01, in Inputs): a payment card
as one control, number, expiry and CVC on one line in one box, the
brands (Visa, Mastercard, Amex) at the right until a number is typed;
groups the number and slashes the expiry as typed; `cardProblem()`
names the one thing to fix. **Button `wallet`**: black, for Apple Pay
only. **PropertyChip** (`property-chip.tsx`, 2026-10-01, in Selection): one
optional detail of a thing being created, under its name (Linear's New
issue): a quiet icon + label chip empty, the value in black on a soft
fill when set; opens its picker in a popover, `open` owned by the caller
so a picker closes itself on a pick. **RangeCalendar** takes `min` to
grey out and disable earlier days, and the same day as from and to for a
single date.
`bare` drops the panel: each figure sits
on the backdrop led by a 10% hairline rule, for a page whose one panel
is the chart below (Payments Overview). **RowSections** (`row-sections.tsx`):
the "sections by what needs you" list (dot, title, count, note,
chevron; rows on a glass Panel; empty sections left out, `shut` ones
start folded). Clients' For you, Payments' Invoices and Contracts, and
the Proposals list are built on it. **Waterfall** (`waterfall.tsx`,
2026-09-28, to the user's mockup): a start total (grass-700), the losses
as floating grey bars with dashed rules under each loss, and
the end (grass-900); one loss can be `highlight`ed amber (bar, figure,
label), with the reason said in words beside it. Figures above bars,
name and "N left" below; `short` names on phones. It replaced a
horizontal Funnel the user swapped out the same day. **Insight**
(`insight.tsx`, 2026-09-29): one piece of Zebri AI's advice, unboxed:
the finding (`type-label`), why with the numbers (`type-body`
zebra-500), the one fix (`type-body` zebra-950), an optional secondary
button. No Zebri mark of its own (its holder carries it); stack a few
with space, no rules. **Button `ai`** (2026-09-29): the door into Zebri
AI, the secondary shape with the `surface-highlight` grass-to-sky
hairline and the Sparkles icon in grass-700; hover steps
`--highlight-fill` to zebra-100 (the utility's fill is now that var,
white by default). **StretchedButton**
is `w-full` so `truncate` lines inside it shorten (a block button sizes
to its text; it overflowed the Overview rows on phones). **MirrorChart**
(`mirror-chart.tsx`, 2026-09-28, to the user's mockup): two people's
time down an ordered list as one smooth shape either side of a seam
(grass-800 left, grass-200 right, square-root widths, clamped so an
unread row pinches to the seam), rows to the right with the combined
time ("48s", "4m 22s"), the longest row bold (no per-person split
line, cut by the user), and a legend.
`active` bolds a row other than the longest and `marker` draws a line
across the shape; the proposal modal drives both from the preview's
scroll (`use-reading-position.ts`: the section under a point 40% down
the preview's window, snapping to the end at the bottom; the cover
counts as the start of Welcome so it is on Welcome as the modal opens;
the line runs Welcome to Accept with no easing so it keeps pace with a
fast scroll; wide layout only). **StretchedButton** (`stretched-button.tsx`,
2026-09-28): the one real button behind a clickable row or card; wraps
the title, its hit area covers the nearest `relative` ancestor, the
focus ring draws round that whole area (`radius` button or panel), and
controls on top sit in `relative z-10`. It replaced the page-level
`OpenRow` (Payments, Proposals) and backs Clients' `OpenClient`. Never
hand-write a stretched `<button>`. **MediaCard** (`media-card.tsx`): a
glass card with a picture edge to edge and a caption, the title a
StretchedButton, hover shades the caption one step (Proposals
Templates). Amber tokens (2026-09-28, `app/globals.css`):
`warning-ink` (amber mixed halfway to black, for amber words and
figures) and `warning-muted` (a softer gold for a large fill), shown
with danger and warning under Foundations > Colour > Status; they
replace the hand-mixed `color-mix(...)` classes that were in four files.
Hairlines inside v2 panels are `border-hairline`
(or `bg-hairline` for a drawn line), never a third grey.

**DocumentPage** (`components/ui-v2/document-page.tsx`, 2026-09-27): a
sheet of A4 laid out at real size (794 by 1123 CSS px, 210 by 297mm at
96dpi) and scaled down as a whole to the width it is given (never up), so
an invoice or contract keeps its printed proportions instead of
reflowing like a card. Measured before paint; content past one page is
cut. Lay content out for the full 794px page with about 64px margins.

**Textarea** never has a resize handle (`resize-none`, user ruling
2026-09-27): size it with `rows` for the job instead. It takes
`optional` like Input (2026-09-30), for the muted "(optional)" mark.

Primitive extensions (2026-09-27): **ChipGroup** `hints` (a muted note
inside a chip) and `inline` (a muted label in a narrow left column, for
short rows in a compact form).
**Dialog** `form` size (40rem wide, grows with its content like `sm`); a
second Dialog opened over one stacks in front, and Escape closes only
the top one. `modal={false}` (2026-10-10) draws it as a layer on the
page instead of a native modal, for content that portals to `<body>`.

**Document engine** (`app/design-system/v2/pages/dashboard/doc-builder/`,
demo at `/design-system/v2/doc-builder`, 2026-10-09): one editor for
every document Zebri sends (proposal now; email, contract, invoice,
questionnaire, run sheet, script and custom documents move onto it in
turn). Everything outside the module imports from its `index.ts`.
- **One stack, web first.** A document is a stack of sections (the
  shape of production's proposal layout), read as a web page that
  reflows on a phone. Printable types print from it; there are no A4
  sheets in the editor and nothing is placed freely.
- **The editor is production's** (2026-10-10, founder: "the actual
  editor can be what's in current proposals in production"): the canvas
  is `SectionCanvas` inside `CanvasFrame`, with production's text bar,
  node bars, edge "+" and add palette, and inline data editing
  (`editor/doc-editor-view.tsx`). Reviews are production's testimonials,
  named "Reviews"; pages kept with the engine's old starred kind are
  turned back as they open (`model/upgrade.ts`). Pictures and videos are
  asked for through v2 dialogs (`editor/media-host.tsx`), since the
  preview has nothing to upload to.
- **Ours on top of it**: production's anchored section toolbar is off
  (`SectionCanvas sectionToolbar={false}`, an optional prop that defaults
  to on). A picked section gets its tools
  as one slim white bar across its top edge at the page's right, in the
  bottom bar's style (`editor/section-bar/`): the name (drag it to move
  the bar), the choice the section is picked for as icons (a text
  section's alignment, a list's layout, answers folding, a video's
  corners, or Accept's "Booking terms"), then Background (a short list
  in words) and Width, an inline pixel field on the bar itself, no
  popover (Figma style: type and Enter, arrow keys nudge 10px or 50 with
  Shift, drag the arrows icon to scrub; one undo step each; production's
  320 to 1400px range; `section-bar/width-menu.tsx`).
  Selected words get our own text bar (`editor/text-bar/`), drawn
  inside production's bubble through `TextBar`'s optional `row` prop
  (defaults to production's row), everything on the bar with no ⋯:
  a grip (drag it anywhere; it stays there for every selection after,
  `use-drag-bar.ts`) | Font (every font in its own face, the brand
  kit's two first) | size (‹ px field ›, arrow keys nudge) | colour (an A over a bar of the
  colour, opening named brand colours plus Automatic) | Bold, Italic,
  Underline, Strikethrough | Text case (Aa) | bulleted and numbered
  lists | align | link. Formatting the same words never moves it; only
  a new selection does. While the text bar shows, the section bar steps aside
  (one floating bar at a time, as Notion and Qwilr do) and fades back
  when the selection goes.
  Client fields in the words are a quiet token (`editor/variable-token.tsx`,
  through production's additive `VariableViewProvider`): a soft grass tint,
  no border, a ring when picked. A click opens a short menu: the field
  name (swaps it for another field), an inline "If unknown" row, Remove,
  above it; the token takes the words' formatting, and a picked token gets
  the text bar below it (`TextBar showOverVariables`, additive, off by default). Never two lists in one
  dropdown. Height is the section's edge, dragged on the page; the
  side width handles are off (`SectionCanvas widthHandles={false}`, an
  optional prop that defaults to on), since Width does that job. Background: three choices only, Brand colour (the
  live brand variable, so it follows the Brand kit), Custom colour (the
  full picker with brand, second colour and white as quick picks; live,
  one undo step on close) and Photo from the brand kit; picking the one
  in use again clears the background; picking one also sets the text to read on it, so there is
  no text colour control. The bar names a section by its kind ("Text"),
  never by the starter's internal name ("Ready", "Footer").
 The ⋯ menu: Move up, Move down, Duplicate, Hide on
  phones, Back to your brand, Delete (asks first, as production's does).
  Exact pixel sizes, side spacing, full height, video backgrounds, card
  and carousel colours are left out on purpose; a section that has them
  keeps them. Header and Footer cannot be duplicated; a new page marker
  gets no bar. Inserting inside text is the "/" menu. A bar centred at the foot holds Add, the Brand kit
  and the "/" hint (`editor/bottom-bar.tsx`). No zoom pill
  (`CanvasFrame zoomControl={false}`, an optional prop that defaults to
  on; pinch and ⌘ + wheel still zoom) and no Undo or Redo buttons in the
  header (⌘Z and ⇧⌘Z). The header: title and "Saved" | Reset (a plain
  button, one undo step) | Send or Use template | Preview, the one green
  button | Close (X) at the far right. No Done: the work saves as it goes.
  Headings end a section with no forced empty line (production's
  StarterKit `trailingNode: { notAfter: ['heading'] }`).
- **One add list**: the bar's Add, every section's edge "+", the
  trailing "Add section" and the empty page all open the same short list
  (`editor/add-menu.tsx`): each kind of section as a small custom glyph
  and its name, in a v2 `menu` popover, like the "/" menu. Production's
  canvas takes `onRequestAdd` (optional; without it, its add palette
  shows as before). The glyphs (`TextSectionIcon`, `PackageIcon`,
  `PhotosIcon`, `VideoIcon`, `ReviewsIcon`, `CommonQuestionsIcon`,
  `AcceptIcon`, `NewPageIcon`) live in `components/ui-v2/icons`.
- **The window**: `DocShell`, a `lg` dialog grown to the window less a
  2rem margin, with `closeOnBackdrop={false}` and `modal={false}`:
  production's text bar and popovers portal to `<body>`, which a modal
  `<dialog>` draws under itself and makes inert, so the editor's window
  is a layer on the page (`components/ui-v2/dialog-layer.tsx`, z-20)
  instead. Escape lets a picked section go first (also when focus sits
  on the window itself, after a click on a section), then closes it.
- **Header section** (`doc-builder/sections/header/`): first in the add
  list, the MC's logo across the top of a document with their own words
  under it (typed in place, same editor and text bar as Text). Centred,
  48px tall, wide column by default. The logo is the brand kit's own, so
  adding or changing it in a header (click or drop a picture while
  editing) sets it everywhere; with no logo the business name stands in
  on the page. Its size is dragged from the logo's corner (16 to 200px,
  the height shown while dragging, one undo step); the bar holds only
  alignment. It is an engine kind, drawn inside production's canvas
  through `SectionCanvas renderBody` (additive prop), edited by
  `editor/header-edit.tsx`.
- **The brand kit is global**: logo, main colour, document background,
  fonts, text colour, page rounding and button rounding (separate: page
  rounding never moves the buttons), and side padding (every section's
  `theme.sectionPaddingX`, set once; a section's own still wins), used by every document and email;
  drafts follow it live. An `xl` dialog (founder's mockup, 2026-10-11):
  on the left the title with "Saved" and one list of rows (Identity:
  logo, main colour, document background; Type: headings and body
  faces, text colour; every colour a `bare` round `ColorField`, no hex; Shape: page and button rounding in px as `Stepper`s),
  each row a name and a control with a hairline under it; on the right
  every document (proposal, contract, invoice, email, questionnaire, run
  sheet) drawn by its real renderer with the sample couple on the
  document background (`--b-paper` from `brandVars`, which
  `DocumentPage` and the email card read), picked from
  the document menu over the page, with Close in the corner. Business
  details and the email signature (which shows from Business: logo,
  role, phone, website, plus an extra line) live in Settings > Business
  and Settings > Email.
- **Phones**: production's canvas, without the section popover or the
  bottom bar.
- **Questionnaire, contract and invoice designs** (2026-10-20, founder:
  the canvas Design editor "looked nothing like" proposals): their
  Design button opens this editor (`EditorWorkspace` as a template of
  the type, in `DocShell`; `canvas/docs/engine-design.tsx`), not the
  canvas. One design per type (`doc-types/designed.ts`, kept in
  `canvas/docs/design-store.ts`): the MC's Header over the document's
  working parts, engine kinds that are locked (no Delete or Duplicate in
  ⋯, `guard.ts` refuses both) and drawn from the document's own data
  through `DocPartsProvider` (`sections/parts/`): Questions; Agreement,
  Clauses, Signatures; Invoice details, Line items, How to pay. They
  take the section bar without an align choice, the page's type and the
  section's text colour, so Background and the brand kit reach them.
  Packages and Accept are proposal-only in Add. A saved design is what
  Payments shows for a contract or invoice (`Designed`). A modal holding
  a Design button (the questionnaire builder, the document modal, the
  builder stub) steps aside while a design is open (`useDesigning`),
  since `DocShell` is a layer under the browser's top layer.

**Dashboard** (`app/design-system/v2/pages/dashboard/`, full screen at
`/design-system/v2/dashboard`, client-only via `dashboard-client.tsx`
because it runs off the viewer's clock): the Home page on the backdrop.
Every surface floats in the log in card's material (glass `Panel`, no
shadow), and text is kept to a minimum: no subtitle, no card notes.
- Sidebar: a glass panel inset 12px from the window. Z mark only (no
  wordmark), Home / Clients then whatever tools the MC added in the
  Blocks dialog (Proposals and Payments by default), Zebri chats grouped
  Today / This week as text-only rows, Blocks pinned above the user.
  Collapses 240px to 64px with a 300ms width transition while labels fade
  (`sidebar-row.tsx`); the toggle is the round chevron tab on the right
  edge, as in the current app. Hidden below `md`.
- Top right: a small glass panel with Calendar, Enquiries and
  Notifications ghost buttons, working as one switcher (`top-actions.tsx`):
  a single Radix popover anchored to the panel's right edge (`align="end"`,
  416px for all three), the open icon in the Button `active` state (ghost
  fill at rest), clicking another icon swaps the content with a 200ms fade
  (no slide and no height animation: both were tried; the user rejected
  side-to-side motion), clicking the open icon, Escape or outside closes.
  Enquiries and Notifications show a grass dot (not a count) while anything
  is unread (`use-unread.ts`). On open, focus goes to the popover itself so
  no control shows a ring after a mouse click.
  Notifications (`notification-panel.tsx`): Mark all read, Unread / All
  `Segmented` with counts (Unread first and the default: what is new is
  why the bell was opened), items grouped Today / Earlier with a tinted icon
  circle (grass for payments and signatures, amber `warning` for
  deadlines, zebra for the rest), the actor in black then the action, a
  detail line, time and unread dot; a Settings button (gear icon) at the foot
  (plain white: no grey band and no rule above it, in any popover). Enquiries (`enquiry-panel.tsx`, sharing `panel-parts.tsx`):
  Mark all read, then each enquiry (muted Avatar, couple, date and
  guest count, an amber `warning-ink` "Booked that day · who" line ONLY
  on a clash, one-line message, a neutral `Badge` with the source icon:
  Email / Instagram / Website form / the directory's name, a grass unread
  dot, or "Replied" once answered). No source filter (user cut it,
  2026-10-02). A row opens the enquiry modal; the foot is a secondary
  Settings button (a primary Set up until a source is connected) (View all enquiries was removed: there is no
  Enquiries page). No "Copy enquiry form" (user cut it). Enquiries stay unread until
  opened or marked read, so the icon's dot is honest. Enquiry modal
  (`enquiries/enquiry-dialog.tsx`, `xl`, house style): header couple +
  "Enquired 1h ago · source", Archive, More (Open client), Close; left
  their message then the reply, whose label names the channel (same as it
  came in; email for website and directories), opening on Zebri's draft;
  Booking link / Proposal menus insert a labelled link line at the cursor,
  Decline swaps in the drafted no with Undo (outlined on a clash), Send.
  Right: "You're free that day" (grass dot) or the clash (amber), then
  Date / Venue / Guests / Source / Received. **Settings**
  (`pages/dashboard/settings/`, `split` size: fixed height, shorter than `xl`, which was mostly white space) opens from the
  sidebar gear and the Enquiries popover's foot (`openSettings`, a shared
  store; each page renders `SettingsDialog` once). Laid out like the Blocks dialog
  but with a WHITE 13rem rail set off by a hairline (user's call) (title + one row per tab; there will be many) and
  the picked tab under a 64px header naming it, level with the rail
  title; section headings inside a tab are `type-label`; each feature owns its tab's content. The
  Enquiries tab (`enquiries/settings/enquiries-tab.tsx`) is ONE section,
  Messages: Gmail, Outlook and Instagram as identical `SourceRow`s (bare
  brand mark, name, a "Connected as …" line that eases in only once
  connected; Connect / Disconnect handed over with `Swap`), then one muted
  line saying website-form and directory enquiries arrive by email, so the
  inbox brings them in. The user cut the website form (embed code, field
  picker, developer API), the directories section and the message filters
  on 2026-10-02: those sources already email the MC and Zebri's AI sorts
  them. Everything is simulated; nothing is connected at the start, and
  the popover reads Set up until one source is. Calendar holds
  `calendar-panel.tsx`: month grid Monday first (`month-grid.tsx`;
  the picked day filled in the `selected` grass with white figures, today
  in the selected grass as `type-label` (2026-10-14: one grass family for
  both, so a picked today still reads), grey dots for the
  MC's own events and grass for bookings and weddings), Today and month
  arrows, the picked day's events (min height for two, so the popover
  never jumps), then Booking types on the panel's white
  (`booking-types.tsx`): a **Switch** (`components/ui-v2/switch.tsx`,
  44 by 24, grass-800 when on, `role="switch"`; the thumb glides on
  `--ease-glide` and squashes in flight, and a tick draws into it as it
  lands) and a **CopyButton**
  (`components/ui-v2/copy-button.tsx`, secondary, "Copied" in the same
  width) per type, then Update availability and New booking type.
- Greeting in Inter (`type-display`, `type-title` on phones); no serif
  (tried, rejected). Under it, the headline (`headline()` in
  `briefing.ts`): how the month is going ("3 weddings booked this month,
  your best September yet.") then the one booking at risk ("Priya & James
  haven't signed, and another couple wants their date.", the couple a
  `TextLink inheritSize` that opens a card, `at-risk-link.tsx`: the
  date, where the booking stalled, who else wants the date, Open client,
  and Send contract reminder, which becomes a "Reminder sent" tick in
  place so the card never resizes). Each half shows only when true and
  never repeats the panel; a recap of the panel was tried and rejected.
- **PromptBox** (`components/ui-v2/prompt-box.tsx`): a borderless
  multi-line field in a glass panel with a tools / actions toolbar; the
  panel takes the grass focus halo; Enter sends, Shift+Enter is a new
  line; `inputRef` exposes the field; the field's 16px inset lines the
  placeholder up with the first toolbar control. Borderless (ghost)
  client scope popover; the mic is a quiet ghost icon and becomes the
  green Send only once there is text. No keyboard shortcut.
- Quick starts (`briefing.ts`) are borderless ghost buttons for the
  jobs that move money or save hours: Send a proposal, Send an invoice,
  Build a run sheet. Never errands the Up next panel already covers, and
  never vague ("Prep Saturday"); "Write an MC script" was cut as low value.
- Under them, one glass panel (`up-next.tsx`) of rows: the next wedding
  (couple, date, "In 2 days" brand badge), then each message waiting on a
  reply (**Avatar**, `components/ui-v2/avatar.tsx`, initials in a 32px
  circle, `ink`, `muted`, or `soft` (zebra-100) for a couple's pair or a
  long list; `src` lays a photo over the initials). **AvatarStack**
  (`components/ui-v2/avatar-stack.tsx`) overlaps a few of them, ringed
  in the page colour, with an ink "+N" bubble for the rest. Then the counts as one plain line of links
  ("3 new enquiries · $3,850 outstanding · 2 unsigned proposals"). No card
  grid, no stat tiles, no highlighted tile: all tried and rejected as too
  many boxes.
- Clients (`clients/`, 2026-09-25): picking Clients in the sidebar swaps
  Home for the Clients page in place (`#clients` in the URL opens straight
  onto it, the only way in on phones for now). Full width (no max-width
  cap: the user asked why a wide screen showed so much side space), and
  no sheet behind the page: the title and toolbar sit on the backdrop,
  and only the clients are on glass (a `Panel` per For you section, a
  `Panel` per board column, one around the list table), so the grass and
  sky show between them. Two lines of chrome only: "Clients" and its
  count with the dashboard's `TopActions`, then the view **Tabs** on the left sharing
  a row with search, an Everyone / Leads / Booked `Segmented`, a heat
  filter (`ChipGroup` in a `card` Popover) and New client (the page's
  only primary button). For you: sections Needs you / Hot / Warm / On
  track (dot, count, note, chevron beside the title), rows of couple,
  stage name and time over a hairline 7-segment bar, Zebri's read at a
  readable measure, and the next move. Board: a zebra-100 column per stage
  ("N need you" in grey with a red dot), white cards with a red dot, not
  a coloured border. List: a table, no row rules, columns drop out below
  `xl`/`lg`/`md`/`sm`. Sending a move spins, then `Swap`s to a Done badge
  and the For you row folds away; views share that state
  (`use-next-moves.ts`). User rulings after the first cut ("doesn't feel
  premium"): next moves are always secondary (a column of green buttons
  made nothing stand out), no heat badge in For you (the section says it),
  no dotted black stage track, no second row of chrome, no white sheet
  hiding the backdrop. Called "Clients", never "Couples". Demo data in
  `clients-data.ts`.
- Payments (`payments/`, 2026-09-27): Payments in the sidebar (or
  `#payments`) swaps Home for the Payments page, built to the Clients
  page's rules (full width, title and toolbar on the backdrop, content
  on glass, two lines of chrome). **Tabs** Overview / Invoices /
  Contracts, with **Overview first** (user ruling). Overview
  (`overview/`, laid out to the user's mockup): the toolbar holds a custom
  **period picker** (`period-picker.tsx`, a secondary button and a
  `menu` Popover listing FY 2026–27, FY 2025–26, This quarter, Last
  quarter, then Custom range. Custom range turns the popover into the
  `DateRangePicker`, with dates typed or clicked, and a full-width Apply.
  The native Select and month-only pickers were both rejected) and a secondary **Export** menu that
  downloads payments received or GST by BAS quarter as CSV. Below
  that come:
  - a **bare `StatStrip`** (`overview-stats.tsx`, straight on the
    backdrop): Received (with the change on this time last year), To
    come (the amount due in the next 30 days), Overdue (red only when
    there is some) and GST collected (with the open BAS)
  - the **Cash flow by month** card (2026-09-30 redesign to the user's
    mockup) on the glass `Panel`: bars stacking received (`grass-700`), overdue (`danger/70`)
    and to come (striped `grass-400`), a dashed Today line, no axis, a
    swatch key under the title, tooltips just above each bar. A
    single multi-select **`FilterChip`** under the title ("+ Service",
    from `payments/services.ts`) with the key beside it scopes the chart
    to any mix of services; packages are not offered. A `Segmented` row was
    rejected because an MC can offer any number of services and it
    overflows. It FILTERS and never recolours. User rulings 2026-09-30, all
    rejected: a switcher stacking each category in its own colour, a
    filter by payment in the plan, a dropdown menu of services with
    totals and share bars ("hate"), and a breakdown bar with a key of
    amounts and a breadcrumb ("text overload"). Keep chart chrome to one
    quiet control; figures live in the bar tooltips. The AI insights
    button has no icon.
    **AI insights** (`Button variant="ai"`) opens
    the Payments **AI insights dialog** (`overview/insights/`), in the
    house modal style on the fixed-height `split` Dialog size (56rem by
    37rem, sized to the longest insight; user rulings 2026-09-30: a
    modal never changes height, and no big empty space). Header is the
    title and Close only (no icon, no period line; the Sparkles icon was
    rejected on this page, and the chart button has none). Left: the
    insights as rows (dot + tag, figure, headline; picked one on the
    sidebar's `zebra-950/5` fill). Right: the headline (tag and figure are NOT repeated from the row), a
    sentence of what Zebri found with the numbers, "Behind it" as a
    plain label-and-value list, "What to do", and a hairline footer with
    ONE action (no Dismiss: beside Close it read as a second close; no
    inline drafted message or email). Insights must be things the chart
    cannot show (`payments/advice.ts`): late invoices only one partner
    has opened (remind the other, by text); unsigned bookings and whose
    signature each waits on; final payments due in the fortnight before
    the wedding (change the payment plan to 30 days); card vs bank
    transfer days-to-paid (put card first). Each is computed from the
    demo data; generated bookings pay by card within days and by bank
    in over a week (`invoice-seed.ts`)
  - beside it the **What's next rail** (`whats-next.tsx`,
    `rail-row.tsx`), unboxed on the backdrop, ONE list with ONE row
    shape (user ruling 2026-09-30: no Today rule, no month drill-down):
    late invoices, then contracts waiting on a signature (contracts
    live here, not in a separate block), then the next 30 days. Each
    row is date, couple over what it is (red "Deposit · 12 days late"),
    amount over Auto / Sent, then an action column of its own: a real
    Send reminder button (opening the drafted reminder first, as
    Proposals' Nudge does) that swaps to a Reminded tick; rows with nothing to do leave it empty so
    amounts align. The rail is the wider share of the row (chart 1.2fr,
    rail min 30rem). Pointing at a row lights its month on the chart.
    The rail is pinned to the chart's height and scrolls inside; the
    page itself never scrolls on a laptop

  The figures and chart follow the period; the rail is always as of
  today. Every figure is summed from the same invoices the Invoices
  tab lists (`INVOICE_SEEDS` = named invoices plus `invoice-seed.ts`,
  with status worked out from the dates against a fixed today in
  `dates.ts`), so the tabs always agree. Invoices and Contracts are
  `RowSections`: Overdue / Due in the next 30 days /
  Scheduled later / Paid (the last two start folded), and Waiting on
  signature / Drafts / Signed. Their toolbar is search plus New invoice
  or New contract. A row opens `modal/document-modal.tsx`, an `xl`
  Dialog laid out to the user's mockup:
  - **Header** (one row): the name and a state `Badge` over "Ella & Noah ·
    Deposit · $900". On the right are Copy pay link, Mark paid and Send
    reminder (the primary, last), then More and Close past a hairline.
  - **Left**, on a `bg-zebra-50` desk: an invoice progress track
    (`invoice-progress.tsx`: Sent, Opened, Due, Reminded, Paid as bars
    that are grass when done, `danger/70` for a due date missed, grey to
    come). Then "What Ella & Noah see" with Download PDF, and the
    couple's copy as a real A4 invoice on a `DocumentPage`: letterhead,
    billed to, dates, event, the line, totals with GST, how to pay,
    footer. Contracts render on one too.
  - **Right** (`invoice-side.tsx`): the package and "$0 of $3,600 paid",
    then the couple's whole payment plan with this instalment picked out
    (`plan.ts` fills in the instalments not yet invoiced: a 25% deposit,
    the final two weeks before the wedding, the second halfway). Then
    History, led by Zebri's next move in a grass-50 note with Pause,
    and "Fell due" in red.

  Send reminder opens `reminder-dialog.tsx`, a `form` Dialog stacked in
  front of the invoice. It has To (a `ChipGroup` with `hints`: who
  opened it last, else their email, or a mobile for SMS), Via (Email or
  SMS) and Tone (`Segmented`: Friendly, Firm, Final notice). Changing
  the tone or channel rewrites Zebri's draft. Subject and Message are
  ordinary labelled `Input` / `Textarea` fields (a borderless letter
  did not read as editable), with the pay link in the text: no Pay
  button picture and no footer note (both cut by the user). The footer
  is Cancel and "Send to Ella & Noah". This is the only AI on the page. New opens a "Builder coming
  soon" page, because the preview is view only. No Stripe payouts
  anywhere (user ruling).
- Proposals (`proposals/`, 2026-09-28): Proposals in the sidebar (or
  `#proposals`) swaps Home for the Proposals page, built to the Payments
  page's rules. The user ruled against a catch-all Documents area:
  each tool keeps its own page and templates, and Contracts stay on
  Payments. **Tabs** Overview / Proposals / Templates (Overview first,
  as on Payments). Overview: the Payments period picker, a `StatStrip`
  (Acceptance rate of those answered, Won value, Out now, Time to
  accept), a **Waterfall** panel "From sent to booked" (user's mockup:
  Sent, then Didn't open, Left before packages, Saw packages didn't
  accept, Accepted no deposit, then Booked; the biggest drop by count is
  amber and named in the line under the title; no callout box and no
  dashed rule over Sent, both cut by the user; top right, an **AI
  insights** `Button variant="ai"` (user's call, replacing an insight
  column beside the chart) opens a `form` dialog of up to three
  `Insight`s from `advice.ts`: where most couples drop off, which
  template wins more often, and who has waited past twice the typical
  time to accept; each has one fix and a button, "Try it on {template}"
  to the builder stub or "See who" to the Proposals tab), then **Opened, not
  accepted** (Nudge all is the tab's primary and skips anyone nudged in
  the last 3 days, `NUDGE_GAP`) beside **Expiring soon** (the next 14 days). It fits a
  laptop screen. Proposals: `RowSections` Opened, not accepted / Sent,
  not opened / Drafts / Accepted and Declined or expired (folded); each
  row has the couple, wedding, package (leaning to or chosen), value,
  timing, Nudge, and Zebri's one-line read under it. Templates: cards
  with the real cover shrunk (`template-thumb.tsx`), use line, times
  sent and % accepted; a card opens an `lg` preview with Edit and Use
  for a couple. The proposal modal (to the user's mockup): header is the
  couple over template, wedding and value, then Copy link and Nudge
  (primary), More (Edit, Duplicate, Extend expiry, Mark accepted,
  Download PDF, Withdraw) and Close; no badge, no Edit button. Left is
  only the proposal preview (no progress track, no "What X see" row).
  Right, a narrow 20rem column (the user found 24rem too wide and too
  airy; facts, chart rows and Activity use tight 5rem label columns and
  `History compact`), sections separated by space (no rules, per the v2
  ruling): Template, Value, Expires, then "Where
  their attention went" over a `MirrorChart` of each partner's seconds
  per section, then Activity. The user cut a status heading ("Waiting
  for their answer"), a pipeline Stage row, the read line over the chart
  ("Sophie is the one on Packages") and counts like "3rd time today" in
  the activity. No Zebri next move or Pause here: Zebri only drafts the nudges (user
  ruling), and drafts never tell the couple they were watched. Nudge
  opens `nudge-dialog.tsx` (To / Via / Tone Friendly, Helpful, Last
  call). The preview is the onboarding's `BrandProposal` (user ruling),
  which now takes `wedding`, `headline` and `hints` (off here, so the
  onboarding's dashed hover outline does not show); the page calls
  `ensureBrandFontsStylesheet()` so the brand fonts load. New proposal
  is a two-step `form` dialog (couple, then template) that ends on the
  builder stub, as do Edit and New template: view only.
- Workflows: **removed 2026-10-14** in favour of Journeys (user
  ruling). The `workflows/` folder, its route (`/workflows`, now
  redirected to `/journeys` on both dashboards), its first-use page and
  the dashboard's backdrop-dim hook (only its builder used it) are gone.
  The Blocks catalogue keeps the block's id `workflows` (so saved
  accounts keep it) but names it Journeys, and Open launches Journeys.
  User-facing "workflow" copy elsewhere (Email's Used in, the client
  profile's Change journey, the plan sheet) now says journey.
- Journeys (`journeys/`) is the only automation page. What moved over
  from Workflows (2026-10-14) is its **Up next** queue, the one thing
  Journeys lacked, rebuilt in Journeys' own language: an **Up next**
  pill before the journeys' pills in the same `PillTabs` (count = sends
  and to-dos waiting on the MC; no ⋯ menu, cannot be renamed; Add a
  client and the dot legend hide while it is picked). It swaps the line
  for `RowSections` (`up-next-view.tsx`) headed with the line's own dots
  (`WAIT_DOT`): **Needs you** (amber: sends held for an OK, from steps
  Sent by "You, after approving" or sent by hand, a secondary Send that opens the
  review; the MC's to-dos, from to-do steps and "Tell me after"
  follow-ups, a v2 `Checkbox`, late in red, Undo), **Zebri sends today**
  / **later** (green; quiet rows, the row reads the message, a ⋯ holds
  Send it now, Skip this one, Pause for this client, Open the step,
  which picks that journey and opens the step dialog), **Done** folded.
  Each row is one couple at one step: "{couple} · {journey name}", Zebri's
  why, when. A settled row shows its outcome in place for a beat, then
  folds into Done (`use-up-next.ts`). The review (`up-next-review.tsx`)
  is built like the to-do dialog: the step's glyph in its family tint,
  couple and journey, Zebri's why in the `surface-highlight` with the
  sparkle, the subject typed onto the dialog, the message under a label,
  Skip this one and Send to {names}. A draft is the step's own email (or
  the follow-up's) from `step-email.ts`, `{first names}` filled with the
  couple's names and other `{field}`s with the sample values. Demo
  queue in `up-next-data.ts`, on the demo journeys' steps and couples;
  shown only for the demo business (a first-run account passes
  `source` and has nothing queued). Dropped with Workflows, as already
  covered by Journeys or not worth keeping: the On/Off list (a journey is
  always live), the trigger/filter story builder and If branches (a
  journey's step timing and follow-ups cover them), New workflow from a
  sentence and the Ask bar (faked AI with no Journeys counterpart),
  Zebri's suggestion card, Test with a client dates (the line already
  shows clients on their step), the per-workflow Clients view (clients
  sit on their step on the line), and the three starter workflows (a
  new account gets its starter journey).
- Client profile (`clients/profile/`, 2026-09-26 rebuild to the user's
  own spec): an `xl` Dialog opened from the Clients page (a whole For
  you row or board card via `OpenClient`; the name in List). A light grey
  **sidebar** (`bg-zebra-100`, `w-60`) on the left, set apart from the
  white main area by tone: avatars, name, stage, then four rows using the
  dashboard's own `SidebarRow`: **Overview, Details, Activity,
  Documents**. On phones it becomes a grey top block with `Tabs`. The
  main area has a top row: section title (`type-heading`), More (portal
  links, rotate, timer, status, downloads, delete) and Close.
  **Overview** = timeline + chat. The timeline is one quiet line with
  small dots: ticked milestones with dates, then a grass "You are here"
  marker with Zebri's headline and a sentence, then what is ahead. The
  MC's steps carry a draft and **Review**; Zebri's say what it will do
  with **Pause** and **Do it now**; plain dates are quieter. A step that
  is sent or done moves up into the ticked milestones. The ⋯ beside
  "Timeline" holds Apply a workflow, Add a to-do and Stop all workflows.
  Review replaces the main area with a compose view (back arrow, to,
  subject, message, Send) and returns to the timeline on send. The chat
  (`ask-chat.tsx`, a `bg-zebra-50` column from `lg`) has three starters,
  bubbles and an Enter-to-ask `Input`. The Overview's first two rows are
  **Primary contact** and **Secondary contact**, typed in place
  (`use-client-names.ts`): they are the client's `names`, so the title
  reads "Priya" or "Priya & Dev", and a rename cascades to the account's
  client, their journey, and the marriage paperwork and run sheet (kept by
  name, so moved to the new one; a partner's name answers update while
  they still read what Zebri filled in). The People row lists only
  everyone else. **Details**: people with contact
  and preferred channel, source, events, package, notes, others involved
  (the old Contacts), time tracked, each group with one plain action.
  **Activity**: Send email (templates) and Add note over a day-grouped
  feed. **Documents**: one list of every kind (proposal, contract,
  invoice, questionnaire, run sheet, music, speeches, script, file) with
  a kind filter and one New menu. This merges all 14 production tabs.
  No "wedding" or "couple" in copy or identifiers anywhere in the Clients
  area or on Home (`clientName`, `ClientAvatars`, `NEXT_EVENT`, stage
  "Event"). Demo data: `profile-data.ts` builds a profile from any row;
  `amelia-jack.ts` is the full hand-written one.
- Up next rows open in place, one at a time (`up-next-row.tsx`, a
  disclosure button over v2 `Collapse`): the wedding shows its run sheet
  (`run-sheet-summary.tsx`, open items in black), a message shows Zebri's
  drafted reply in a `Textarea` with Not now and Send (`reply-draft.tsx`).
  Sending folds the row away; avatar tones follow the person, not the
  position.
- The column starts 16vh down on desktop, not `my-auto` centred:
  centring made the greeting jump whenever a row opened beneath it.
- Motion: blocks rise 6px and fade in once on load, 60ms apart
  (`animate-rise-in`, `motion-safe` only). No hover motion anywhere.
- **Blocks** (`blocks/`; never "Marketplace" or "apps", and go light on
  the word "blocks" in copy), opened from the sidebar row, or a phone-only
  Blocks icon in the top-right panel: a `Dialog size="lg"` (56rem) of the
  twelve Zebri tools it launches with (2026-10-01): Enquiries, Booking
  links (formerly Booking pages), Video calls, Proposals, Contracts,
  Payments, Questionnaires, Run sheets, Ceremony scripts, Calendar, Email
  and Journeys (id `workflows`; it was Workflows until 2026-10-14). Every block is a Zebri tool; third-party services are no
  longer blocks of their own. A block that needs one names it under
  `connects` (Payments: Stripe; Booking links and Calendar: Google
  Calendar or Outlook; Email: Gmail or Outlook), shown on its detail as
  "Connects to" with the brand marks in their own colours
  (`connects-to.tsx`, nothing to press), and the MC connects it as that
  block's first step on its own page (see Block first use). Adding is
  instant. Categories follow the client's journey, in order, each with
  one line of what it is for (`CATEGORY_LINES`): Win clients (Enquiries,
  Booking links, Video calls, Proposals), Book and get paid (Contracts,
  Payments), Plan the event (Questionnaires, Run sheets, Ceremony
  scripts), Run your business (Calendar, Email, Journeys). Copy is the
  outcome first (the row's pitch: "Follow-ups that send themselves."),
  then how (the detail's two-sentence about), then the specifics
  (bullets). Max: Video calls and Email; the rest are Pro. Two panes,
  kept sparse. A 224px zebra-50 rail (`blocks-rail.tsx`): "Blocks",
  search, views as sidebar rows with icons and no counts (All, Added, a
  gap, then the four categories; current in the sidebar's zebra-950/5
  tint), and one "Pro plan · Compare" line at the foot. The content pane:
  the view name (a category view adds its line beside it), then the rows.
  No recommendation: twelve blocks in a clear order need no curating
  (the role-picked "Recommended for [MC]" bundle panel was removed
  2026-10-01, with `bundles.ts`, `featured-bundle.tsx` and the orphaned
  onboarding `step-blocks.tsx` / `step-build.tsx`). On All the rows group
  under each category's name (`type-label`) and line (muted). Rows
  (`block-row.tsx`) are one column: white mark tile, name, a `Max` badge
  only when locked, one pitch line (two on phones, never cut mid-word),
  and a fixed 112px action slot: Add is the quiet secondary (white)
  button, Upgrade the primary (the only one that costs), grass Added,
  Coming soon. A row opens its detail in the pane (`block-detail.tsx`): a
  breadcrumb header (back chevron pulled onto the content's left edge,
  the view, the block), a large mark, name and a meta line ("Win clients
  · Included in Pro"), the description with "Works with" chips right
  under it (`works-with.tsx`: the same soft 6px zebra-100 chip, plain
  icon, name, Required / Recommended, Added or an Add button in place;
  the name opens that block), then Connects to, a borderless striped
  media placeholder for the product animation, and the checklist as a
  plain ticked list (rules between items were rejected). A fixed footer
  (`block-detail-footer.tsx`) holds the next step: for an added block the
  "Show in sidebar" `Switch` (hides it without removing it), ghost Remove
  and primary "Open Proposals →"; otherwise Add, or "Part of Max, $99 a
  month" with primary Upgrade to Max (then "Welcome to Max"), or Coming
  soon. On phones the rail stacks on top and the views scroll sideways.
  Rejected: a 288px rail with subtitle, role dropdown, counts, a
  Categories label and a boxed plan card; two-column rows with "Pairs
  with" lines; a large bundle card; a single column with no rail; and
  categories named by tool type (Sell / Plan / Get paid / Connect) with
  integrations as blocks. State in `use-blocks.ts` (demo: nothing saved;
  Upgrade waits a beat). Motion: nothing snaps. Every Add / Added /
  Upgrade / Coming soon slot, the Max badge, the Works with states and
  both footer sides are `Swap`s; ticks are `DrawnCheck`s; row lists
  (`block-list.tsx`) and the sidebar nav use `@formkit/auto-animate`
  (280-300ms, the cubic-bezier(0.2, 0.7, 0.2, 1) ease-out) so rows fade
  in and the rest glide; the list is keyed by view and the detail by
  block, each rising in (`rise-in`) on change. Adding from the detail
  footer hands Add straight over to the switch, Remove and Open in place
  (an "Added" badge between them, and an empty pause that collapsed the
  bar, were both rejected). Build your Zebri's Add all still lands its
  blocks one at a time, 240ms apart (`addAll`).

**Website** (`app/design-system/v2/pages/website/`, full screen at
`/design-system/v2/website`; rebuilt 2026-10-16, reworked 2026-10-17 on
founder feedback): the zebri.com.au marketing page, built to read like
**Stripe**. A preview only: never deployed from here; the live site
stays in `zebri-landing` until sign-off. The rules of the look:
- **White and ink, no colour washes** ("too colourful", "can't look
  AI"). Brand green only on buttons, kickers, ticks and small dots. No
  ink blocks: the founding panel moved onto the backdrop (2026-10-18).
- **Website-only type** in `globals.css`: `type-site-hero`,
  `type-site-title`, `type-site-lead` (fluid with `clamp()`). Copy under
  a title is never 13px.
- **One picture per feature**, a real slice of the app (`shot-frame.tsx`,
  `inert` + `aria-hidden`), with at most two small callouts pinned to it
  (`feature-row.tsx`; callouts hide below `lg`).
- **A waitlist, not sign-ups** (founder, 2026-10-19): every call to
  action reads "Join the waitlist" and lands on the one form
  (`site-founding.tsx`); people are let in a few at a time and everyone
  in before the public launch is a founding member. The sign-up ends on
  a referral link that moves them up `REFERRAL_JUMP` places
  (`waitlist-done.tsx`). **No waitlist count and no place in line,
  anywhere**: in a market this small a big number reads as made up and a
  small one is not taken seriously. A plan picked on a pricing card is
  carried to the form (`waitlist-plan.tsx`, "Joining with Max").
- **Founding deal is one perk**: Max for the price of Pro, read from the
  plan sheet (`FOUNDING_PRICE` in `founding-offer.ts`). The page is for
  founding members, so the Max card shows that price ($47, struck from
  $99) and is the recommended plan; Pro shows its usual $59 with nothing
  struck. The v2 plan sheet (`first-run/plan-pricing.ts`) sells the same
  (2026-10-19): Max $47 for 12 months then $99, recommended; Pro $59,
  nothing struck (`onOffer` hides the strike and "then" line). The live
  billing page (`settings/billing/plans.ts`, Stripe) is not changed yet.
- **Band heading ids are `site-<id>-title`**: the hero's live dashboard
  renders ids of its own (`blocks-title`), and a clash named the Blocks
  band "Blocks" instead of its heading.
- Nav (founder, 2026-10-19): Features (lands on Journeys, lit through
  every feature band), Guides, Blocks, Pricing; the current section or
  page is underlined in the brand green (`SiteNav page="blocks"` on a
  page of its own). The footer's Product column keeps every band (its
  Blocks link goes to the Blocks page), a Resources column has Guides and
  FAQ, and the footer carries Instagram, Facebook and LinkedIn (`FacebookIcon`,
  `LinkedinIcon` drawn to sit beside `InstagramIcon`; links are
  placeholders).
Bands, in a buyer's order:
- Nav: logo left, links centred (Journeys, Lodgement, Blocks, Zebri AI,
  Security, Pricing) at regular weight (`type-body`), Log in (a plain
  label, not underlined) + Get early access right, its edges on the
  page's content edges (gutter on the bar, `max-w-7xl` on the nav); transparent at the top, frosted white once scrolled;
  `zebri-logo-clear.svg` (the brand logo minus its white ground). Below
  `lg` the links and Log in go into a menu (`site-nav-menu.tsx`,
  `MenuIcon`). On a phone's first screen the nav button hides (the
  hero's is right there) and returns once the page scrolls.
- Hero (`site-hero.tsx`), built to the live zebri.com.au hero's
  measurements: a 27rem words column and the product filling the rest
  of the 1152 content width (`max-w-6xl`, which every band and the nav
  share), side by side from `lg`, stacked below, on the design system's
  `Backdrop` (grass bottom left, sky top right, clouds) masked to fade
  into the page. Headline "You run the event. Zebri does the rest." (2026-10-19; never "back office")
  (36 to 48px, -0.025em, a sentence a line, no kicker, never "CRM"); a
  16px lead (`type-lead`, zebra-500) naming who it is for and what the
  admin is (no state, no "AI"). Then `HeroActions`: Get early access
  (`JumpButton`, `ArrowForwardIcon`, to the founding form) and See how
  it works (secondary, to the features); an `AvatarStack` of five
  founding members (no "+N" count) beside "Shaped by working MCs and
  Celebrants with 10,000+ weddings between them." (`social-proof.ts`, **placeholder people
  until launch**; real photos go in `public/founding/`); two promises
  with icons (built and hosted in Australia; your couples' data stays
  yours), the proof and promises at body size (`type-body`). The hero ends on the tools strip (`site-replaces.tsx`): body-size,
  regular-weight names beside 16px marks (`ToolMark small`) on one
  centred row; below `md` one endless row instead (`animate-marquee`,
  the list twice over, stopped and swipeable under reduced motion;
  founder 2026-10-19). Celebrant Easy, DocuSign, Typeform and Qwilr are in no
  icon set, so their real marks (from each company's site icon) live in
  `public/brands/` and `ToolMark` shows them from `Tool.image`.
- Hero picture (`hero-stage.tsx`): the real dashboard,
  `DashboardPageV2 contained sidebarCollapsed showcase`, client-only
  with the backdrop as its loading state. The whole screen at a laptop
  size (1280 x 736, 40:23), its frame the column's full width at that
  aspect, zoomed to fit (`--shot-zoom`, measured with a ResizeObserver),
  so it is always whole and ends on the content edge. `showcase`
  (`dashboard/showcase.ts`) shows a fictional MC (Jess Taylor) on a
  set-up account (Enquiries and Calendar on), sets Home a fixed way
  down, leaves out the sidebar toggle and the counts line, and gives
  the still one focal point: Up next lifted (`shadow-xl`), Ask Zebri at
  60%. Phones get the same desktop render zoomed down, so the whole
  screen shows (founder, 2026-10-19), not the phone layout: the frame
  carries `data-shot`, and the Home screen's breakpoint classes have
  `shot:` twins (a `@custom-variant` in `globals.css`) so the rail, the
  top row and Up next lay out as a laptop sees them. Not an iframe:
  every route sends `X-Frame-Options: DENY`. No
  floating notifications.
- Five feature rows (`site-features.tsx`), alternating sides, in this
  order: Journeys, the one `wide` row (words centred above, picture the
  full 1152px below; `journey-shot.tsx`): straight on its grey band, no
  gradient box. On the left, the steps straight on the band, no
  container (`journey-step.tsx`): each with what sets it off ("When
  they accept", kept after it ticks, as it is what makes it a journey),
  ticking off as the band scrolls into view (`use-played.ts`; ticks
  drawn on with `draw-check`). The step on the stage lifts into a white
  card (`shadow-lg`) and opens a line on what it does; the rail to the
  next step is the clock, drawing down over `STEP_MS` (2600ms, the
  `duration-[2600ms]` class) so the next ticks as it arrives. The NOIM
  says Checked, since lodgement is after the wedding. On the right, one
  shadowed container shaped like the couple's record
  (`journey-stage.tsx`, 680 by 600, zoomed down to fit, never up): a
  head with Mia and Leo and Enquiry turning Booked, a `zebra-50` canvas
  with what the step sent at real size (`journey-docs.tsx`, data in
  `journey-data.ts`), and a foot with one line on what happened
  ("Signed by Jess, Mia and Leo"). The scenes: the email
  (`EmailBody`), the proposal's cover with its `Packages` lifted in
  front, the contract's first page with its `Signatures` lifted in
  front, the $500 invoice (`InvoiceEmail`), Mia's NOIM read back
  (`CoupleFormReview`), and the $1,500 balance as the same
  `InvoiceEmail` (founder 2026-10-19: it must look like the deposit;
  a later payment shows its label, Pay final payment, and the deposit
  already paid on the schedule); white cards with a resting shadow, a lifted
  piece `shadow-xl`; no phone or browser frame (founder, 2026-10-18);
  the default deep green brand, so the invoice's text is white. Scene
  changes run in turn (out in 200ms, then in), never overlapping. A
  done step is a `StretchedButton` row that puts its scene back
  (`aria-current="step"` on the lit one); the stage stays inert. Loads
  the brand fonts (`ensureBrandFontsStylesheet`); finished state on the
  server and under reduced motion. Below `lg` the steps come first as
  no separate stage: each step is one card (`journey-slide.tsx`), the
  step as its head (icon, name, when, badge), its scene under it at the
  stage's zoom, and the event line wrapping as its foot, swiped in a
  `SwipeRow` that follows the step playing (founder, 2026-10-19: a step
  card over a separate record card read as two things). It plays all six steps and ends on the paid balance, every
  step with its screen (founder 2026-10-19: the NOIM and balance had
  none). Mia and Leo are Rossi and Grant on every document, as the
  invoices bill them (`personOf`); Jess's letterhead email is her own
  (`site-account.ts`), never the demo account's. BDM lodgement (`bdm-shot.tsx`, wide: three separate cards side by
  side, one per step, playing once in turn when half the band is in
  view (`use-run.ts`: even if on screen at load; each card plays exactly
  its own length, `FORM_MS` / `CHECK_MS` / `LODGE_MS` exported by each
  snapshot, about 3.1s, 6s and 5s, 14s in all (2026-10-19: 10s read as
  too fast; typing 95ms a letter, the refusal held 2.4s); the next card starts
  the moment the one before lands its result, no wait for a fade), then
  holding finished (founder, 2026-10-18: a loop was "really weird UX").
  Cards waiting their turn sit at 40% opacity and come up in 500ms as
  their play starts. Each card (`px-6 py-6`, the page's resting card): a
  quiet `zebra-400` "01" / "02" / "03", a `type-heading` title and a
  quiet line, then a hairline and the moment straight in the card, no
  well (founder, 2026-10-19: the tinted box inside read as a box in a
  box, and its own padding and vertical centring put the text off the
  head's line). Head and moment share one 24px left edge, and every
  moment starts at the top under the hairline, so first lines run level
  across the row; one body height from `lg` (16.75rem), sized so none
  clips (no `overflow-hidden`, so focus rings and the slip's ring show).
  **Shared frame, own body** (founder, 2026-10-19: three different
  styles read as unrelated, identical rows could not be told apart):
  every card opens its body with the same `Status` line
  (`bdm-snap-parts.tsx`: an `IconCircle`, neutral idle, a spinner when
  busy, amber when there is something to fix, green with a check when
  done, over a `type-label` title and a muted detail); under it, each
  card shows what its step is. Green is kept for results (Saved, the
  pass count, Registered); the playing card lifts 4px. **One answer is
  the thread** (chevrons and a per-card progress line were both tried
  and cut): 1 (`bdm-snap-form.tsx`), the couple's own form, two `Input
  boxed` fields with labels over them, Family name "Hart" already in and
  only First given name typing "Amelia Rose" (`SLIP`) at one steady 95ms
  a letter, the focus ring and a caret on that field only, then the
  status turns to Saved; 2 (`bdm-snap-check.tsx`), Zebri's check rows
  (label left, answer right, hairline between), the answer arriving only
  once step 1 has typed it, the status counting "n of 47 pass BDM's
  rules", turning amber at "1 answer to fix" with the rule's own words
  from `rules.ts` fading in red under the answer ("One word only; the
  rest belongs in Other given names"), then fixed in place: "Amelia", an
  Other given names row "Rose" under it, and "All 47 answers pass" in
  green. Before and after are layered in one cell and cross-fade, and an
  empty answer holds a space, so no BDM card ever changes height
  (founder, 2026-10-19: resizing pushed the page about on phones); 3 (`bdm-snap-lodge.tsx`), opens on "Ready to lodge",
  the couple and date, "Order their marriage certificate" ticked and
  Lodge with BDM pressing in and spinning ("Lodging with NSW BDM"), then
  the action lifts away and a registration slip rises into its place: a
  bordered `rounded-control` record headed "Marriage registration" with
  Couple / Married / Lodged / Certificate rows under a dashed rule.
  Zebri's own confirmation, never drawn as BDM's certificate. Stacked
  on phones; without script or with reduced motion every card is
  finished. The copy leads with the founder's claim that Zebri is the
  only app in Australia that lodges with BDM directly (keep it true);
  kicker "BDM lodgement" with an "Only in Zebri" badge), Blocks (`blocks-shot.tsx`, wide like
  Journeys, titled "Made for what you do.": sells the benefit, not the
  mechanics (founder, 2026-10-18: a newcomer does not care where blocks
  go; a role picker was cut as pointless). Straight on its grey band, six
  `OutcomeCard`s in journey order (Enquiries, Booking links, Video
  calls, Proposals, Questionnaires, Run sheets), each an outcome title
  and one line of how over the block's `BlockPicture` (its real image
  from `BLOCK_IMAGES`, or its mark and bullets on a quiet 16:9 card until
  it has one; Video calls' is the real call-updates window,
  `blocks/images/video.tsx`), titles one line at three across, the
  block's mark and name as
  the source; then a `TextLink` "See all" to the all-blocks
  page. The outcomes (`blocks-outcomes.ts`) only reword catalogue claims),
Zebri AI (`ai-shot.tsx`, wide: its three
  features as `ChoiceCard`s (an `IconCircle`, grass when picked, beside
  the title on one row, the line under them) beside the picked one as the app's
  own window for it, finished, still and usable, founder 2026-10-18: no
  animation, and no window saying the same thing twice. Each window
  uses the dialog anatomy (`DialogHeader` `closable={false}`,
  `DialogBody`, `DialogFooter`) on `bg-field`. Replies drafted for you
  (`ai-reply-panel.tsx`: the enquiry window on Mia and Leo's DM, the
  couple large under the header, their message as a bubble, the app's
  reply field (labelled with its channel as `ReplyComposer` does) on
  Zebri's draft, signed Jess, shown free, and Send only, `EnquiryFacts` as a full-height
  tinted sidebar from `xl`); Nudges when couples go quiet
  (`ai-nudge-panel.tsx`: the proposal as one unboxed row, its second line why
  Zebri raised it (opened three times, no reply), then the app's
  `MessageChips` and the message (no subject), each tone
  or channel change writing the new `draftFor` draft); Calls that update
  the couple (`ai-call-panel.tsx`: Amelia and Jack's Final numbers call
  as the app's `CallUpdates` with `quotes`, each value with the line
  Zebri heard, wrapping rather than truncating; no summary or record
  card, which repeated the four changes). Replies and Nudges end on
  `AiDone` with a way back. From `lg` the cards and the window are one
  34rem rectangle (cards a third each, the window filling the rest), so
  nothing below moves as windows change; below `lg` there is no
  switcher: each feature is a `SwipeRow` slide (`wide`, 90%), its icon and title over
  its own window (founder, 2026-10-19). On phones `CallUpdates` stacks
  each row (label and decision, the change under them) and the call's
  aside drops the couple's name), Security (wide, lead "Where it lives, who can see it, and
  what AI does with it.": its six commitments as tiles on its grey band,
  `security-grid.tsx` over `security-points.ts`, each tile the page's
  resting card (`shadow-lg ring-zebra-950/10`) as BDM, Blocks and Pricing
  use (Stored in Sydney,
  Encrypted, Never trains AI, Your account only, Marriage paperwork,
  Australian privacy law; each says only what the FAQ or the codebase
  backs: "records and files" in Sydney, never "everything" (email,
  payments and the app's servers are elsewhere), and no "AI runs in
  Australia" (it calls Anthropic's API directly), checked 2026-10-19; each tile its icon beside the title, the detail under them),
  then "Read our privacy policy". Replaced the lodge-login screen,
  which showed one BDM-only promise, founder 2026-10-18. White like
  every other row; `FeatureRow` has no dark variant). **Band rhythm**
  (founder, 2026-10-19: a gradient box behind every band read as seven
  separate cards): bands run full width, alternating white and a faint
  grey (`muted` on `FeatureRow` and `SiteSection`, `bg-zebra-50`):
  Journeys grey, BDM white, Blocks grey, AI white, Security grey, Pricing
  white, Founding grey (wrapped in `website-page.tsx`), FAQ white, at
  `py-16 sm:py-24`. The brand gradient (`Backdrop`) is kept for the hero
  and the BDM band only, what only Zebri does; every other picture
  floats on its band with its own shadow. Each row steps
  down from the hero: kicker `type-label`, title `type-site-title` (28
  to 40px), lead `type-lead` (16px), and no ticked points under
  it on any row (founder 2026-10-19: what matters goes in the lead). The shot
  is the only frame (no grey matte round it); callouts sit outside the
  card, on the side facing the words.
- Pages of their own share `site-subpage.tsx`: the nav with the page
  marked, the hero's sky behind a kicker, h1 and lead, the page's bands,
  the waitlist panel and the footer.
- Blocks (`/design-system/v2/website/blocks`, `blocks-page.tsx`; in the
  nav since 2026-10-19): "Every block in Zebri.", reached from the nav
  and the Blocks band's See all, then
  the catalogue's four groups as bands (`type-site-title` group name,
  its line), each a grid of `BlockCard`s (picture, name with a Max or
  Coming soon badge, pitch, bullets), closing on the waitlist panel.
- Guides (`/design-system/v2/website/guides`, `guides-page.tsx`):
  "Guides for wedding MCs and Celebrants." and an honest empty state
  until the first guide is written (no listed titles that cannot be
  opened). Guides, not a blog or news (founder, 2026-10-19: SEO and
  AEO); each guide will be its own `/guides/<slug>` page. The
  nav and footer links are `sectionHref(id)` (`nav-links.ts`: the home
  path plus the anchor), so they scroll on the home page and go home
  from this one; `JumpButton` goes home when its section is not on the
  page.
- Product pictures wear the site's sample business (`site-account.ts`:
  Jess Taylor Celebrant, Mia & Leo on Sat 13 Mar 2027 at Bendooley
  Estate on every band); `BlockPicture` and the AI reply composer get
  it through `AccountContext`, and the Journeys account builds on it.
  The dashboard demo carries the founder's real name, which must never
  reach the page (it leaked on three Blocks pictures, 2026-10-18).
  Enquiry drafts sign with the account MC's first name (`draftReply`,
  `draftDecline`'s `signer`), the demo user's when there is none.
- Pricing (`site-pricing.tsx`, on `SiteSection`, whose header is set
  exactly as a wide feature row's: `type-label` kicker, `type-lead`
  lead, the same band padding; titled "Simple pricing. No lock-in.",
  the 20% left to the founding panel's headline): three cards in the BDM band's shell
  (`rounded-panel bg-field p-1.5 shadow-lg ring-zebra-950/10`, straight
  on the white band): plan name, who it is for and price, then the
  plan's list under a hairline (13px points with a `grass-700` check like
  the feature rows; no grey well, founder 2026-10-19), and the button at
  the card's foot, level across the row. Pro is marked by its
  Recommended badge and the primary button only (no ink ring: one card
  style on the page). Enterprise priced "Custom" (not "Let's talk", which
  repeated its Talk to us button), "Priced with you, by team size"
  under it. A plan that builds on another says so once, as a
  `type-label` lead line ("Everything in Pro, plus:"), never folded into
  a tick row (founder, 2026-10-19); Enterprise lists `ENTERPRISE_EXTRAS`
  (unlimited team members, help moving clients in, a named contact,
  invoiced monthly or yearly). "Join as …" lands on the
  form, trial "at launch". Below `md` the cards are a `SwipeRow`.
- Founding (`site-founding.tsx`), closed the way Stripe closes a page
  (founder 2026-10-19, after a perk checklist beside a boxed form and a
  live member card were both rejected): white, no card, no backdrop.
  Left, kicker, title, "Join before the public launch.", the email capture
  at the app's control size (`EarlyAccessForm`: a `raised` `Input` beside
  its `Button`, both 36px, 13px text; the 48px box was too large;
  stacked below `sm`, the button full width, as side by side the field
  was too narrow) and
  "Rather talk first? Email the founder". The email opens a small dialog
  (`early-access-dialog.tsx`: name, MC / Celebrant / Both, then
  `DoneView`), so the page asks for one thing. Right, the five perks
  (`founding-offer.ts`) as one quiet column: a small grass icon (Max
  features `MaxPlanIcon`, account manager `AccountManagerIcon`, the vote
  `VoteIcon`, drawn for it), a bold name, one line.
- FAQ (`site-faq.tsx`): split, title sticky on the left, in the rows'
  type (kicker `type-label`, `type-lead` line), with "Rather talk it
  through?" and Email the founder under it, unboxed (the card round it
  was removed, founder 2026-10-19), so the column is not empty; questions in regular
  weight (`Disclosure`: 13px `type-body` question and answer, a plus that becomes a minus).
- Footer (`site-footer.tsx`): logo and "Built for Australian wedding MCs and
  Celebrants.", Product (the nav's own `NAV_LINKS`, same order and
  labels, Security included) / Company (FAQ, Contact) / Legal columns,
  all 13px like the nav, then "© 2026 Zebri" (the brand only: no
  company name or ABN, founder 2026-10-19) and "Built and hosted in
  Australia" (the hero's promise). Quiet: a giant
  faint wordmark was tried and rejected (2026-10-18).
No testimonials until real ones exist. The security lines are launch
commitments: change them only with the product.

**Onboarding** (`app/design-system/v2/pages/onboarding/`, full screen at
`/design-system/v2/onboarding`): the eight-step setup from
`feature/onboarding` rebuilt in v2. **Not skippable** (no Skip, no close
X, no "later"). Opens on a welcome cover (step 0, same 1024px panel as the steps):
"Ten tools. / Now one." in the `type-hero` role (64px, medium weight;
"Ten tools." zebra-400, "Now one." black), one line of copy ("From first enquiry to last dance, your
whole business lives here. Made for MCs, Celebrants and DJs.") and one CTA ("Set up my business", with the line "Two minutes to your
first booking"), grouped and vertically centred. On the right, with no box
round it and no texture (just a soft grass glow), ten tool badges on two
concentric rings of five around a round Zebri mark with a grass-to-sky
hairline (`surface-highlight`). The tool marks are muted (60% grayscale,
70% opacity) so the Zebri mark holds the eye. Each badge (`tool-badge.tsx`) is an
app-icon circle with the brand's mark and the name
beneath, struck through a beat after it lands (the `strike` keyframe).
Tools (`tools.tsx`): Calendly, Celebrant Easy, Zoom, DocuSign, Xero,
Typeform, Canva, Spotify, Dropbox, Qwilr. Simple Icons marks, Tabler's
camera for Zoom (the Simple Icons Zoom and Typeform marks are wordmarks
that blur at 24px), and lettermarks for Celebrant Easy, DocuSign, Qwilr
and Typeform. The orbit square is a fixed 576px so spacing never depends
on the panel; phones get the badges as a grid instead.
Then the same 1024px panel, `raised` (modal shadow plus a hairline ring
so it lifts off the backdrop). No Z mark at the top (tried 2026-10-14
and removed the same day: the cover already has one at the centre of
its orbit). The step title is an h1 in
`type-title md:type-display` (the same role as the auth titles), the
intro `type-lead`, then the form; the footer (save status with a
`DrawnCheck`, Back, then **Go to Zebri** last) sits under it. Step 1 is
"Tell us about you": name, business and website as option G fields
(see the consistency rules; name is the only one Go to Zebri waits for)
and "What you do" as a `ChipGroup`. The cover's summary line is fixed
copy ("Two minutes to your first booking"). The rail, the "1 / 9"
counter, the progress bar, the four check cards and home address were
removed with the multi-step flow, and the old step files (Your apps,
Build your Zebri, packages, brand, signature, Watch it book, plan,
founder) were deleted on 2026-10-14.

**Setup is one screen** (2026-09-30, `onboarding-flow.tsx`): the cover,
then "Tell us about you" (name, business, website, what you do; name is
the only required field) and **Go to Zebri**, which writes the handoff
and lands on the first-run dashboard. Everything else is asked where it
is first needed: the price and deposit in New proposal, the signature in
the first New contract, the plan and card at the first real client.
The account arrives with no blocks (sidebar: Home, Clients); Proposals, Contracts and
Payments are added from Home as the recommended starting blocks. The old steps were deleted on 2026-10-14; any notes below that describe
them are history.

**Account context** (`pages/dashboard/account.tsx`): the real Clients,
Proposals and Payments pages read their clients, proposals, invoices and
contracts through `useAccount()` instead of importing demo data. The
default is `DEMO_ACCOUNT`, so `/design-system/v2/dashboard` is
unchanged. Optional `addClient` / `sendProposal` / `sendContract` /
`sendInvoice` turn on working New flows: New client opens
`clients/new-client-dialog.tsx`, a quick-create rather than a form in
an `lg` sheet: a Primary contact line (required) and a Secondary
contact line (their partner; empty for a client who is one person),
which become the client's `names`; the title reads "Priya", then
"Priya & Dev" as they are typed (`clientName`), with their avatars
beside it, and everything that names the partners (the marriage
paperwork's first and second partner, "Hi Priya and Dev" via
`greetNames`) reads them; email and phone as quieter lines under them (placeholders "Email" and
"Phone"), then detail chips
(`new-client-details.tsx`, PropertyChips: Event date with no past days
and "in N days", Venue and Guests (each popover IS the field: one
borderless line led by the chip's icon, no second label or box; Venue
lists the MC's past venues under it, filtered as they type), Package from the MC's packages, Found
you via: Instagram, Google, Referral, Venue, Directory listing, Expo,
Other), then the MC's notes as a bare `Textarea` (`bare`, new) filling
the sheet. Add client is disabled until there is a name; no header or
footer bars and no Cancel (a quiet × top right, the only way out on a
phone; Escape; a click outside); no keyboard shortcut to add, not even
Enter (the user removed ⌘⏎). It replaced a five-field two-column form
with "(optional)" on most labels; the builder stub after New proposal
gains "Send to X"; New invoice / New contract open
`payments/modal/new-document-form.tsx` (pick a client with an accepted
proposal, Send). Each page has an empty state for an account with none
(`dashboard/empty-state.tsx`: a heading and one line on the backdrop, no
panel, centred on the screen; the page and its tab panel stretch so it
can fill the space under the title row, and a bottom padding lifts it by
about half that row, more on phones where the row is taller). The
"Nothing matches that search" panels stay in a panel, since a list is
there to clear back to;
a client can be one person (the second name is optional everywhere),
and lists under 10 rows never fold their settled sections (`unfolded`).

**First-run dashboard** (`pages/dashboard/first-run/`, full screen at
`/design-system/v2/dashboard/new`): where finishing setup and logging in
land. It renders the REAL pages inside an `AccountContext.Provider`
holding a brand new account (`use-new-account.ts`, saved beside the
onboarding handoff). The account arrives with the test client, Clara &
Alex, already in, who replies on a script (`derive.ts`, derived from
send times so a reload resumes mid-reply).

**Home is the real Home** (`first-run/first-home.tsx`, rebuilt
2026-09-30 after the user found a separate guide page weird): the
greeting, the line under it, Ask Zebri with its quick starts, Up next
and its counts, and the Calendar / Enquiries / Notifications icons top
right, all fed by the new account. There is no guide layer: the steps
are **Up next to-dos** (`home-rows.ts`), written as every later to-do
will be ("Clara & Felix accepted MC package. Send the contract."), each
with one button (`UpNextRow`'s `action` variant: buttons only on the
MC's own to-dos, primary on the one that matters now; the text wraps
rather than truncates). While the test client is replying, Up next steps
aside and the line under the greeting is the live commentary ("Sent.
Waiting for Clara to open it…", "Clara opened your proposal.", "Clara
is looking at MC package…", "Clara accepted MC package, $2,400."),
written in by `TypedLine`: each letter fades and sharpens in over
300ms, 22ms apart on the frame clock, no caret, and the old line fades
out before the next starts (a per-character typewriter with a caret read
as jerky). Up next comes back once the last line has written in,
sharpening in with `swap-in`, holding the next to-do's button. Replies
are paced to be read: the proposal's at 3, 7 and 11 seconds, the
contract's and invoice's at 3 and 7 (`REPLY` in `derive.ts`; 1.5s apart
flashed past). A real client's row still shows what they did last and
when. **The booking.** When the test client pays, "Clara paid the
deposit." types out, then (2s later) `booked-celebration.tsx` opens: a compact card (`form`
Dialog, `backdrop="light"`: the usual grey wash muddied the confetti) over Home, lit from behind by a soft halo of the brand colour (`card-glow.tsx`,
lightened towards white, breathing in over 1.6s while the deposit
counts up), and one burst of confetti from each bottom corner of the
window BEHIND the card (`side-cannons.tsx`, the `canvas-confetti`
package as Magic UI's side cannons use it), then stillness: about 26
pieces a side, mostly long thin ribbons that tumble slowly with a few
small squares, in two colours only, grass and the celebration-only
`champagne` gold, each in a light and a deeper step so a turning ribbon
catches the light. Tried and dropped: a stream every frame (busy even
at one a frame) and a four-colour green and blue mix (generic). Both
glow and canvas are fixed at `-z-10` inside the dialog, mounted after
the entrance transform ends.
Then "Your first booking", "Clara & Felix are booked" in the MC's heading
font at regular weight (the celebration loads the brand fonts itself:
reached by a reload or the dev skip, the stack fell back to a bolded
Times; display faces such as the default Italiana have no bold), the
deposit counting up, then the journey: the stops (New enquiry, Proposal
accepted, Contract signed, Deposit paid) light 800ms apart, each
circle filling with a slight spring and its tick drawing itself
(`DrawnCheck`), while one
linear line sweeps through them, reaching each as it lights (a width
step per stop eased in and out at every stop and looked jerky), then "Your
real clients follow the same steps. Zebri tells you as each one
moves." and one button, Take me in (to Home). Rejected along
the way: a brand-coloured full window (the default brand is Zebri's CTA
green, which must never be the page), a full-window takeover on the
light backdrop (too big), our own confetti from the middle (cheap), a
check above the title (too many ticks), "paid in 1 minute" (real
clients take days) and "See your Zebri" or "Add your first real client" as the button. All of this is on
`/design-system/v2` under Moments, Page patterns and Documents. Setup ends when it is closed (`progress.celebrated`; `tour.onboarded`
waits for it, and until then Home adds nothing), and Home then opens in
order instead of all at once: the day's greeting rises in, "That was
the practice run. Now add a real client, and Zebri takes them from
enquiry to paid." types, Ask Zebri rises as the column eases up (padding
transition), then Up next. Closing it also clears the test client and
everything sent to them (`celebrate()`), so Home, Clients, Proposals,
Payments, the bell and the calendar start empty; the brand, packages,
signature, contract wording and blocks stay. Home after setup, modelled
on Shopify's setup guide (the plan is a task beside the job, not a
paywall in front of it): Up next holds "Add your first real client"
(New client, primary) and "Start your free week" (Pick a plan,
secondary; opens the plan sheet with nothing waiting on it, via
`askPlan()`, and leaves once a plan starts). Adding a real client still
opens the same sheet, so either route gets there. Ask Zebri has no quick
starts and no client scope until there is a real client (then Send a
proposal and Send an invoice; Build a run sheet is not on a new account,
which cannot make one yet), and the counts line is hidden while every
count is zero. The replies also arrive as notifications
behind the bell's green dot (`noticesOf`; `useUnread` now remembers
what was read, so later items come in unread). A booked client becomes
an event row with "In N days", as the real Home shows the next event,
and lands on the calendar. The line under the greeting says Clara is a
test client, then "went from new enquiry to paid in under a minute"
once they pay; after that it is empty, as on the real Home. When the
practice run ends nothing swaps: "Add your first real client" is just
the next to-do. During setup (until the test client has paid) Home is
only the greeting, its line and Up next: Ask Zebri, its quick starts
and the counts join once setup is done, and Clara's row waits until the
tools are picked. The sidebar shows every added page, but Proposals,
Contracts, Payments and Journeys stay greyed and unclickable
(`SidebarRow` `locked`, via `NavItem.locked`) until setup reaches them
(`tour.reach`: tools picked, then the contract, then the invoice, then
done); the page a to-do opens is never shown locked. The hand-off from
setup is one motion: the setup panel fades out (`swap-out`) over the
backdrop, the route's loading state is that same backdrop, and the
sidebar eases in while Home rises. Page switches rise in, and an Up
next row's words fade when a reply changes them. The top-right panels take `events` / `enquiries` /
`notifications` (the demo's by default) and have empty states.

**Review links** (2026-10-01): every page of both dashboards has its own
URL so one can be sent for review. Optional catch-all routes
(`dashboard/[[...page]]`, `dashboard/new/[[...page]]`) render the same
client page, which reads the address once and `pushState`s on every
move (Back and Forward work through `popstate`). Demo business:
`/design-system/v2/dashboard`, `/clients`, `/proposals`, `/payments`,
`/journeys`, `/email` (the old `#clients` links still open, and an old
`/workflows` link opens Journeys; inside the
showroom preview the address is never touched). New account
(`first-run/routes.ts`): `/design-system/v2/dashboard/new`, `/clients`,
`/clients/new` (New client open), `/proposals`, `/payments?tab=invoices`
(or `contracts`), `/plan` (the plan sheet over Home; closing it puts the
address back to Home's), `/run-sheets`, `/booking-links`, `/journeys`
(`/workflows` lands on Journeys).
A link to anything but Home, opened with nothing saved, lands on an
account already past setup and the practice run, with the three
first-use blocks in the sidebar (`useNewAccount({ setUp })`); a saved
account always wins. Internal moves never put `/new` in the address, so
a New dialog opened by a to-do does not reopen on reload.

**Block first use** (`pages/dashboard/first-use/`): no tours, no coach
marks, nothing to skip. Each block declares one of three kinds and its
page opens in the matching state, with one line from Zebri typed out on
arrival (`zebri-says.tsx`: the wand in a grass circle and a
`TypedLine`). Works instantly (Run sheets): one already filled in,
badged Example, to edit or delete; New run sheet adds the MC's own
above it and Zebri's line goes. Needs a connection (Booking links): the
page is only that step, centred (Connect Google Calendar, Connect
Outlook, and why), then a drawn tick, "Google Calendar connected", and
Zebri hands over the intro call link, already made, with Copy link.
Needs understanding: Workflows was the example, with three starters
already on; it was removed 2026-10-14 with the Workflows page, and the
automation block now opens Journeys, where a new account already has
its starter journey.

**Build your Zebri** (`first-run/build-your-zebri.tsx`, a `form` dialog
over Home, the first to-do, titled "Recommended starting blocks"; the to-do
says what a block is, led by the word as other rows are led by the
client: "**Blocks** are the Lego pieces of Zebri. Pick only what you need
now, and add more as you grow." (user: playful but clear, Lego with a
capital L, no examples, no sidebar mention, say it avoids clutter;
"tools you add" and "switch on parts of Zebri" were rejected)): the
three every booking runs on, Proposals, Contracts and Payments (where
invoices live; `STARTING_BLOCKS`). A new account arrives without them
(the handoff drops them), so adding them is what puts them in the
sidebar. The intro reads "Win the client with a proposal, lock in the
date with a contract, then get paid." The rows have no Add buttons (the
test client's run needs all three): Add all is the only action, each
row ticks Added as it lands, then Done. Add all is paced to be watched
(`addAll(blocks, { lead: 250, gap: 650 })`): a beat after the click, then
one row at a time, each badge's drawn tick finished before the next
starts (the default 240ms stagger, first at once, read as all three
flashing in); the button keeps "Add all 3" under its spinner rather than
counting down, and Done replaces it only 750ms after the last block
lands, once that row's tick has drawn (arriving with the last row read
as sudden); there is no Not now, and
closing leaves the to-do. The three join the sidebar together on Done,
not one by one behind the open dialog (they showed greyed before the
step was finished). Proposals' catalogue pitch is "Beautiful
proposals you design exactly how you want." (never "world-class") (the old "accept and pay in one
go" was rejected as meaningless). The
rest of the catalogue is named as living in Blocks. During setup Home
sits lower (about the middle of the screen) with more room under the
greeting; it moves up to the real Home's position once Ask Zebri joins.
The sidebar's blocks are saved with the account.

**Creating the documents.** New proposal is two steps (client, template),
then the **proposal editor** (`proposals/editor/`, an `xl` dialog in the
document-modal layout): the couple's page live on the grey desk, and a
narrow (17rem) side of the brand only (logo, brand and accent colour,
heading and body font) under "Make it yours" and one line that sells
the builder: "Start with your look. Later in the proposal builder, you design
every section: photos, videos, words and packages." (a longer version
was cut as too long).
Words and Package tabs were tried and taken out (the files are parked,
unused): this is the template with the MC's brand on it, and saying so
stops them hunting for controls that are not here. The words are the
template's and the package is the account's first (a new account's
starter). The desk ends in `MoreBelow`, a 64px blurred glow stuck to
the modal's bottom edge that fades once the page's end is in view, so
the MC knows to scroll. Send saves the brand to the account.
`ColorField` portals its picker into the enclosing `<dialog>` (the
`container` prop on `ColorPopover`), as `Dropdown` does, since a
modal's top layer covers anything portalled to the body. New contract and New invoice open
`payments/modal/new-document-editor.tsx` in the same layout, with its
own header (`editor-header.tsx`: title only, a second line made the bar
tall; Send to Clara beside Close, top right, as in the proposal editor).
Neither labels the page ("What Clara sees") nor restates who it is for.
**Contract:** Zebri's standard MC agreement (`contract-clauses.ts`, ten
clauses written for an MC, "event" never "wedding") on two A4 pages
(`contract-preview.tsx`: parties, a summary of event, package, fee and
deposit/balance, clauses 1-5; then 6-10 and the signatures, "Page N of
2"). The wording is not editable in the send flow; the side says "Ready
to sign" and that they can bring in their own contract later, then the
signature pad (first time only). The drawn signature shows on the page
as it is drawn (the preview takes a `signature` override), the desk
scrolls to the signature line on each stroke, and the pad crops its PNG
to the ink so it fills the line. **Invoice:** the preview is the
deposit email as the couple gets it (`invoice-email.tsx`), not the paper
tax invoice (that goes with it as a PDF): the MC's brand, the amount and
due date on the brand gradient with a light Pay deposit button under
it, the MC's note signed with their portrait, a two-step payment
schedule (deposit, then balance) over the package total, and the PDF
attachment. The side (17rem, as narrow as the proposal editor's; the contract's stays 24rem for the signature pad) is three plain fields, each taking any value:
Deposit (%, with the amount), Deposit due in, and Balance due before
the event (each a number with a days/weeks/months inline Dropdown inside
the Input, `trailingWide`), each field's help line saying the money or
the date. The note comes written and is not edited here. Tried and
rejected: segmented presets, preset dropdowns (no custom value, old
fashioned), a fill-in-the-blanks sentence (too clever to scan), and a
"Zebri takes care of" list (confusing). Contracts and invoices wear the brand (`letterhead.tsx`: `BrandScope`
and `Letterhead`); ABN, email, phone and bank print only when the
account has them (`account.contact`; the demo business does, a new
account does not), and a new account's clients are billed by the names
and email they gave. Every send returns the MC to Home, where the
replies land.

Anything done
for a real client (adding one, or sending them anything) is queued
behind `plan-sheet.tsx`, an `lg` split modelled on Stripe Checkout and
Superhuman's upgrade sheet, monthly only (a Yearly toggle was removed:
one decision too many). Left, the value (`plan-picker.tsx`): "Start your
free week", why it is open ("To add Priya & Dev"), Pro and Max as
ChoiceCard rows (radio mark, name with a brand Popular badge, who it is
for, the whole-dollar offer beside the usual price struck, and "then
$59/mo after a year"), then what the picked plan includes, a Lucide icon
in a zebra-100 circle per line (Max: Everything in Pro plus Talk to
Zebri; SMS and video calls; Email marketing; Integrations: Instagram,
BDM and calendars).
Right, on a neutral tint (`bg-zebra-950/[0.025]`; zebra-50's cream next
to two olive greens read as off), the payment (`plan-payment.tsx`): Due
today $0 with the plan beside it, the trial as three dated steps (today,
the reminder two days before, the first charge), Apple Pay and Google
Pay as each brand's mark plus "Pay" (Google's in its four colours) (the Apple Pay logo artwork carries
its own outline and read as a box in the button), "or pay by card" and
one `CardField`, Start free week, then "You won't be charged until
{date}. Cancel any time in Settings. Secured by Stripe." No header or
footer bars, a quiet × top right (in a wrapper: the Button is itself
`relative`). Starting the plan runs the queue, so the typed client lands the moment
the card goes in; closing drops it. The test client never asks. Copy
says "event", never "wedding". Pages with no real view yet (Run sheets,
...) are an empty state.

Step 3, What do you charge? (`step-packages.tsx`, `package-row.tsx`,
`packages.ts`): a price list typed straight into, no editor or modal.
Each row is the package name and price as **InlineInput**s at heading
size (name medium, price regular with a muted `$`), divided by
hairlines. It starts with one row (Ceremony only, $900, with Legal
paperwork and One meeting included); a blank row is ignored, and "Add another package" goes up to eight
and puts the caret in the new row's name. Each row has a remove X
(with a mouse, shown on hover or when the X itself has focus, not while typing in the row; always on touch); removing the
last row leaves a blank one. Nothing is suggested: every row shows its
own items as a TagList (each with an X) with "+ Add
an inclusion" at the end, a bare caret with no placeholder (Enter
adds). There is no focused-row state: every row looks the same
whatever has focus, because swapping a row's tags for a one-line summary
on blur made the row above flash when a package was added. Everything moves by height through Collapse, one system: a
new row grows in (`appear`), a removed row folds shut and unmounts after
`COLLAPSE_MS`, so "Add another package"
and the deposit line move with the layout. Only the tags inside a row use
auto-animate. Gotcha: mixing auto-animate (which measures start and end
once) with a CSS height transition nearby makes things snap at the end;
use one or the other for a region. The deposit is set inside a sentence:
"Couples pay [25%] to lock in their date."

Step 4, Your brand (`step-brand.tsx`, `brand-preview.tsx`,
`brand-proposal.tsx`, `proposal-media.tsx`, `proposal-sections.tsx`): the
one **bleed** step (`bleed: true` in `steps-meta.ts`). Under the title the
body runs to the panel's edges and down to the footer: a plain zebra-50
canvas (no dots) with the MC's proposal as a Qwilr-style web page, in
reading order: a navbar (their logo as uploaded, never recoloured, and
business name), a cover photo slot (the couple's names, date and venue,
no tag), a welcome signed by the MC with a portrait slot, a video slot,
how it works (three numbered steps and a three-photo mosaic), their packages, a pull-quote
testimonial between hairlines, and an accept block with their real
deposit. It scrolls inside the canvas, and a gradient of the canvas colour
rises over the bottom edge so whatever sits there fades out. Corners
are tight (`rounded-check`, 4px) throughout the page. Text on the brand
and accent colours comes from `readableOn()` (white or near black by
WCAG contrast ratio, not the app's brightness cutoff), so a dark accent
card gets light text. The default heading font is Italiana. The intro
says every part can be changed later, Canva-style. On the
right, a 208px sidebar with the original controls: logo, brand and
accent colour (the app's ColorPopover), heading and body font (Dropdown,
each font in its own face). No helper copy in the sidebar. Hovering a section of the
page outlines it as a block, the one hint that layouts are edited later
in the proposal builder. Photo and video slots are brand-tinted gradients;
the video carries a small "Your video" tag, so it reads as a slot, not
broken embeds. Brand values reach the page as CSS custom properties from
`brandVars()`.

Step 6, Watch it book (`step-replay.tsx`, `replay/`): the aha, first
built from the 2026-09-24 Claude Design handoff ("Watch It Book"), then
reworked to one big animation with no timeline. It plays once, about
fifty seconds, through ten scenes: enquiry, lead created in Zebri,
instant reply (thanks for reaching out, six call times, Sarah picks
one), video call (a solid brand "Zebri AI is taking notes" pill, live
captions, and each thing said landing in "Their record, filled from the
call" a beat later), proposal (delivered, opened, viewed; no sent time),
accepted (payment schedule: deposit today, balance on a real date),
contract, signed (the couple's signature, then the MC's real step 5
signature, drawn, uploaded or typed), invoice (a realistic tax invoice:
number, issued date, "Deposit, N% of package", GST included at 1/11,
total due in AUD, balance note; then paid by card) and booked (paid,
added to the calendar, "Enquiry to paid deposit in under three days." in
body weight).

Layout (`step-replay.tsx`): one zebra-100 panel, brand vars applied.
Left (`replay-story.tsx`, 240px from lg, above on phones): the scene's
time on one line, a `type-display` headline and one detail line, rising
in per scene inside a stable `aria-live` region; at the foot one
continuous progress bar (SVG, so the fill is an attribute, not a style)
that is also a slider: click or drag anywhere to scrub, arrow keys step
a scene, a playhead dot shows on hover or focus; and a round secondary square Button for Pause, Play and, at the end,
Watch again. Right: the cards stacked absolutely (`replay-parts.tsx`
`Card`, tones paper, tight, bleed, brand), crossfading with a stagger so
two never collide half-faded. Times live only in the story column, never
inside a card. Clock (`use-replay-clock.ts`): elapsed ms measured with
`performance.now` on 50ms ticks, 5.2s a scene, details landing on four
beats (0.8, 1.7, 2.6, 3.5s) via `on(step, beat)`; it runs only while the
step is on screen and stops on the booking. Everything the MC set up
flows in (`replay-data.ts`): business name or logo, brand colour (`--b-soft`
wash and `--b-deep` gradient from `brandVars`), fonts, their first package
and its real deposit and balance, and their signature. The couple, dates,
venue and call are sample data; no card names a price the MC did not set.

Step 7, Choose your plan (`step-plan.tsx`): a highlight Panel banner on
top ("20% off Pro or Max for your first 12 months", a one-time offer),
visible without the primary colour; then Pro ($59), Max ($99) and
Enterprise ("Let's talk"), no free tier. Pro and Max show the discounted
monthly price with "Normally $X" struck through on the line below;
prices include GST. Step 8, A note from the founder, is centred in the
panel (`center: true` in `steps-meta.ts`) with no counter or eyebrow
above it.

**Dialog** (`components/ui-v2/dialog.tsx`): the native `<dialog>` via
`showModal()` (focus trap, inert page, Escape, focus return all from the
browser) holding a solid white card with the modal shadow; a faint
zebra-950/20 backdrop so changes behind it stay visible (`backdrop="light"` washes the page pale instead, for a celebration whose colour behind the card must read bright); closes on Escape and backdrop
click. `size="sm"` (28rem, grows with content), `"md"` (40rem, fixed
height, full screen below `sm`; the default for a sheet) `"lg"` (56rem,
for a rail beside a list) or `"xl"` (72rem by up to 52rem tall, for a
record with a rail and a working column: a client's profile). `data-autofocus` picks the first focus
(skipped on touch so the keyboard stays down). The surface is solid white, not glass,
and the backdrop is not blurred: stacked backdrop-filters made Chrome
flicker while the dialog scrolled. Gotcha: the page outside a modal dialog
is inert, so anything portalled to `<body>` opens behind it; `Dropdown`
portals into the enclosing dialog, and any new popover must do the same.

**Popover** (`components/ui-v2/popover.tsx`): Radix Popover on the
shared floating surface (`FLOATING` in `control-styles.ts`: white,
zebra-200 hairline, `shadow-lg`, 120ms fade), which the `Dropdown` menu
also uses (`MENU_ITEM` rows too), so every menu matches. Sizes: `menu`
(10px corners like the buttons, rows 6px, 4px inset, `MenuOption` rows with the grass check;
`multiple` makes a row one of several that can be on at once, announced as a checkbox, as in a Show menu),
`card` (320px, 10px, padded: facts and one action) and `panel` (384px,
10px, scrolls, brings its own layout: the dashboard's calendar,
enquiries and notifications). Like Dropdown it portals into an
enclosing dialog. Never hand-roll a Radix popover in a page.

**Swap** (`components/ui-v2/swap.tsx`): one control's states in the same
spot (`active` + a `states` record), handed over in place: the old state
softens and fades (`swap-out`, 200ms, then unmounts, `inert` meanwhile),
the new one sharpens and settles from 94% (`swap-in`, 320ms after a 60ms
lead). States share one grid cell, so nothing around them shifts. The
first render never animates; reduced motion drops it all. Use it for any
button that becomes a status (Add to Added, Upgrade to Add), never a
`{done ? <Badge/> : <Button/>}` that snaps.

**Sheet** (`components/ui-v2/sheet.tsx`): a panel that slides in from
the right of the `relative` surface it sits in (a dialog, a region) over
a zebra-950/10 scrim; not a portal or a new top layer. Focus moves in
(`data-autofocus`, else the sheet) and returns on close; Escape and a
scrim click call `onClose`, and Escape is stopped so an enclosing
`Dialog` stays open. Keep it mounted: it slides out and is `inert` shut.
For a focused job that should not replace the page behind it (reviewing
a drafted message on a client's profile).

**DrawnCheck** (`components/ui-v2/drawn-check.tsx`): a tick whose stroke
draws itself (`tick-draw`, 400ms after a 150ms beat). Inside a `Swap` it
draws only when its state arrives by a hand-over (via
`SwapAppearContext`), so ticks already there when a dialog opens sit
still; outside a Swap it draws on mount. A leaving state is frozen as it was (a `memo` that stops updating), so
a spinner that clears in the same render never flashes the label back
while it fades. A Swap settles its arrivals
after 800ms, so reopening a `<dialog>` (which restarts attached CSS
animations) does not replay them. `currentColor`.

**Segmented** (`components/ui-v2/segmented.tsx`): two to five options in
one 32px track, the pick raised on a white thumb; buttons with
`aria-pressed` in a labelled group. Optional `counts` shows a quieter number after each label, for a filter. `iconsOnly` shows only each option's icon (a choice that reads better seen than named), with the label read out and on hover.

**Tabs** (`components/ui-v2/tabs.tsx`): the views of a whole page (the
Clients page's For you / Board / List). Labels with a 2px ink bar under
the current one drawn by `after:` (no full-width rule under the row), an
optional quiet `count` and a grass `dot` for a view with something new. A
real `tablist` with roving focus (arrows, Home, End); the caller's panel
takes `role="tabpanel"` and `aria-labelledby={tabId(id, value)}`. For a
small setting inside a form, use `Segmented` instead.

**Disclosure** (`components/ui-v2/disclosure.tsx`, 2026-10-16, in
Display): a question that opens to its answer, for an FAQ. The whole
question line is the button and wraps to as many lines as it needs (a
`Button` is a fixed 36px and would clip a long question on a phone); a
plus becomes a minus as the answer eases open through `Collapse`, the
question in regular weight. Stack them in a list with `divide-hairline`.
Used by the marketing page's FAQ.

**Swipe row** (`components/ui-v2/swipe-row.tsx`, 2026-10-19, in
Display): a list that swipes sideways below `until` (`md` or `lg`), one
item at a time with the next peeking in, bleeding to the screen edge
and snapping to the gutter (`scrollbar-none` hides the bar; `py-6
-my-6` so the scroller does not clip a card's ring or shadow); from
`until` up it is a plain list laid out by `className`. `item` sets the
swipe width (`card` 85%, `wide` 90% for the Zebri AI windows, `step` 16rem); `current` keeps one item in view
for a row that moves on by itself, scrolling the row only. Inside a grid
give its wrapper `min-w-0`, or the cell grows to every item and the row
never scrolls. Used by the marketing page's pricing, Zebri AI and
Journeys.

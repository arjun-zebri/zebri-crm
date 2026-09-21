# Proposal template editor: UI/UX audit against Qwilr

Date: 2026-09-17. Scope: the Phase 2 template editor at `/proposals/templates/[id]` (commit `83636016`) and the Templates tab, compared with Qwilr's page editor (the two reference screens: the welcome page with an image block selected, and the pricing block with an item-price popover). Method: walked our editor state by state on an isolated dev server as a first-time user would, then set each state against what Qwilr shows at the same moment.

## 1. Verdict

The engine underneath is sound (one history, autosave, spec-parity nodes, resizing, mobile canvas, all live-verified). The experience on top of it is not usable by someone who did not read the spec. Qwilr's editor tells you what to do at every moment; ours tells you nothing until you have already done the right thing. The gap is not polish, it is the interaction model:

- Qwilr: **persistent chrome**. A library panel is always open on the left, every block has a visible toolbar the moment you are in it, every boundary has a visible `+`, and every piece of content inside a block is directly clickable with a labelled form beside it.
- Ours: **hidden chrome**. Nothing is visible until you click on text inside a section. Adding is a hover-only line. Block settings are icon-only bars that only appear after a selection, in a strip at the top of the canvas away from the thing you selected.

Recommendation: rebuild the chrome to Qwilr's model (section 6) on top of the existing engine. The engine does not change; the surfaces around it do.

## 2. The first 30 seconds

| Moment | Qwilr | Ours |
|---|---|---|
| Page opens | White or block-coloured page on a neutral workbench, page title editable in the top bar, library panel open on the left with thumbnails you can drag in, a `+` at the top of the page. | A full-viewport beige field with one line of grey placeholder text ("A proposal to host your reception"). No page edge, no panel, no `+`, no hint. The workbench colour (`#F4F4F1`, dot grid) is painted but the proposal's own page sheet is never painted, so sections float on the workbench. |
| Mouse over a block | Block outline appears, floating block toolbar appears at the block's top-left (more, style, colour, move up, move down, duplicate, delete), `+` at the top and bottom edges. | A 6 px drag handle fades in at the far left. Nothing else. |
| Click inside a block | Text caret plus inline text toolbar. Clicking an image selects it with resize handles and an image toolbar directly above it. Clicking a price opens a labelled form (Item Price, Billing frequency). | Clicking on text selects the section (ring) and puts a section bar in a strip at the top of the canvas, 400 px away from the click. Clicking the section's padding does nothing. Clicking a price does nothing (data sections are read-only in Phase 2). |
| Want to add something | Drag a thumbnail from the library, or click a `+` on a block edge and pick from a categorised gallery with previews. | Find the invisible line between two sections by hovering, click a small `+`, get a text list (Text, Packages, Gallery, ...) with no previews. Or scroll to the very bottom for an "Add section" button. |
| Want to know what a block is | Thumbnail and category name in the library; block outline with its controls on hover. | No label anywhere. The section bar shows the name only after selection. |

## 3. Audit by area

Severity: **Blocker** (a new user cannot proceed), **Major** (works but undiscoverable or wrong), **Minor**.

### 3.1 Canvas and page

| | Qwilr | Ours | Gap |
|---|---|---|---|
| Page sheet | The page is a distinct surface (white by default, or the block's own background) on a neutral workbench. | No sheet. `CanvasFrame` paints the workbench (`DOC_CANVAS_BG` `#F4F4F1` with a dot grid) and `SectionCanvas` renders sections straight on it. `render/layout.tsx` paints `branding.page_background` on the public page; the editor skips it. | **Blocker.** The "grey/gold background" complaint. Paint the page sheet (`branding.page_background`, `text_color`, fonts) in the editor exactly as the public layout does, with a visible edge and shadow, on a cooler neutral workbench. |
| Hero section | A hero block is a hero: image or colour fill, big type. | The default hero has no background and `height: 'full'`, so the first screen is a viewport-tall empty box with muted text. | **Blocker** for first impressions. The default template needs a real hero (brand colour fill at minimum) and full-height sections need a visible bound on the canvas. |
| Empty variables | `[Client.Company]` shown as a labelled token. | `{{couple_name}}` renders as blank ("Write a note to  about their day."). | **Major.** Render variables as chips in the editor (`couple_name`) like the Branding editor does. |
| Zoom | None needed; the page is the page. | Zoom widget bottom-centre, default 92%. | Minor. Keep, but default to 100% and make the sheet fit. |

### 3.2 Discoverability of controls

| | Qwilr | Ours | Gap |
|---|---|---|---|
| Block hover | Outline + toolbar + `+` edges. | Drag handle only. | **Blocker.** Every section needs a hover outline, a name label (top-left tag: "Hero", "Packages"), and its toolbar. |
| Where the toolbar lives | Anchored to the block (top-left of the block). | A strip at the top of the canvas, detached from the section. Text bubble can render behind it (fixed) and covers the line above the selection. | **Major.** Anchor the section toolbar to the section. |
| Toolbar legibility | Icons with tooltips, but few of them; the heavy settings open a labelled popover. | Section bar has 12 controls in one row, icon-only for background, padding, align, colour; the name field looks like a disabled input. | **Major.** Fewer controls in the bar (move, duplicate, delete, style), labelled popover for the rest. |
| Selecting a section without text | Click anywhere in the block. | Only clicking on text (editor focus) selects; padding clicks are ignored except via an invisible full-size "Select section" button that is under the content. | **Blocker.** Click anywhere in a section selects it. |
| Keyboard | Standard. | Standard, plus Escape steps out; fine. | None. |

### 3.3 Adding content

| | Qwilr | Ours | Gap |
|---|---|---|---|
| Library | Persistent left panel: Library / Explore tabs, search, filters (All, Blocks, Snippets, Images, Videos), categorised thumbnails (Introductions, Executive Summaries, Product Features, Pricing & Quotes, Agreements & Acceptance, Terms & Conditions). Drag in or click. | No panel. A palette opens from a hover line or the trailing button: two text tabs (Sections, Presets), seven plain rows each, no thumbnails, no search. | **Blocker.** Build the library panel: categories, rendered thumbnails of each preset (we already render every preset through the real renderer, so thumbnails are a scaled render), search, drag to insert or click to append. |
| Insert point | `+` visible at the top and bottom edge of the hovered block. | Hover line (1 px, invisible until hovered) between sections; "Add section" button at the very bottom. | **Blocker.** Visible `+` on the hovered section's edges. |
| Inside text | `/` and a `+` in the text toolbar (same as ours). | `/` slash menu and `+` in the text bar. | None. Ours matches. |

### 3.4 Editing content inside blocks ("everything can be clicked")

| | Qwilr | Ours | Gap |
|---|---|---|---|
| Rich text | Click and type; inline toolbar. | Same. | None. |
| Pricing block | Every cell is clickable: plan name, price (opens a labelled form: Item Price, Billing frequency, payments connect), features, button label. | Packages section is a read-only render of v1 data. Nothing inside it is clickable. Same for Gallery, Video, Testimonials, FAQ, Accept. | **Blocker** for the product promise, and the spec parked it as Phase 3. It should be pulled forward: in-place editing of every field of every data section, with a labelled popover for structured fields (price, frequency, deposit). |
| Image | Click: handles + toolbar above the image (link, size, replace, crop, alt, align, duplicate, delete). | Click: ring + grips; toolbar in the strip at the top of the canvas. Replace/alt/caption behind icon-only buttons. | **Major.** Anchor the image toolbar above the image; label alt/caption. |
| Buttons | Click the button, edit label and action in a popover. | Same controls, but in the detached strip. | Minor once the toolbar is anchored. |

### 3.5 Block toolbar (per section)

Qwilr's block toolbar is six things: more, style (theme), colour, move up, move down, duplicate, delete. Ours is twelve: name, background, width x3, height x2, padding, align x2, text colour, more. Qwilr puts layout and colour behind "style" as a labelled panel with a preview. Ours exposes every knob at once, unlabelled.

**Major.** Split into (a) a small anchored toolbar: name tag, style, move up, move down, duplicate, delete; and (b) a labelled Style popover: background (colour, image, video, overlay), width, height, padding, text colour, alignment, hide on phone. Reset lives in the popover.

### 3.6 Text editing bar

Ours is functionally richer than Qwilr's (font, size, case, variable insert). Two problems: the Size select truncates (fixed in the final round), and the bubble covers the line above the selection with almost no offset. **Minor.** Offset the bubble 8 px and keep it inside the sheet.

### 3.7 Header

| | Qwilr | Ours | Gap |
|---|---|---|---|
| Title | Editable inline, pencil icon. | Editable inline (click), no affordance. | Minor. Add the pencil. |
| Status / value | "Draft" and the page total ("$199.00"). | "Saved". | Minor now; the total matters in Phase 4. |
| Actions | Collaborate, Share, Preview (eye), page settings, download, more. | Undo, redo, desktop/mobile toggle. No preview. | **Major.** Preview (open the public renderer in a new tab or overlay) is the one action a template author needs and does not have; it was deferred to Phase 4 and should not be. |
| Back | Logo home. | Arrow with no label. | Minor. "Templates" label next to the arrow. |

### 3.8 Templates tab and "New template"

| | Qwilr | Ours | Gap |
|---|---|---|---|
| List | Cards with rendered thumbnails, names, last edited. | Text rows: name, Default badge, Open, Delete. No thumbnail, no date. | **Major.** Card grid with rendered thumbnails and "edited 2h ago". |
| New | "Create page" opens a chooser: start from scratch, or pick from a template gallery with previews and categories. | "New template" instantly creates "Untitled template" with the full default 9-section layout and stays on the list. | **Blocker** (the flow you specified). See section 7. |
| Duplicate | Yes. | No. | Minor. Add Duplicate to the row/card menu. |

### 3.9 First run and empty states

Qwilr's welcome page is itself a tutorial ("Select any text above and make it bold or change the colour"). We have no first-run hint, no empty-template state (a scratch template would be an empty canvas with no instruction), and the loading/error states are bare.

**Major.** A "start from scratch" template needs an empty-state card in the middle of the sheet ("Add your first section" with the library open), and the first open of the editor should show a three-step coach mark (add, edit, preview) that dismisses permanently per user.

### 3.10 Visual design

- Workbench colour: `#F4F4F1` reads warm and muddy behind the beige default page. Use a cool neutral (`bg-surface-muted`) and let the sheet carry the brand colour.
- Placeholder copy in the default hero is set in `text-text-muted` on a muted background: no contrast, reads as disabled.
- Section names, drag handle and hover states use 1 px hairlines at `border-border`; at 92% zoom they vanish.
- Data sections (packages) render at full public fidelity, which is right, but with no edit affordance they read as a screenshot.

### 3.11 What we do as well or better

Mobile canvas (Qwilr has a preview only, we edit in it), undo across sections and text as one history, autosave with status, section width/padding drag with snapping, the `/` menu, spec-level node parity (columns, spacer, audio, variables). None of this is visible to a new user, which is the whole problem.

## 4. Root cause

The spec (section 3, 4) chose "bars on selection" and "hover add lines" as the interaction model and every task implemented that faithfully. The reviews checked spec compliance, not "can a stranger use this". The live check verified behaviours, not comprehension. The fix is a model change, not a list of tweaks, and it needs a walk-through with you at each step rather than another review-gated batch.

## 5. Priority

1. **Blockers, in order:** page sheet; click anywhere selects; hover outline + label + anchored toolbar; visible `+` edges; library panel with thumbnails; New template chooser + gallery; a real default hero.
2. **Majors:** in-place editing of data sections (pull Phase 3 forward); preview; templates grid with thumbnails; labelled Style popover; variable chips; coach marks.
3. **Minors:** bubble offset, pencil on title, back label, zoom default, duplicate template.

## 6. Proposed direction (for approval)

Adopt Qwilr's model on the existing engine:

- **Three regions:** left library panel (collapsible, open by default), the page sheet in the middle on a neutral workbench, no right panel (settings live on the block, as in Qwilr).
- **Library panel:** tabs Blocks / Snippets (later) / Images; search; categories matching the preset ids (Openings, About you, How it works, Packages and pricing, Gallery and video, Social proof, FAQ, Acceptance, Closing); each entry is a scaled render of the real preset; click appends after the selected section, drag inserts at a drop line.
- **Section chrome:** hover outline, name tag, anchored toolbar (style, move up, move down, duplicate, delete, more), `+` on both edges; click anywhere selects; Style opens a labelled popover.
- **Content chrome:** image/button/embed/audio toolbars anchored above the node; data sections editable in place with labelled popovers for structured fields.
- **Header:** editable title with pencil, status, Preview, device toggle, undo/redo, more.
- **Templates tab:** card grid with thumbnails; New template chooser (section 7).
- **Keep:** the engine (state, extensions, autosave, resizing, mobile canvas), the text bubble, the slash menu.

Estimated as its own phase ("Phase 2.5, editor chrome"), roughly the size of Phase 2's UI half: the library panel, section chrome, templates grid and chooser are new; the bars are re-homed, not rewritten.

## 7. New template flow (as specified)

1. Templates tab, **New template** opens a modal: two large choices, **Start from scratch** (an empty layout: one blank content section, library panel open, empty-state card) and **Use a template**.
2. **Use a template** opens a second modal: a gallery of starter templates with rendered thumbnails, a name and a one-line description each, filter chips by category (Reception MC, Ceremony, Full day, Minimal), a preview button that opens the public renderer in an overlay, and **Use this template**.
3. Both paths ask for a name in the same modal (default "Untitled template", or the starter's name), create the template, and open the editor.

Data: starters live where `defaultTemplateLayout(role)` and the role starters live today (`features/proposals/model/presets.ts` and the Branding starters), extended to a small catalogue with ids, names, descriptions and categories. Thumbnails are rendered from the layout, not stored images.

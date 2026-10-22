---
name: new-icon
description: Draw a custom Zebri icon for the v2 design system (glyph, Blocks tile or empty-state spot), preview it live on /design-system/v2, iterate with the user, then wire it into components/ui-v2/icons. Use when the user asks for a custom, new or Zebri icon, or something Lucide does not have. Invoke with /new-icon <name> "<brief>".
argument-hint: "<name> \"<brief>\""
---

# Draw a v2 icon

Request: **$ARGUMENTS** (a kebab-case name, then a one-line brief of what it shows).

Zebri's v2 icons are hand-written SVG paths on a fixed grid, rendered through
`createIcon` (`components/ui-v2/icons/icon-base.tsx`), so each one has Lucide's
props and type and can fill any `icon` prop a Lucide icon can.

**Every v2 icon is a Zebri icon** (user ruling, 2026-10-14: Lucide was
removed from v2 and its 117 icons redrawn here). Before drawing, check
`components/ui-v2/icons/index.ts`: if an existing icon already says it,
use that instead of drawing a near-duplicate.

**This skill only creates icons.** Never swap existing Lucide usages for the
new icon unless the user separately asks.

## 1. Pick the tier

| Tier | Size in use | viewBox | Colour | Status |
|---|---|---|---|---|
| `glyph` | 14 to 24px (`size-3.5`, `size-4`, `size-5`), inline with text and controls | `0 0 24 24` | `currentColor` only | **LOCKED** (Soft) |
| `tile` | about 40 to 48px, the art on a Blocks tile | `0 0 48 48` | currentColor + one accent token + a muted fill | **UNLOCKED** |
| `spot` | about 96 to 160px, empty states and onboarding | `0 0 160 160` | currentColor + one accent token + a muted fill | **UNLOCKED** |

Infer the tier from the brief ("tile for the Calls block" is a tile, "no clients
yet" is a spot, anything inline is a glyph). If it is unclear, ask once.

If the tier is **UNLOCKED**, run *Locking a tier* (below) before drawing the
requested icon.

## 2. Rules

### Glyph (locked 2026-10-02: direction B, Soft)

- 24 grid, `fill="none"`, stroke 1.5, round caps and joins. The frame sets these;
  never put `strokeWidth`, `fill` or colour on a path.
- **Soft corners:** the main object is a rounded rect with `rx="4"`. Smaller
  inner shapes use `rx` 1 to 2.
- **Padding:** keep everything inside 2.5 to 21.5 on both axes. The main object
  is 15 to 17 wide and 18 to 19 tall when it is a document or clipboard.
- **No folded corners.** A document is a soft rect, with a title line
  (`M8.5 7h7`) when it needs one.
- **List markers are dots:** zero-length strokes (`M8.5 11h0`) that round caps
  turn into dots. Rows sit 3.5 apart; a row's line starts 3 after its dot.
- **Handles and clips are arcs**, e.g. `M9.5 4a2.5 2.5 0 0 1 5 0`, not rects.
- **Gaps of at least 1.5** between separate strokes, so it survives 14px.
- **Centre it vertically.** The drawing's top-to-bottom extent, clapper,
  tail and handles included, should be centred on y 12 (within about 0.5).
  Icons sit side by side in the top-right panel, and one drawn low reads as
  dropped (the first bell sat at 14.25 and looked sunk next to Calendar).
- Coordinates on whole or half units. No transforms, no `<g>` unless grouping
  is essential, and at most about 5 elements. The exception is a computed
  outline (a cog's teeth): generate it with a script as exact lines and arcs,
  round to 2 decimals, and say so in the TSDoc (see `settings.tsx`).
- **Taste rulings from the user:** no currency symbols, price tags or
  wallets (Payments is a soft card with a dotted number); no spiky or
  scalloped cogs (Settings has straight teeth with round tips). Check every
  draft at 14px for an accidental face, animal or flower and drop it if so.
- One colour. No `opacity`, no second tone, no fills.
- Reference drawings: everything in `components/ui-v2/icons/` (Home, Clients,
  Calendar, Documents, Enquiries, Notifications, Payments, Settings, Blocks,
  Run sheet, Ceremony script). Match their weight and density. Home and
  Clients share the arch; reuse it where a shape wants to belong to that pair.

### Tile: UNLOCKED

Lock it the first time a tile is requested (see *Locking a tier*). Start the
directions from the glyph style scaled to the 48 grid (stroke 1.5, `rx` 8).
Each direction may add **one** accent from the v2 palette (`text-grass-500`,
`text-azure-500`) and **one** muted fill (`fill-zebra-950/5` or the accent's
`-100`).

### Spot: UNLOCKED

Lock it the first time a spot is requested. 160 grid. Directions to try: the
glyph style scaled up (stroke 1.5, so it stays light), a two-layer version with
a muted backing shape, and an accented one. Same colour budget as tile.

### Colour in tile and spot

`createIcon` sets `stroke="currentColor"`, so the parent's text colour paints
the line work. For the accent, set a token class on the element or group
(`<g className="text-grass-500">`), which recolours `currentColor` inside it.
A muted fill uses a fill utility (`className="fill-zebra-950/5"`). Never use hex,
never use `fill-[#…]`, and never use a colour outside the v2 palette in
`app/globals.css`.

## 3. Draft

1. Name the component `<PascalName>Icon` (e.g. `questionnaire` becomes
   `QuestionnaireIcon`) and create `components/ui-v2/icons/<name>.tsx` from
   `template.tsx.txt` in this folder.
2. Sketch the composition in words before writing paths: the main object, at
   most two details, and how it differs from the existing icons in the folder.
3. Write the paths by hand on the tier grid, following the rules above.
4. Export it from `components/ui-v2/icons/index.ts` (keep the alphabetical
   order) and append an entry to `ICONS` in
   `app/design-system/v2/foundations-icons.tsx` with the name, tier and brief.

Draw **6 variants** by default as separate temporary components
(`<Name>IconA` to `F`) in the icon's own file, registered on the page with a
`DRAFT` brief, and let the user pick; when they ask for more, keep lettering on
(`G` to `L`) and drop the rejected round. Describe each one in a line, flag the
weak ones honestly, and give a recommendation. Once picked, rewrite the file as
the single `<Name>Icon` and delete every draft.

## 4. Preview and iterate

1. The dev server is the user's (`localhost:3000`); never start or restart it.
   If the page 500s on something outside your files, it is another session's
   work in progress: wait and retry, never fix it.
2. Open `http://localhost:3000/design-system/v2#icons` in Chrome, scroll to the
   tier, and zoom on the icon's cell. Check it on light and on ink at every
   size, and look for strokes merging at the smallest size.
3. Fix what you see before you show it. Then show the user the zoomed
   screenshot and ask: approve, or what to change.
4. Iterate until they approve. Keep each round to the change asked for.

## 5. Checklist before reporting done

- [ ] Follows the tier's rules (grid, padding, corners, stroke, colour budget).
- [ ] Built with `createIcon`; no raw `<svg>` anywhere else.
- [ ] TSDoc on the module and the export, with an `@example`.
- [ ] Exported from `index.ts`, listed in `ICONS` on the Icons page.
- [ ] `npm run typecheck` shows no new errors, and `npm run lint:gate` passes.
- [ ] No em dashes in comments or the brief.
- [ ] No unit tests (v2 preview work is verified visually).
- [ ] Nothing committed. Report the files changed.

## Locking a tier

1. Draw the requested icon in 3 directions as temporary components, plus one
   more sample subject so the style shows on two drawings.
2. Add a temporary "<Tier> directions" block to the Icons page, each direction
   with a name and one line on its idea, and preview it.
3. The user picks one.
4. Rewrite that tier's section in **2. Rules** in this file to match the glyph
   section: concrete grid, padding, corners, stroke and colour rules plus the
   reference files. Mark it **LOCKED** with the date in the table, set its
   values in `TIER_FRAME` in `icon-base.tsx` if they changed, and update the
   Icons section of `.claude/docs/frontend-design.md`.
5. Delete the temporary directions, keep the chosen drawings as real icons, and
   carry on with step 3.

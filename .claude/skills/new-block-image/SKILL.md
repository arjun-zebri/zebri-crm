---
name: new-block-image
description: Make the product image for one block in the v2 Blocks catalogue (the still on a block's detail view, replacing the striped "product image" placeholder), as the real v2 UI zoomed in and cropped, soft like Stripe's product shots. Drafts 3 variants, previews them live in the Blocks dialog, iterates with the user, then wires the picked one in. Use when the user asks for a block image, a product image or shot for a block, or to fill the Blocks placeholder. Invoke with /new-block-image <block-id>.
argument-hint: "<block-id>"
---

# Make a block's product image

Request: **$ARGUMENTS** (a block id from the catalogue, e.g. `payments`).

Every block in the v2 Blocks dialog has a 16:9 still on its detail view that
shows the block at work: the **real v2 UI, zoomed in** and cropped by the
frame, laid out at a fixed 480 by 270 and scaled as one picture
(`BlockImageFrame`). One block per run.

**The feel** (the user's reference is Stripe's payments carousel): real
product UI with real copy, shown big. Cards sit near real size and bleed off
the foot as if the page carries on, pale and nearly flat on a pale canvas,
showing where the block lives and what is on it.

**Rejected, don't repeat** (2026-10-03):
- Round 1: the right pieces, but too small in a 640 by 360 frame, so it read
  as a shrunken screenshot with lots of canvas.
- Round 2: drawn shapes, grey placeholder bars, stickers, tilted chips and
  pastel glows. "Cheap, clip-art" and "doesn't feel like Zebri".
- Round 3: the popover alone, month only. Liked, but "doesn't show
  anything": no readable content. Round 4 added the day's card in front.

## 1. Read the block

Find the id in `CATALOG`. If it is not there, list the valid ids and stop. If
the registry already has a finished image for it, ask whether to redo it.

Read its `pitch`, `about`, `bullets`, `connects` and `worksWith`. Then look at
how the real v2 surface for that block looks (its page under
`app/design-system/v2/pages/dashboard/<feature>/`, or its entry on
`/design-system/v2`). Reuse its real parts (Calendar's image renders the real
`MonthGrid` and `DayEvents`) so the image stays in step with the product.

## 2. Pick the moment

A block image shows **one moment** that sells the pitch, not a tour of the
feature. Write it as one sentence before drawing, e.g.

- Payments: "an invoice card with the deposit just paid, by Apple Pay".
- Enquiries: "an Instagram DM landing as a new client, the reply drafted".

The three drafts are three different moments or three compositions of the
best one. Describe each in a line, flag the weak ones honestly, and give a
recommendation.

## 3. Rules

### Fixed (always)

- **Real components.** Buttons, panels, icons and the feature's own
  section components come from `components/ui-v2/` and the v2 pages. Never
  draw a stand-in for something that exists. The cards themselves are plain
  divs. Handlers get no-ops (`onSelect={() => undefined}`); the frame makes
  everything inert.
- **v2 tokens only.** Colours from the v2 palette (`zebra-*`, `grass-*`,
  `azure-*`, `field`), radii `rounded-panel` / `rounded-button` /
  `rounded-control` / `rounded-check` / `rounded-pill`, type utilities
  (`type-title`, `type-body`, `type-label`, …). No hex, no `bg-[#…]`, no v1
  tokens. Third-party brand colours only through the `Connection` entries in
  `catalog.ts` (their `color`), and only for that service's mark.
- **Icons:** `components/ui-v2/icons` first, then Lucide, at `strokeWidth={1.5}`.
- **Real, short copy:** real names, dates and amounts, never lorem or
  placeholder bars. Fewer rows than the real screen: only what the crop shows.
- **Fresh invented content per block:** new couple names, real-sounding
  Australian venues and suburbs, AUD amounts, plausible dates. Do not reuse the
  demo-data couples (Sarah & Tom, Ella & Noah, Priya & James, Amelia & Jack).
- **Static.** No animation, no hover states, no state. Everything is absolutely
  or flex positioned inside the 480 by 270 scene; nothing depends on the
  container width (the frame scales it).
- **No em dashes** in copy, comments or `alt`.
- `alt` on the frame says what the picture shows in one sentence.

### Style: LOCKED (2026-10-03)

Reference: `images/calendar.tsx` (`CalendarImage`), picked from four rounds.
Every image matches it; drafts vary the moment and composition, not the style.

- **Scene:** 480 by 270, set in `block-image-frame.tsx` along with the
  `bg-zebra-50` canvas and `rounded-panel` corners. Nothing else on the
  canvas: no glows, gradients or patterns.
- **Where it lives + what is on.** Show the surface where the MC meets the
  block (the top-right icon bar and its popover; a page's header and list)
  **and** the content on it. A surface with nothing readable on it was
  rejected ("doesn't show anything"): if the real surface is too tall to show
  its content at real size, lift the key content out onto a second card in
  front of it.
- **Cards:** `absolute rounded-panel bg-field shadow-sm ring-1
  ring-zebra-950/5`. The card in front adds `shadow-md`. At most two cards
  plus a real small control (the icon `Panel`). Never `shadow-lg`.
- **Placement:** the main surface about 32px in from one side (`right-8`),
  the front card about 20px in from the other (`left-5`) and lower
  (`top-28`), overlapping the main surface by roughly a third of its width.
  Small controls sit about 20px from the top (`top-5`).
  **Flip it** when the main surface's left side carries what must be read
  (avatars, names, messages): main card `left-8`, front card `right-5`,
  and narrow the main card so the front card covers only its padding
  (`images/lead-capture.tsx`).
- **Zoom for big surfaces:** a document or a full page at real size read
  "too zoomed in" (user, 2026-10-03). Lay it out at its real width and
  shrink it: documents at `w-[32rem] scale-[0.55]` with the lifted
  section in front near the same scale (`images/proposals.tsx`,
  `images/contracts.tsx`); a booking page at 75%
  (`images/scheduler.tsx`); popovers and lists on a 640 by 360 layer at
  75% (`images/calendar.tsx`, `images/lead-capture.tsx`), keeping their
  own popover layout (icon bar, popover, card in front). Nothing is at
  real size: Calendar and Enquiries at real size read "way too zoomed
  in" (user, 2026-10-03). Zoom out only: do not restyle a popover into a
  document's layout ("we dont want it to look like a document").
- **No doubled edges:** a section component lifted onto its own card may
  bring a divider meant for its old place (`DayEvents` has `border-t`). Drop
  it on the card (`[&>section]:border-t-0`) so the card's ring is the only
  edge. Zoom on every card's top edge before showing.
- **Cropping:** cards bleed off the **bottom** only (`-bottom-6`, or a tall
  card that runs past the foot). Never crop text, a time column or a button
  at a side edge.
- **Type and colour:** the real components' own (`type-subheading` for a
  surface title, `type-label` / `type-body` in rows, `text-zebra-500` for
  secondary). Colour comes only from the product's own marks (kind dots,
  today, a primary button, a service logo from `connects`). No added accents.
- **Content:** one specific, busy moment (one day, one client, one invoice)
  with three or four real rows, real-sounding names, Australian venues, AUD.

## 4. Draft

1. Create `.../blocks/images/<block-id>.tsx` from `template.tsx.txt` in this
   folder, with three exports `<Pascal>ImageA`, `<Pascal>ImageB`,
   `<Pascal>ImageC` (`payments` gives `PaymentsImageA`). Keep the file under
   about 150 lines; if three drafts do not fit, put shared pieces in small
   local components.
2. Register the drafts in `registry.ts`, keyed by letter:
   `payments: { A: PaymentsImageA, B: PaymentsImageB, C: PaymentsImageC }`.
3. When the user asks for more, keep lettering (`D`, `E`, `F`) and drop the
   rejected ones; keep one they liked as a comparison if useful. The
   switcher shows the keys, so letters match what you tell the user.

## 5. Preview and iterate

1. The dev server is the user's (`localhost:3000`); never start or restart it.
   If a page 500s on something outside your files, it is another session's
   work in progress: wait and retry, never fix it.
2. In Chrome, open `http://localhost:3000/design-system/v2/dashboard`, open
   Blocks in the sidebar, then the block. The Draft switcher (the registry's
   letters) sits above the image. Saving a file reloads the page and closes
   the dialog: reopen it, then switch drafts and scroll the image into view
   with a small script instead of clicking (the body scroll jumps).
3. Screenshot each draft at desktop width, and once at a narrow width (about
   400px) to check it still reads when scaled down. Check for clipped text,
   cards touching edges they should not, and anything focusable (Tab must
   skip the image).
4. Fix what you see before you show it. Then show the user the screenshots
   with the one-line descriptions and your recommendation, and ask: which one,
   and what to change.
5. Iterate until they approve. Keep each round to the change asked for.

## 6. Finalise

1. Rewrite the file as the single `<Pascal>Image` (the approved draft) with
   TSDoc on the module and the export. Delete every draft.
2. Set the registry entry to the single component.
3. Check `/design-system/v2#block-images` shows it.
4. The style is locked; if the user asks to change it, rewrite the Style
   section and re-check the existing images against it.

## 7. Checklist before reporting done

- [ ] Follows the Fixed rules and the Style section (locked values once locked).
- [ ] Wrapped in `BlockImageFrame` with a one-sentence `alt`; built from
      real components; no text or button cropped at an edge.
- [ ] TSDoc on the module and the export.
- [ ] Registered as a single component; shows in the dialog and the gallery.
- [ ] `npm run typecheck` shows no new errors, and `npm run lint:gate` passes.
- [ ] No em dashes. No unit tests (v2 preview work is verified visually).
- [ ] Nothing committed. Report the files changed.

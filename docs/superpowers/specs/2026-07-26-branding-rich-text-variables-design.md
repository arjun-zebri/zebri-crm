# Branding editor: rich text + variables (Canva-style)

Status: draft for review
Date: 2026-07-26
Owner: Arjun
Supersedes: the per-block "click-to-style" sub-target work (to be removed in Phase 3)

## 1. Problem

The branding block editor cannot tell the user what is editable and what is
filled in from the CRM. Data-bound text (couple name, amounts, dates, invoice
number) and typed text (titles, notes, labels) look identical, so:

- Users cannot tell a placeholder from real editable text.
- Styling is coarse: one `TextStyle` object per field, applied to the whole
  field. There is no way to format a few words differently (bold one phrase,
  colour one word), which is what "flexible, like Canva" means.

Two earlier attempts (a Title/Subtitle pill, then click-to-select-element with
green highlights) were rejected because they style whole elements, not
selections, and do not address the placeholder ambiguity.

## 2. Goal

Turn every text-bearing block into free, Canva-style rich text:

1. Select any range of text and a floating toolbar formats just that selection
   (bold, italic, underline, font, size, colour, highlight).
2. Data is inserted as **variable chips** rendered `{{ variable_name }}` in mint
   green, matching the email/contract template variables. Chips are atomic:
   move, style, or delete them, but you cannot type inside them. At send time
   each chip resolves to the real value.
3. The rule becomes self-evident: **if it is not a chip, it is editable.** The
   green sub-target highlights are removed entirely.

Structured tables (line items, totals) stay as structured blocks because they
are computed and multi-row; their cells may still contain chips.

## 3. What already exists (reuse, do not invent)

Confirmed by recon:

- **TipTap is installed** with every needed extension: `@tiptap/starter-kit`
  (bold, italic, underline, lists), `@tiptap/extension-text-style`,
  `extension-color`, `extension-font-family`, `extension-font-size`,
  `extension-highlight`, `extension-text-align`, `extension-mention`,
  `@tiptap/react`, `@tiptap/pm`, `@tiptap/html`.
- **A full working toolbar to copy:** `components/ui/signature-editor.tsx` +
  `components/ui/signature-toolbar.tsx` already do font / size / colour / bold /
  italic / underline / highlight on a TipTap selection. Reuse its control
  components and `ColorPopover`.
- **Variable chips already exist:** the email template editor uses TipTap
  `Mention` to render variable chips; `lib/contracts/contract-variables.ts`
  defines a variable registry (`couple_name`, etc.). This is the mint-green
  `{{ ... }}` pattern the user referenced.
- Radix `Popover` is available for positioning the floating toolbar.

Current state that changes:

- `app/(dashboard)/branding/blocks/inline-text.tsx` is a bare `contentEditable`
  with no marks. It gets replaced by a TipTap-based component.
- `lib/branding/sanitize.ts` allows only bare tags (`b, strong, i, em, u, br,
  ul, ol, li, p, span`) with no attributes. It must be extended to allow a
  constrained set of inline mark styles + variable spans.
- Free-text fields (`title.title`, `text.text`, `footer.closingNote`,
  `paymentDetails.*`, `action.primary/secondary`, `businessName`, `tagline`)
  store plain strings today.

## 4. The model

### 4.1 Storage format

**Decision (revised after reading the internals): store TipTap JSON, not HTML.**

The original draft chose HTML strings to minimise churn. On inspection that is
the *less* safe path: `lib/branding/sanitize.ts` is a pure-string tokenizer that
deliberately strips every attribute, and it is the trust boundary for public
money documents. Reworking it to allow inline mark styles (colour, font-size,
etc.) widens that boundary and is the riskiest possible edit.

Instead we mirror the **email signature editor**, which is the proven pattern in
this repo: store TipTap `JSONContent`, and render on the server via
`@tiptap/html` `generateHTML(json, EXTENSIONS)` using a **controlled extension
set** (`lib/branding/rich-text-extensions.ts`). Only marks the schema defines can
ever appear, so no arbitrary attribute reaches the public surface and the
string sanitizer stays untouched for its existing job. Editor and server render
build from the same extension list, so what the MC formats is what ships.

- Free-text block fields change type from `string` to `JSONContent` (a schema
  change handled by `migrateBlocks`: a legacy string becomes a one-paragraph
  doc, preserving `b/i/u`).
- Marks: bold / italic / underline (StarterKit) + `TextStyle` with `Color`,
  `FontFamily`, `FontSize`, plus `Highlight` and `TextAlign` (same set as the
  signature editor).
- Variables: a custom inline atom **Variable node** (`data-variable="id"`), with
  a client React NodeView rendering the mint `{{ label }}` chip and a plain
  server `renderHTML` emitting `<span data-variable="id"></span>`.
- Server render: `generateHTML(json, EXTENSIONS)` then
  `resolveVariablesInHtml(html, values)` (`lib/branding/resolve-variables.ts`)
  substitutes each chip for its escaped display value.

To avoid the `getJSON` null-prototype server-action hazard, editor content is
normalised (plain object) before it crosses a server boundary, per the existing
`toPlainJSON` memo.

### 4.2 Variable registry

New `lib/branding/document-variables.ts`: a per-surface registry of
`{ id, label, description, group }`, reusing/aligning with
`contract-variables.ts` where it overlaps. Scope (user chose "all text-shaped
data"):

- Common: `couple_name`, `business_name`, `abn`, `business_phone`,
  `business_website`, `business_email`.
- Invoice: `invoice_number`, `issue_date`, `due_date`, `subtotal`, `tax`,
  `total`, `deposit_amount`, `deposit_due_date`, `final_amount`,
  `final_due_date`, `balance_due`.
- Contract: `contract_number`, `expiry_date`, `event_date`, `venue`,
  `signer_name`.
- Proposal: `proposal_number`, `expiry_date`, `event_date`, primary option
  totals.
- Portal / vendor timeline: `couple_name`, `event_date`, `venue`.

Dependency: some variables are not yet on the public payloads (for example
`event_date` is not returned by `get_public_invoice` / `get_public_contract`).
Those require a migration to add the column to the RPC before the matching chip
can resolve. Tracked per phase; a chip whose value is unavailable renders empty
(never a raw `{{ }}`).

### 4.3 Editing

Replace `InlineText` with `RichText` (new, TipTap-based):

- Extensions: `StarterKit` (bold/italic/underline/lists as configured),
  `TextStyle`, `Color`, `FontFamily`, `FontSize`, `Highlight`, `TextAlign`,
  `Mention` (configured for our variable registry, mint-green chip node view),
  `Placeholder`.
- A **floating toolbar** appears on non-empty selection: font family, size,
  colour, bold, italic, underline, highlight, plus a "+ variable" inserter.
  Implemented with a selection-driven Radix `Popover` positioned at the
  selection rect, reusing `signature-toolbar` control components. (If we prefer,
  add `@tiptap/extension-bubble-menu`; decide during Phase 1.)
- A block-level "Insert variable" menu lists the current surface's variables.
- Per-field baseline still comes from the role `TextStyle` defaults; inline
  marks override per range.

### 4.4 Public rendering

A new pure resolver `resolveDocumentHtml(html, variableValues)`:

1. Sanitize (extended allowlist: constrained inline styles + `data-variable`
   spans).
2. Replace each `<span data-variable="ID">` with the resolved value for `ID`
   (formatted: currency for amounts, `fmtDate` for dates), preserving any marks
   wrapping the chip. Missing value renders empty.

Public renderers (`title`, `text`, `footer`, `payment-details`, `action`, plus
line-item/total cells that hold chips) render the resolved HTML inside the
element whose baseline style comes from `resolveTextStyle`.

### 4.5 Security

The sanitizer is the trust boundary for public money documents. Allow only:

- Tags: existing set + nothing new structural.
- `style` attribute limited to an allowlist of properties (`color`,
  `background-color`, `font-family`, `font-size`, `font-weight`,
  `text-decoration`, `font-style`) with value validation (hex/rgb, px within
  bounds, known font tokens). Reject `url(...)`, `expression`, `@import`, etc.
- `data-variable` only with an id present in the registry.

Unit tests must prove script/style-attribute injection is stripped.

### 4.6 How variables are styled

A variable is an inline token in the text and takes formatting exactly like a
word does. It is not a fixed-appearance badge on the sent document.

- **On insert:** the chip inherits whatever formatting is active at the cursor.
  Dropping `{{ couple_name }}` after `Congratulations ` in the title gives it the
  title's baseline role style (font / size / colour) plus any active marks at
  that position. It blends in by default; no special styling is applied on
  insert.
- **Formatting a chip:** select the chip (it is atomic, selected as one unit)
  and use the same floating toolbar (bold, italic, underline, font, size,
  colour, highlight). Those marks attach to the mention node and travel with it.
- **Editor chrome vs sent output (critical):** the mint-green `{{ name }}`
  appearance is **editor-only chrome** signalling "this is a variable." On the
  sent document the chip is replaced by the resolved value carrying **exactly
  the marks applied to it**. No mint background, no `{{ }}` braces reach the
  couple. A chip made bold and burgundy renders the value bold and burgundy.
- **Baseline vs per-range:** block-level style (for example the title's size and
  the field's role defaults) applies to the whole field; the variable inherits
  it like surrounding text. Inline marks applied to just the chip override per
  range, the same as any other run.

**Decision (editor feedback):** the mint chip **reflects its own marks** while
editing. The pill keeps `{{ name }}` and the mint background but renders bold /
coloured / resized to match the marks on it, so the user gets live feedback on
how the resolved value will look without a mode switch. A separate "preview
values" toggle (swap chips for styled sample values) is deferred as a possible
later addition, not built in the initial phases.

## 5. What is removed / kept / folded

- **Removed (Phase 3):** the click-to-style sub-target system: `data-subtarget`
  attributes in the public renderers, `activeSubTarget` in `block-frame.tsx`,
  `ActiveTargetLabel`, and the per-control `activeSubTarget` target derivation.
  Block-level selection (delete / duplicate / reorder outline) stays.
- **Kept:** the invoice-correctness fixes (Due vs Expires label, mandatory
  reference, due-row suppression when a schedule exists). These concern the meta
  row, not the text model.
- **Folded (Phase 4):** structured text toggles become variables. The
  `showCoupleName` subtitle toggle becomes "insert a `{{ couple_name }}` chip".
  The Title `Include` dropdown becomes an insert-variable menu plus the meta
  toggles that remain structural (ref/date/ABN can stay as the meta row or move
  to chips; decide in Phase 4).

## 6. Phases

Each phase is its own PR, verified in the running app, tests green, docs
updated.

1. **Foundation.** Build `RichText` (TipTap + marks + floating toolbar reusing
   signature-toolbar). Extend the sanitizer for constrained mark styles + tests.
   Public rendering of marks. Migrate the `Text` block only, as proof. No
   variables yet.
2. **Variables.** `document-variables.ts` registry. TipTap `Mention` configured
   with mint-green chip node view + `{{ label }}` serialization. Insert-variable
   menu. `resolveDocumentHtml` resolver + per-surface value maps + send-time
   resolution for invoice/contract/proposal. Tests for resolution + missing
   values. Add any RPC columns needed (for example `event_date`).
3. **Roll out.** Apply `RichText` + variables to the remaining text blocks
   (title, footer, paymentDetails, action, businessName, tagline). Remove the
   click-to-style sub-target system.
4. **Fold + clean up.** Convert structured text toggles to variables
   (`showCoupleName`, etc.). Reconcile the Title `Include` dropdown. Remove dead
   code and the deprecated `subtitle` field once nothing reads it. Update docs.

## 7. Migration of existing saved blocks

- Plain strings and simple `b/i/u` HTML parse into TipTap without loss; the
  field `TextStyle` remains the baseline. No destructive migration needed for
  Phase 1.
- `migrateBlocks` gains no forced rewrites; variables are additive. Optionally,
  Phase 4 auto-inserts a `{{ couple_name }}` chip where `showCoupleName` was on,
  then retires the flag.
- All migration is idempotent and runs on load (existing pattern).

## 8. Testing + Definition of Done (per phase)

- Unit: sanitizer allowlist (marks allowed, injection stripped);
  `resolveDocumentHtml` (substitution per surface, formatting, missing value →
  empty); TipTap HTML round-trip; public render of marks + resolved chips.
- Integration: send-time variable resolution against real payloads per surface;
  cross-tenant RLS unaffected (no new owned tables).
- E2E (Playwright): select text → floating toolbar → format; insert a variable
  chip; chip renders resolved on the public page.
- No `any`; generated DB types for any new RPC fields.
- Design-system compliant; works desktop + mobile; loading/empty/error states
  unaffected.
- `.claude/docs/branding.md` updated each phase; this spec kept current.

## 9. Risks and open questions

- **Security:** the inline-style allowlist is the critical control. Keep it
  narrow and test it hard.
- **Performance:** one TipTap editor per text block on a page. Mitigate by
  lazy-initialising the editor on focus and rendering static HTML otherwise.
  Validate on a dense document.
- **Server-action serialization:** store HTML (not `getJSON`) to avoid the
  null-prototype mention corruption noted previously.
- **Bubble toolbar dependency:** decide in Phase 1 whether to add
  `@tiptap/extension-bubble-menu` or position a Radix `Popover` at the selection
  rect ourselves.
- **Data availability:** `event_date` and any other not-yet-exposed values need
  RPC additions before their chips resolve (Phase 2).
- **Open question:** do the meta-row toggles (ref/date/ABN) stay structural or
  also become chips? Proposed: keep structural for now, revisit in Phase 4.

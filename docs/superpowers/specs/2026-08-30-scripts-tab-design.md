# Scripts tab design (2026-08-30)

Brainstormed and approved 2026-08-30. Source of truth for the implementation plan in docs/superpowers/plans/.

## Context

Feedback from a bilingual MC/Celebrant: they write a **ceremony / reception
script** (the words they read on the day) in Word today, per couple, and
want it inside the couple record. Their pain is not the editing, it is
**Unicode**: names like *Nguyễn*, *Đặng*, *Zoë* and CJK passages must survive
storage and, critically, render correctly in the printed / on-screen copy.
Fonts without those glyphs print boxes, and a mis-rendered name on the day
is the thing a celebrant is judged on.

Decisions locked in brainstorming (2026-08-30):

- Uses: **print / save as PDF** and **read live on phone/tablet**. No portal
  sharing, no `.docx` export.
- **Multiple named scripts per couple** (Ceremony, Reception, ...).
- **No reuse / templates** in v1.
- **Full Word-like control**: headings, B/I/U, lists, alignment, highlight,
  page break, per-selection font family / size / colour, `{{variables}}`.
- Writing systems: **Latin with diacritics, Greek + Cyrillic, CJK**. RTL out
  of scope.
- Approach A: new tab on a shared document editor built from the branding
  rich-text schema; unbranded print through `printDocument()`; no revision
  history in v1.

## Existing code to reuse (verified)

| Need | Reuse |
|---|---|
| Tab registration | `app/(dashboard)/couples/couple-profile-types.ts` (`CoupleProfileSection` + `SECTION_KEYS`), `couple-profile.tsx` (`NAV_ITEMS`), `couple-profile-body.tsx` (switch), `couple-tab-shell.tsx` (`CoupleTabShell`, `CoupleTabEmpty`). Ordering/hiding/Zod follow from `SECTION_KEYS`. |
| Per-couple doc tab pattern | `app/(dashboard)/couples/mc-portal-vows.tsx` (react-query load, autosave, saved label) |
| Rich-text schema | `lib/branding/rich-text-extensions.ts` (StarterKit, TextStyle, Color, FontFamily, FontSize, Highlight, TextAlign, `Variable`) |
| Safe server render | `lib/branding/render-rich-text.ts` (`generateHTML` → `sanitizeRichHtml` → `resolveVariablesInHtml`), `lib/branding/rich-text-sanitize.ts` (font-family/size allowlists) |
| Variable chip + picker | `app/(dashboard)/branding/blocks/rich-text/variable-chip.tsx`, `lib/branding/document-variables.ts` (`VARIABLES_BY_SURFACE`) |
| Toolbar bits | `components/ui/color-popover.tsx`, `components/ui/select.tsx`, `components/ui/button.tsx`, `components/ui/busy-label.tsx`, `components/ui/row-actions-menu.tsx`, `components/ui/confirm-dialog.tsx`, `components/ui/modal.tsx` |
| Print | `lib/pdf/print-document.tsx` (`buildPrintHtml`, `printDocument`), `lib/branding/fonts.ts` (`googleFontsHref`, `FONT_STACKS`, `GOOGLE_FONT_FAMILIES`) |
| Server action shape | `app/(dashboard)/couples/portal-actions.ts` (`ActionResult`, Zod via `@/lib/api/validate`) |
| RLS + migration shape | `supabase/migrations/20260615000100_add_vows_feature.sql` |

Existing `components/ui/rich-text-editor.tsx` is **not** reused (524 lines,
Mention-based variables, shared by contracts + email; extending it would
change those surfaces).

## 1. Data model + server actions

**Migration** `supabase/migrations/<ts>_add_scripts_feature.sql` (via the
`db-migration` agent; idempotent; no destructive SQL):

```sql
create table if not exists public.scripts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  title      text not null default 'Untitled script',
  content    jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  font       text not null default 'noto_serif',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- indexes on couple_id, user_id; updated_at trigger (reuse existing helper if present)
-- RLS: select/update/delete using auth.uid() = user_id
-- insert/update with check: auth.uid() = user_id AND exists(select 1 from couples c where c.id = couple_id and c.user_id = auth.uid())
```

The parent-ownership clause is deliberate (FK ignores RLS; see memory
`fk_ignores_rls_cross_tenant_write`). Regenerate `types/database.ts` last.

**Schemas** in `lib/documents/script-schemas.ts` (plain module, not
`'use server'`, per `use_server_value_exports`): `scriptTitleSchema`
(1..120 chars), `scriptFontSchema` (enum of `SCRIPT_FONT_IDS`),
`scriptContentSchema` (object with `type: 'doc'`, JSON size ≤ 1 MB).

**Actions** in `app/(dashboard)/couples/script-actions.ts` (`'use server'`),
all returning `ActionResult<T>` from `portal-actions.ts`, validated with
`@/lib/api/validate`:

- `createScriptAction({ coupleId, title? })` → `{ id }`
- `updateScriptAction({ id, title?, content?, font? })`
- `deleteScriptAction({ id })`
- `reorderScriptsAction({ coupleId, ids })`

Content passed from the editor goes through `JSON.parse(JSON.stringify())`
on the client first (`tiptap_attrs_rsc_serialization`).

**Read hook** `app/(dashboard)/couples/use-couple-scripts.ts`: react-query
`['couple-scripts', coupleId]`, client Supabase `.from('scripts')` ordered by
`sort_order, created_at`. Typed from `Database['public']['Tables']['scripts']`.

## 2. Editor, toolbar, fonts

**`lib/documents/script-extensions.ts`** (no React):

- `SCRIPT_EXTENSIONS = [...RICH_TEXT_EXTENSIONS minus FontSize, FontSize, PageBreak]`
  reusing the branding list; `PageBreak` is a new atom block node
  (`name: 'pageBreak'`, renders `<hr data-page-break="">`, parses the same).
- `SCRIPT_FONT_SIZES = [11, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 72]`.
- `renderScriptHtml(content, values)` = `generateHTML(content, SCRIPT_EXTENSIONS)`
  → `sanitizeRichHtml` → `resolveVariablesInHtml`. Extend the sanitizer only
  if `<hr data-page-break>` is stripped (check `rich-text-sanitize.ts`).

**`lib/documents/script-fonts.ts`** (no React):

- `SCRIPT_FONT_IDS = ['noto_serif', 'noto_sans', ...FONT_IDS]`; `ScriptFontId`.
- `SCRIPT_FONT_LABELS`, `SCRIPT_FONT_STACKS` (Noto entries new; branding ids
  delegate to `FONT_STACKS`).
- `CJK_FALLBACK_FAMILIES = ['Noto Sans SC', 'Noto Sans TC', 'Noto Sans JP', 'Noto Sans KR']`.
- `scriptFontStack(id)` = base stack with the CJK fallbacks appended before
  the generic family, so a CJK passage in a Latin script still renders.
- `scriptFontsHref(id)` = Google Fonts css2 URL for the base family (Noto
  Serif / Noto Sans `wght@400;500;600;700`, or `GOOGLE_FONT_FAMILIES[id]`)
  plus the four CJK families. Google serves these `unicode-range`-sliced so
  only used slices download. Mount the `<link>` in the editor (via a small
  `useScriptFonts(id)` hook that appends/reuses a `<link data-script-fonts>`
  in `document.head`) and inline it in the print shell.

**Variables:** add `'script'` to `SurfaceTab` in `types/branding-preview.ts`
and `VARIABLES_BY_SURFACE.script = [...COUPLE, ...BUSINESS]` in
`lib/branding/document-variables.ts`. Check every `Record<SurfaceTab, …>`
compiles (`enabled-surfaces.ts`, preview maps) and add the key where required.
Variable values at print/perform time come from the couple + the MC's
business settings using the same value builder the branding surfaces use.

**Components** (`components/documents/`, each ≤ ~150 lines, TSDoc):

- `script-editor.tsx`: `useEditor` with `SCRIPT_EXTENSIONS` (Variable
  extended with `VariableChip` NodeView), `Placeholder`; props
  `value`, `onChange`, `font`, `editable`. Echo guard copied from
  `branding/blocks/rich-text/rich-text.tsx`. Applies `scriptFontStack(font)`
  via a CSS variable on the wrapper (no inline `style` on elements beyond the
  font stack; if lint objects, register a `data-font` attribute + class).
- `script-toolbar.tsx`: sticky top toolbar. Groups: heading level (`Select`),
  B/I/U, font family (`Select`, catalogue above), font size (`Select`), text
  colour + highlight (`ColorPopover`), align left/center/right, bullet /
  numbered list, page break, insert variable (menu from
  `VARIABLES_BY_SURFACE.script`), undo / redo. Split into
  `script-toolbar-text.tsx` + `script-toolbar-blocks.tsx` if it passes ~150
  lines. Wraps to two rows below `sm`.
- `script-page-break.tsx`: NodeView for the page-break node (a dashed rule
  with a "Page break" label, selectable/deletable).

**Autosave:** in the tab (not the editor): 800 ms debounce on change + flush
on blur / unmount / tab switch; `updateScriptAction`; status shown with
`BusyLabel` ("Saving" / "Saved · 2m ago") so the header never reflows.

## 3. Tab UI, print, perform

**Registration** (4 touches): add `'scripts'` to the union + `SECTION_KEYS`
(after `'vows'`); `NAV_ITEMS` entry `{ key: 'scripts', label: 'Scripts', icon: <ScrollText strokeWidth={1.5}/> }`
(add `ScrollText` to the `LucideIcon` union); branch in
`couple-profile-body.tsx`; component below.

**`app/(dashboard)/couples/couple-scripts.tsx`** (orchestrator, ≤150 lines):
`CoupleTabShell title="Scripts"`, stats `[{ label: tabStat(n, 'script') }]`,
action **New script** (`Button`). State: `openId | null`.

- List view `couple-scripts-list.tsx`: rows (title, "Updated 3m ago"),
  click opens; `RowActionsMenu` with Rename (inline `Input`), Duplicate,
  Delete (`ConfirmDialog`). Skeleton while loading; `ErrorState` on query
  error; `CoupleTabEmpty icon={ScrollText} title="No scripts yet" description="Write the ceremony or reception script you'll read from on the day."`.
- Editor view `couple-script-editor-view.tsx`: back chevron, inline editable
  title (`Input`, saves on blur), font `Select`, **Print** and **Perform**
  buttons, saved label; then `ScriptToolbar` + `ScriptEditor` filling the
  remaining height (`flex-1 min-h-0 overflow-y-auto`).

**Print** `components/print/print-script.tsx`: builds the HTML with
`renderScriptHtml`, wraps in a hook-free `<article class="prose-script">`
element, and calls `printDocument({ title, element, branding: null, canvas: false, fonts: scriptFontsHref(font), bodyFont: scriptFontStack(font) })`.
Extend `PrintDocumentOptions` with optional `fonts` (href) and `bodyFont`
overrides that take precedence over the branding pair; existing callers are
untouched. Print CSS additions in the shell: `[data-page-break]{break-before:page;visibility:hidden;height:0}`,
`h1,h2,h3{break-after:avoid}`, `p{orphans:2;widows:2}`, `line-height:1.6`.
Unbranded by design (performer's working copy).

**Perform** `components/documents/script-perform.tsx`: full-screen `Modal`
(full size variant; add the variant to `Modal` + `/design-system` if it does
not exist), `bg-surface text-text`, renders the same HTML with
`dangerouslySetInnerHTML` (already sanitized) in a scroll container. Controls
top-right: A− / A+ (base size 20–48 px, stored in `localStorage` under
`zebri:script-perform-size:<userId>`, try/catch), Close (Esc). On open
`navigator.wakeLock?.request('screen')` (guarded; re-request on
`visibilitychange`), released on close. The shared `useScriptFonts(font)` hook
keeps the fonts loaded.

## 4. Testing, docs, gates

- **Unit** (`tests/unit/`): `script-extensions` round-trip fixture containing
  `Nguyễn Thị Ánh`, `Đặng`, `Ελένη`, `Дмитрий`, `阮氏映`, a page break, a
  font-family mark and a variable (JSON → HTML → JSON equal; HTML contains
  `data-page-break`); `script-fonts` stack always ends with the CJK families
  and href contains all four; toolbar RTL tests per control; autosave
  debounce/flush; perform stepper clamps and survives a throwing
  `localStorage`.
- **Integration** (`tests/integration/`, local Supabase): owner CRUD on
  `scripts`; cross-tenant SELECT/UPDATE/DELETE return zero rows; INSERT with
  another tenant's `couple_id` is rejected. Check `.error` on every insert.
  Tick the matrix in `.claude/docs/security.md`.
- **E2E** (`tests/e2e/`, desktop + Pixel 5 + iPhone 12): open couple →
  Scripts → New script → type the Unicode fixture → reload → intact →
  Perform shows it → Print opens a window (`context.waitForEvent('page')`).
- **Docs in the same PR**: `database-schema.md` (scripts table),
  `page-specs.md` (Scripts tab), `security.md` (RLS row), `frontend-design.md`
  + `/design-system` entries (script toolbar, page-break node, perform
  overlay, full-size Modal variant if added), `production-readiness.md`
  status line.
- **Gates**: `npm run typecheck` 0, `typecheck:strict` and `lint:gate` at or
  below budget (new code clean), `check:server-action-exports`.
- **Spec file**: first implementation step is to save this design as
  `docs/superpowers/specs/2026-08-30-scripts-tab-design.md` (brainstorming
  convention), then follow with the implementation plan.

## Verification (end to end)

1. `supabase start`, apply the migration, run the grant-repair SQL if the DB
   was reset (`local_db_reset_grant_breakage`), regen `types/database.ts`.
2. `npm test` (unit + integration) green.
3. Isolated dev server on local Supabase (`isolated_dev_server_verification`):
   create a couple, open Scripts, write the Unicode fixture with mixed fonts,
   a highlight and a page break; reload; confirm text and marks persist.
4. Print: the print window shows Noto Serif with correct diacritics and CJK
   glyphs, page break honoured in the print preview.
5. Perform: full-screen, A+/A− steps, screen stays awake on a phone
   (Pixel 5 emulation cannot prove wake lock; check the guard does not throw).
6. Playwright e2e on all three projects.
7. Leave changes uncommitted; report what changed (`feedback_no_self_commit`).

## Revision: first-pass feedback (2026-08-30)

The user's first pass on the built tab changed the design in these ways:

- **No perform view.** The end goal is printing; the fullscreen reading mode
  is gone.
- **No merge variables.** Scripts are written for one couple, not
  templates; the variable node and `{{ }}` menu are removed from the script
  schema.
- **Editor never re-seeded from the row.** Postgres `jsonb` returns the
  document with keys reordered; the string-equality echo guard read that as
  a new document and reset the editor after every autosave (caret to the
  end, selection lost, redo cleared). The view seeds the editor once and
  compares structurally (`scriptDocEquals`).
- **Font size** is a readout with A- / A+ steps through the ladder, like
  Word, not a dropdown.
- **Highlight** trigger carries a colour bar under the glyph, like text
  colour. **Every control has a tooltip.** Undo / redo disable when empty.
- **Back** is a ghost "‹ Scripts" button on its own row; the title input
  keeps the left edge of the toolbar below it.
- **Language control:** a per-script language (`scripts.language`, migration
  `20260830001000`) sets `lang` on the editor and print (spellcheck, CJK
  glyph shapes) and orders the Noto CJK fallbacks; an insert-accented-
  character menu (Vietnamese tone letters, Latin accents, Māori macrons,
  Greek) covers names a keyboard cannot type.

## Revision: second-pass feedback (2026-08-30)

- **Style / font selects hand focus back to the editor.** Radix Select
  restores focus to its trigger as it closes, after `onValueChange`; the
  writer picked a heading, typed into the closed select, clicked back into a
  paragraph and saw "Body" again. The command runs, then focus is deferred
  a tick (`runThenFocus`). Headings use `setHeading`, not toggle.
- **Colour pickers open again.** `ColorPopover` mounts its trigger with
  `asChild`; a wrapper component that did not forward the injected props and
  ref swallowed the click. The trigger forwards both; the tooltip sits
  outside.
- **Print** is the primary button. The print window has no frame border:
  `PrintDocumentOptions.frame` (default `!canvas`, so the builder preview is
  unchanged) is off for scripts.
- **Language** select carries a tooltip saying what it does (spellcheck
  language; Chinese / Japanese / Korean character shapes on screen and in
  print).
- **Accented-character menu** renders its glyphs in the script face at the
  section size with the script's `lang`, so stacked Vietnamese marks (ắ, ệ)
  read clearly. The letters themselves were verified as the 67 precomposed
  Vietnamese lowercase forms (NFC).
- **The script opens in a modal.** The in-tab editor view with a back
  button is gone; the Scripts tab keeps its list and a click opens a
  fullscreen `Modal` (nested over the profile) with the title in the header.
  Backdrop, X or Esc close it and flush any pending autosave.
- **Select focus, properly.** Deferring focus a tick was still a race:
  for ~30 ms after a pick the closed trigger has focus, and keystrokes
  typeahead-select "Body" or reopen the menu. `Select` gained
  `restoreFocus={false}` (prevents Radix's close-time focus restore); the
  toolbar selects use it and focus the editor synchronously.
- **Esc inside a popover** (colour picker, character menu) no longer closes
  the script modal underneath: `useOverlay` ignores an Escape the Radix
  layer already handled (`defaultPrevented`).

## Revision: third-pass feedback (2026-08-30)

- **No block-style (Body / Heading) menu.** The writer sets size and weight
  directly; a heading is bigger, bolder text.
- **Font menu previews each face** in itself. The modal loads the whole
  catalogue's Google Fonts CSS so the previews render; print still loads
  only the faces the script uses.
- **No base-font or language pickers.** The base face is Noto Serif (the
  `scripts.font` column stays at its default; no UI). The language picker
  and its `scripts.language` column are gone: its effects (spellcheck
  language, CJK glyph shapes) were invisible to the writer. Visible language
  support is the Unicode-safe editor, the Noto coverage fonts and the
  accented-character menu.
- **Undo / redo after a font change** is a real history step (a per-selection
  mark) and is covered by the e2e spec.
- **Accented characters** in the popover are body-size, in the script face.

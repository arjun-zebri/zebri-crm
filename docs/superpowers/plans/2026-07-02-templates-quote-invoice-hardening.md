# Quote & Invoice Templates Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the /templates quote & invoice review: make invoice templates consumable in the invoice builder, persist line-item reorder on save, reach parity with the Packages tab (duplicate, confirm delete, edited-ago), separate the internal subtitle from customer-facing applied notes, show cents, validate items, broaden search, fix reorder error handling, bring the new form files onto design tokens, and collapse the two near-identical managers into one shared component.

**Architecture:** A typed `template-store.ts` repository (parameterized by `kind: 'quote' | 'invoice'`, injectable Supabase client so integration tests exercise it directly) owns all persistence, using packages' wipe-and-reinsert pattern for items — which also fixes the lost-reorder bug. A single shared `LineItemTemplateManager` component consumes the store; the existing two managers become thin config wrappers. `useApplySources` gains an opt-in third source (invoice templates) used only by the invoice builder. Column semantics follow packages: `notes` = internal list subtitle, `description` = customer-facing text applied to the quote/invoice on apply.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, dnd-kit, Supabase (typed client from `types/database.ts`), Vitest (unit + integration against local Supabase), Tailwind 4 semantic tokens.

## Global Constraints

- **No commits.** The working tree already carries uncommitted packages-v2 work; the user has not asked for commits. Leave all changes in the working tree.
- No em dashes in copy, comments, or prose.
- TSDoc on every exported API + why-comments on non-obvious logic.
- Semantic tokens only (`text-text`, `text-text-muted`, `text-text-subtle`, `border-border`, `border-border-strong`, `bg-surface-muted`, `bg-card`, `text-danger`). No `gray-*` / `red-*` utilities in touched files.
- Lucide icons `strokeWidth={1.5}`; buttons `rounded-xl`; interactive elements `cursor-pointer`.
- `npm run typecheck` must stay at 0; new code clean under `typecheck:strict`; `lint:gate` budget must not increase.
- Integration tests run against local Supabase (`supabase start`), using `tests/integration/helpers/supabase` (`createTestUser`, `anonClient`, `serviceClient`).
- AUD currency everywhere.
- Column semantics (matches packages): `notes` = subtitle shown in the template list (internal); `description` = text appended to the quote/invoice notes when the template is applied (customer-facing).

---

### Task 1: Shared AUD formatter with cents-when-needed

**Files:**
- Create: `lib/payments/format.ts`
- Test: `tests/unit/lib/payments/format.test.ts`

**Interfaces:**
- Produces: `formatAUD(amount: number): string` — `"$1,500"` for whole dollars, `"$1,500.50"` when there are cents. Consumed by Tasks 4, 5.

- [ ] **Step 1: Write the failing test** (`tests/unit/lib/payments/format.test.ts`)

```ts
import { describe, expect, it } from 'vitest'

import { formatAUD } from '@/lib/payments/format'

describe('formatAUD', () => {
  it('renders whole dollars without cents', () => {
    expect(formatAUD(1500)).toBe('$1,500')
    expect(formatAUD(0)).toBe('$0')
  })

  it('renders cents when present', () => {
    expect(formatAUD(1500.5)).toBe('$1,500.50')
    expect(formatAUD(0.05)).toBe('$0.05')
  })

  it('rounds sub-cent noise instead of showing it', () => {
    expect(formatAUD(10.999)).toBe('$11')
    expect(formatAUD(10.005)).toBe('$10.01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/unit/lib/payments/format.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** (`lib/payments/format.ts`)

```ts
/**
 * Currency display helpers shared by the templates and builders UI.
 *
 * @module lib/payments/format
 */

/**
 * Format an amount as AUD, hiding cents when they are zero.
 *
 * Inputs accept cents (`step="0.01"`), so always rounding to whole
 * dollars misreports totals; always showing `.00` adds noise. Rounding
 * to cents first avoids float artifacts like 10.999 rendering as
 * "$10.99+".
 */
export function formatAUD(amount: number): string {
  const cents = Math.round((Number(amount) || 0) * 100)
  const digits = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100)
}
```

- [ ] **Step 4: Run test to verify it passes.**

### Task 2: Line-item draft cleaner (validation helper)

**Files:**
- Create: `lib/payments/line-item-draft.ts`
- Test: `tests/unit/lib/payments/line-item-draft.test.ts`

**Interfaces:**
- Produces: `cleanLineItems<T extends { description: string; amount: number }>(items: T[]): { items: T[]; blankPriced: number }` — trims descriptions, drops rows that are entirely empty (blank description and zero amount), counts rows that still have an amount but no description. Consumed by Task 4 (form disables Save while `blankPriced > 0`).

- [ ] **Step 1: Write the failing test** (`tests/unit/lib/payments/line-item-draft.test.ts`)

```ts
import { describe, expect, it } from 'vitest'

import { cleanLineItems } from '@/lib/payments/line-item-draft'

describe('cleanLineItems', () => {
  it('drops fully empty rows and trims descriptions', () => {
    const { items, blankPriced } = cleanLineItems([
      { description: '  Reception MC ', amount: 900 },
      { description: '', amount: 0 },
      { description: '   ', amount: 0 },
    ])
    expect(items).toEqual([{ description: 'Reception MC', amount: 900 }])
    expect(blankPriced).toBe(0)
  })

  it('keeps free items that have a description', () => {
    const { items } = cleanLineItems([{ description: 'Planning meeting', amount: 0 }])
    expect(items).toEqual([{ description: 'Planning meeting', amount: 0 }])
  })

  it('flags priced rows with no description', () => {
    const { items, blankPriced } = cleanLineItems([{ description: ' ', amount: 500 }])
    expect(items).toHaveLength(1)
    expect(blankPriced).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement** (`lib/payments/line-item-draft.ts`)

```ts
/**
 * Draft-cleaning rules for editable line-item lists.
 *
 * @module lib/payments/line-item-draft
 */

/**
 * Normalize a drafted line-item list before save.
 *
 * A row that is entirely empty (blank description, zero amount) is
 * an abandoned "Add line item" click, not data, so it is dropped. A
 * priced row with no description would render as "Untitled item" on a
 * customer document, so it is kept but counted in `blankPriced` for
 * the form to block on.
 */
export function cleanLineItems<T extends { description: string; amount: number }>(
  items: T[],
): { items: T[]; blankPriced: number } {
  const kept = items
    .map((item) => ({ ...item, description: item.description.trim() }))
    .filter((item) => item.description !== '' || (Number(item.amount) || 0) !== 0)
  return { items: kept, blankPriced: kept.filter((i) => i.description === '').length }
}
```

- [ ] **Step 4: Run to verify PASS.**

### Task 3: Template store (persistence + the reorder fix) with integration tests

**Files:**
- Create: `app/(dashboard)/templates/template-store.ts`
- Test: `tests/integration/templates/line-item-templates.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/types/database`, `SupabaseClient` from `@supabase/supabase-js`.
- Produces (consumed by Task 5):

```ts
export type TemplateKind = 'quote' | 'invoice'
export interface TemplateRecord {
  id: string; name: string; notes: string | null; description: string | null;
  position: number; updated_at: string
}
export interface StoredItem { id: string; description: string; amount: number }
export interface TemplateDraft {
  name: string; notes: string | null; description: string | null;
  items: { description: string; amount: number }[]
}
export function createTemplateStore(client: SupabaseClient<Database>, kind: TemplateKind): {
  list(uid: string): Promise<TemplateRecord[]>
  listItems(uid: string): Promise<Record<string, StoredItem[]>>
  create(uid: string, draft: TemplateDraft, position: number): Promise<string>
  update(uid: string, id: string, draft: TemplateDraft): Promise<void>
  remove(uid: string, id: string): Promise<void>
  setPositions(uid: string, orderedIds: string[]): Promise<void>
}
```

Implementation notes (why-comments to carry into the file):
- Tables per kind: `quote_templates`/`quote_template_items` (FK `template_id`) vs `invoice_templates`/`invoice_template_items` (FK `invoice_template_id`). Branch per kind for item-row construction; PostgREST bulk inserts need uniform keys on every row.
- `update()` writes `name`, `notes`, `description`, and `updated_at: new Date().toISOString()` explicitly (no DB trigger exists on these tables), then wipe-and-reinserts items in array order at `(i + 1) * 1000`. Wipe-and-reinsert is safe because nothing references template items (builders snapshot by copy) and it makes the form's ordering the source of truth, fixing the lost-reorder bug. Same pattern as `packages-manager.tsx` update.
- `create()` inserts the template at the given position then bulk-inserts items at `(i + 1) * 1000`.
- `setPositions()` updates each id to `(index + 1) * 1000` sequentially (matches existing reorder mutations).
- No `'use client'` pragma: plain module so Vitest can import it and integration tests can inject `userA.client`.

- [ ] **Step 1: Write the failing integration test** (`tests/integration/templates/line-item-templates.test.ts`)

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTemplateStore } from '@/app/(dashboard)/templates/template-store'

import { createTestUser, type TestUser } from '../helpers/supabase'

/**
 * The shared template store behind the Quotes and Invoices tabs.
 * Proves create/update round-trips under owner RLS, that an update
 * persists the form's item order (regression: reorders used to be
 * silently lost), that updates bump updated_at (no DB trigger), and
 * that nothing leaks cross-tenant.
 */
describe('line-item template store', () => {
  let userA: TestUser
  let userB: TestUser

  beforeAll(async () => {
    const pro = { subscription_status: 'active', subscription_plan: 'pro' }
    userA = await createTestUser({}, pro)
    userB = await createTestUser({}, pro)
  })

  afterAll(async () => {
    await userA?.cleanup()
    await userB?.cleanup()
  })

  for (const kind of ['quote', 'invoice'] as const) {
    describe(`${kind} templates`, () => {
      it('creates, lists, and round-trips items in order', async () => {
        const store = createTemplateStore(userA.client, kind)
        const id = await store.create(
          userA.id,
          {
            name: 'Full day',
            notes: 'Most popular',
            description: 'Ceremony and reception, start to finish.',
            items: [
              { description: 'Ceremony hosting', amount: 550 },
              { description: 'Reception MC', amount: 900.5 },
            ],
          },
          1000,
        )
        const rows = await store.list(userA.id)
        const created = rows.find((r) => r.id === id)
        expect(created?.description).toBe('Ceremony and reception, start to finish.')
        const items = (await store.listItems(userA.id))[id]
        expect(items?.map((i) => i.description)).toEqual(['Ceremony hosting', 'Reception MC'])
        expect(items?.[1]?.amount).toBe(900.5)
      })

      it('persists a reordered item list on update and bumps updated_at', async () => {
        const store = createTemplateStore(userA.client, kind)
        const id = await store.create(
          userA.id,
          {
            name: 'Reorder me',
            notes: null,
            description: null,
            items: [
              { description: 'First', amount: 100 },
              { description: 'Second', amount: 200 },
              { description: 'Third', amount: 300 },
            ],
          },
          2000,
        )
        const before = (await store.list(userA.id)).find((r) => r.id === id)!
        await new Promise((r) => setTimeout(r, 10))
        await store.update(userA.id, id, {
          name: 'Reorder me',
          notes: null,
          description: null,
          items: [
            { description: 'Third', amount: 300 },
            { description: 'First', amount: 100 },
            { description: 'Second', amount: 200 },
          ],
        })
        const items = (await store.listItems(userA.id))[id]
        expect(items?.map((i) => i.description)).toEqual(['Third', 'First', 'Second'])
        const after = (await store.list(userA.id)).find((r) => r.id === id)!
        expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime())
      })

      it('reorders templates via setPositions', async () => {
        const store = createTemplateStore(userA.client, kind)
        const rows = await store.list(userA.id)
        const reversed = [...rows].reverse().map((r) => r.id)
        await store.setPositions(userA.id, reversed)
        const again = await store.list(userA.id)
        expect(again.map((r) => r.id)).toEqual(reversed)
      })

      it('denies cross-tenant reads', async () => {
        const storeB = createTemplateStore(userB.client, kind)
        expect(await storeB.list(userA.id)).toEqual([])
        expect(await storeB.listItems(userA.id)).toEqual({})
      })

      it('removes a template with its items', async () => {
        const store = createTemplateStore(userA.client, kind)
        const rows = await store.list(userA.id)
        const target = rows.find((r) => r.name === 'Reorder me')!
        await store.remove(userA.id, target.id)
        expect((await store.list(userA.id)).some((r) => r.id === target.id)).toBe(false)
        expect((await store.listItems(userA.id))[target.id]).toBeUndefined()
      })
    })
  }
})
```

- [ ] **Step 2: Run to verify FAIL** — `npx vitest run tests/integration/templates/line-item-templates.test.ts` (requires `supabase status` up; start it if not).

- [ ] **Step 3: Implement `template-store.ts`.** Both kinds share one generic implementation with two small per-kind branches (item-row construction and item select mapping). `list()` orders by `position asc`; `listItems()` orders by `position asc` and groups by the FK column. All queries filter `.eq('user_id', uid)`; every write also filters by owner. Throw the Supabase error when present so react-query surfaces it.

- [ ] **Step 4: Run to verify PASS.**

### Task 4: Form + editor + preview polish (tokens, cents, validation, Notes field)

**Files:**
- Modify: `app/(dashboard)/templates/template-edit-form.tsx`
- Modify: `app/(dashboard)/templates/line-items-editor.tsx`
- Modify: `app/(dashboard)/templates/package-edit-form.tsx`
- Modify: `app/(dashboard)/templates/line-item-preview.tsx`

**Interfaces:**
- Consumes: `formatAUD` (Task 1), `cleanLineItems` (Task 2).
- Produces (consumed by Task 5):
  - `TemplateEditForm` props gain `description` in `value`/`onSave` payloads and a `takenNames?: Set<string>` (lowercased, excludes the template being edited) that blocks duplicate names:
    `value/onSave shape: { name: string; notes: string | null; description: string | null; items: TemplateItem[] }`
  - `LineItemPreview` gains `notes?: string | null` rendered as an "Applied to the quote/invoice" block under the items.

Changes:

1. **`template-edit-form.tsx`**
   - Add a `Notes` textarea bound to `description` (rows=3, placeholder: `Added to the quote or invoice notes when this template is applied.`), below the Subtitle field. Keep the Subtitle field bound to `notes` but fix its placeholder to `Shown in your template list, not to couples.` Why-comment the column swap (matches packages semantics).
   - Validation: on save run `cleanLineItems`; if `blankPriced > 0` do not save. Compute `nameTaken = takenNames?.has(name.trim().toLowerCase())`. Save button `disabled={isSaving || !name.trim() || nameTaken || blankPriced > 0}`. Show a single quiet hint line above the footer when blocked: `Give every priced line item a description.` or `You already have a template with this name.` (text-xs text-danger).
   - Tokens: `labelClass` → `mb-1 block text-sm font-medium text-text`; `inputClass` → `w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition`; required-star `text-red-500` → `text-danger`; SourcePicker trigger grays → `text-text-muted hover:text-text`; SourceGroup label `text-gray-400` → `text-text-subtle`; option row `hover:bg-gray-50` → `hover:bg-surface-muted`, `text-gray-900` → `text-text`, count `text-gray-400` → `text-text-subtle`.
   - Replace local `formatCurrency` with `formatAUD`.
2. **`line-items-editor.tsx`** — tokens only: header `text-gray-400` → `text-text-subtle`; row border `border-gray-100` → `border-border`; `cellInput` grays → `text-text placeholder:text-text-subtle`; grip/remove `text-gray-300 hover:text-gray-500` → `text-text-subtle hover:text-text-muted` (remove keeps `hover:text-danger`); `$` prefix and add-button grays → `text-text-muted`, `hover:text-gray-800` → `hover:text-text`.
3. **`package-edit-form.tsx`** — same token substitutions (`labelClass`, `subLabelClass` → `text-text-muted`, `inputClass`, textarea, PercentField border/focus/`%` suffix, add-ons blurb `text-gray-500` → `text-text-muted`, required star → `text-danger`); replace local `formatCurrency` with `formatAUD`.
4. **`line-item-preview.tsx`** — replace `formatAUD` local (same name, keep) with the shared import; add optional `notes` prop: when present, render under the items list:

```tsx
{notes ? (
  <div className="mt-3 border-t border-border pt-3">
    <p className="text-xs text-text-subtle">Added to the notes when applied</p>
    <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{notes}</p>
  </div>
) : null}
```

- [ ] **Step 1: Apply the four file edits above.**
- [ ] **Step 2: Verify** — `npm run typecheck` → 0 errors; `npx vitest run tests/unit` → PASS; `grep -n "gray-\|red-500" app/(dashboard)/templates/template-edit-form.tsx app/(dashboard)/templates/line-items-editor.tsx app/(dashboard)/templates/package-edit-form.tsx` → no matches.

### Task 5: Shared `LineItemTemplateManager`

**Files:**
- Create: `app/(dashboard)/templates/line-item-template-manager.tsx`

**Interfaces:**
- Consumes: `createTemplateStore` (Task 3), `TemplateEditForm` (Task 4), `LineItemPreview`, `TemplatePreviewHeader`, `TemplatesActions`, `TemplatesTwoPane`, `StarterCatalogModal`, `ConfirmDialog`, `formatAUD`.
- Produces:

```ts
export interface LineItemTemplateManagerProps {
  kind: TemplateKind
  /** Copy pack so both tabs read naturally. */
  copy: {
    entityTitle: string        // 'Quote Template' | 'Invoice Template'
    toastNoun: string          // 'Template' | 'Invoice template'
    searchPlaceholder: string
    namePlaceholder: string
    starterTitle: string
    starterBlurb: string
    emptyTitle: string
    emptyDescription: string
  }
  emptyIcon: LucideIcon
  starterCatalog: StarterLineItemSet[]  // same type StarterCatalogModal takes today
  onAddStarters: (names: string[]) => Promise<number>
}
export function LineItemTemplateManager(props: LineItemTemplateManagerProps): JSX.Element
```

Behavior (consolidates both managers, plus the fixes):
- Queries: `['line-item-templates', kind]` via `store.list`, `['line-item-template-items', kind]` via `store.listItems`; derive `item_count`/`total` locally as today. Invalidate helper hits both keys **and** `['builder-apply-sources']` (so open builders refresh after template edits).
- **Sources** for the "Add from" picker inside the edit form: quote kind loads packages only; invoice kind loads packages + quote templates (reuse the exact query now in `invoice-templates-manager.tsx`, keyed `['template-sources', kind]`, skipping the quote-templates half for kind 'quote').
- Mutations, all with `onError` toast (including **reorder**, which also invalidates on error to resync the optimistic local order):
  - create → `store.create(uid, draft, (templates.length) * 1000)`
  - update → `store.update`
  - delete → `store.remove`, guarded by `ConfirmDialog` (`confirmDeleteId` state), copy: `Delete template?` / `This permanently deletes "<name>" and its line items. Quotes and invoices already created from it keep their copy.`
  - duplicate → `store.create(uid, { ...sourceFields, name: `${name} (copy)`, items }, source.position + 1)`; select the new id; toast `'<toastNoun> duplicated.'`
  - reorder → `store.setPositions`
- **Search** matches name, subtitle (`notes`), applied notes (`description`), and item descriptions (case-insensitive, against the items map). Drag stays disabled while searching.
- Detail pane: `TemplatePreviewHeader` with `subtitle={tpl.notes}`, `updatedAt={tpl.updated_at}`, `onDuplicate`, `onDelete={() => setConfirmDeleteId(id)}`; `LineItemPreview` with `showHeader={false}`... **no**: keep `showHeader` default true as today but pass `subtitle={tpl.notes ?? ''}` and `notes={tpl.description}`.
- Keep the row component (drag grip + name/subtitle + total/count) in this file; row subtitle shows `tpl.notes`.
- Empty state keeps per-tab icon/copy and gains the same action buttons pattern as packages (Browse starters + New Template).
- TSDoc module header explaining it is the shared engine for the Quotes and Invoices tabs.

- [ ] **Step 1: Implement the component** (mutations mirror the store interface; UI structure copied from `invoice-templates-manager.tsx` with the parity additions).
- [ ] **Step 2: Verify** — `npm run typecheck` → 0 errors (component is not yet mounted anywhere; that lands in Task 6).

### Task 6: Rewrite the two managers as thin wrappers

**Files:**
- Modify: `app/(dashboard)/templates/quote-template-manager.tsx` (full rewrite, ~50 lines)
- Modify: `app/(dashboard)/templates/invoice-templates-manager.tsx` (full rewrite, ~50 lines)

**Interfaces:**
- Consumes: `LineItemTemplateManager` (Task 5), `STARTER_QUOTE_TEMPLATES` / `STARTER_INVOICE_TEMPLATES`, `addStarterQuoteTemplatesAction` / `addStarterInvoiceTemplatesAction`.
- Produces: same exported component names (`QuoteTemplateManager`, `InvoiceTemplatesManager`) so `templates-client.tsx` keeps working unchanged.

Each wrapper: TSDoc module header (quote one gains the header it was missing), then:

```tsx
export function QuoteTemplateManager() {
  return (
    <LineItemTemplateManager
      kind="quote"
      emptyIcon={FileText}
      starterCatalog={STARTER_QUOTE_TEMPLATES}
      onAddStarters={async (names) => {
        const res = await addStarterQuoteTemplatesAction(names)
        if (!res.ok) throw new Error(res.error)
        return res.data.added
      }}
      copy={{
        entityTitle: 'Quote Template',
        toastNoun: 'Template',
        searchPlaceholder: 'Search quote templates…',
        namePlaceholder: 'e.g., Standard reception wedding',
        starterTitle: 'Browse starter quote templates',
        starterBlurb: 'Add the templates you want. Nothing is added unless you choose it.',
        emptyTitle: 'No quote templates yet',
        emptyDescription: 'Save line items as a reusable template.',
      }}
    />
  )
}
```

Invoice wrapper mirrors it (`kind="invoice"`, `Receipt` icon, invoice copy, `'Invoice template'` toast noun).

- [ ] **Step 1: Rewrite both files.**
- [ ] **Step 2: Verify** — `npm run typecheck` → 0; `npm run lint:gate` → within budget; `npx vitest run tests/unit tests/integration/templates` → PASS.

### Task 7: Make invoice templates consumable + fix applied-notes semantics

**Files:**
- Modify: `components/builders/parts/use-apply-sources.ts`
- Modify: `components/builders/invoice-builder-modal.tsx:198`

**Interfaces:**
- Produces: `useApplySources(opts?: { includeInvoiceTemplates?: boolean })`. Options namespaced `it:<id>` for invoice templates; `applyMap` entries `{ notes, items, addOns: [], package: null }`.

Changes:
1. Signature `useApplySources({ includeInvoiceTemplates = false } = {})`; `queryKey: ['builder-apply-sources', includeInvoiceTemplates]`.
2. When the flag is set, also fetch `invoice_templates` (`id, name, description`) + `invoice_template_items` (`invoice_template_id, description, amount, position`), owner-scoped, position-ordered. Push their options **first** (an invoice template is the most specific source for an invoice), then quote templates, then packages.
3. Applied-notes semantics (why-comment): apply `description` (customer-facing), never `notes` (internal subtitle). So: quote templates apply `t.description` (select `id, name, description` and set both option `notes` and applyMap `notes` from it); packages apply `p.description` only (drop the `[p.description, p.notes]` join).
4. `invoice-builder-modal.tsx`: `useApplySources({ includeInvoiceTemplates: true })` and update the comment on line 197 to mention all three sources.
5. Update the module TSDoc in `use-apply-sources.ts` to describe the three sources and the notes/description rule.

- [ ] **Step 1: Apply the edits.**
- [ ] **Step 2: Verify** — `npm run typecheck` → 0; quote builder call site unchanged (`useApplySources()`).

### Task 8: Packages parity fix (updated_at)

**Files:**
- Modify: `app/(dashboard)/templates/packages-manager.tsx:270`

The packages update mutation never sets `updated_at` and no DB trigger exists, so the preview's "Edited X ago" shows creation time forever. Add `updated_at: new Date().toISOString()` to the `.update({...})` payload with a why-comment (`No DB trigger on packages; set explicitly so "Edited X ago" is honest.`).

- [ ] **Step 1: Apply the one-line edit.**
- [ ] **Step 2: Verify** — `npm run typecheck` → 0.

### Task 9: Gates, docs, and final verification

**Files:**
- Modify: `.claude/docs/page-specs.md` (Templates page section: Quotes/Invoices tab behavior — duplicate, confirm delete, edited-ago, Notes vs Subtitle fields, invoice templates as a builder source, search scope)
- Possibly modify: `scripts/typecheck-strict-gate.mjs` / `scripts/lint-gate.mjs` budgets (ratchet DOWN only if the counts dropped)

- [ ] **Step 1: Update `page-specs.md`** to reflect the new behavior.
- [ ] **Step 2: Run the full gate suite:**
  - `npm run typecheck` → 0 errors
  - `npm run typecheck:strict` → at or below budget; ratchet down if lower
  - `npm run lint:gate` → at or below budget; ratchet down if lower
  - `npx vitest run tests/unit` → PASS
  - `npx vitest run tests/integration/templates` → PASS (local Supabase)
- [ ] **Step 3: Fix any fallout** (fix the app, never the test).

## Self-Review

- **Spec coverage:** invoice templates consumable → Task 7; reorder persisted → Task 3 (wipe-and-reinsert) + Task 5 (manager uses store); duplicate/confirm-delete/edited-ago → Task 5 (+8 for packages' edited-ago); package seeding for quote templates → Task 5 (sources for both kinds); subtitle vs applied notes → Tasks 4 + 7; cents → Tasks 1 + 4; reorder error handling → Task 5; validation → Tasks 2 + 4; search scope → Task 5; token compliance → Task 4; manager dedup + TSDoc/stray comments → Tasks 5 + 6; docs → Task 9. No gaps.
- **Placeholder scan:** clean; Task 5 references exact existing code to copy where full duplication in the plan adds no signal (the executing agent has the files).
- **Type consistency:** `TemplateDraft` carries `description`; `TemplateEditForm` value/onSave shape matches it plus item ids; store `create` returns `Promise<string>` used by duplicate-select.

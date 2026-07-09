import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTemplateStore } from '@/app/(dashboard)/templates/template-store'

import { createTestUser, type TestUser } from '../helpers/supabase'

/**
 * The shared template store behind the Quotes and Invoices tabs.
 *
 * Proves create/update round-trips under owner RLS, that an update
 * persists the form's item order (regression: reorders used to be
 * silently lost because item positions were never rewritten), that
 * updates bump `updated_at` (these tables have no DB trigger), and
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
        expect(created?.notes).toBe('Most popular')
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
        const before = (await store.list(userA.id)).find((r) => r.id === id)
        expect(before).toBeDefined()
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
        const after = (await store.list(userA.id)).find((r) => r.id === id)
        expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
          new Date(before!.updated_at).getTime(),
        )
      })

      it('reorders templates via setPositions', async () => {
        const store = createTemplateStore(userA.client, kind)
        const rows = await store.list(userA.id)
        expect(rows.length).toBeGreaterThan(1)
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
        const target = rows.find((r) => r.name === 'Reorder me')
        expect(target).toBeDefined()
        await store.remove(userA.id, target!.id)
        expect((await store.list(userA.id)).some((r) => r.id === target!.id)).toBe(false)
        expect((await store.listItems(userA.id))[target!.id]).toBeUndefined()
      })
    })
  }
})

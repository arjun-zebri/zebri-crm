/**
 * Integration test for schedule actions against local Supabase.
 *
 * Tests CRUD on saved payment schedules, the default flag behavior, and the
 * invoice stage persistence that never touches paid rows.
 *
 * @module tests/integration/payments/schedule-actions
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  markStagePaid,
  replaceInvoiceStages,
  setDefaultSchedule,
  updateSchedule,
} from '@/app/(dashboard)/payments/schedule-actions'
import { createClient } from '@/lib/supabase/server'

import { createTestUser, serviceClient, type DbClient, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

afterEach(() => {
  activeUser = null
})

describe('schedule actions', () => {
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, pro)
  })

  it('creates a schedule with its stages', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: '25 / 50 / 25',
        stages: [
          { label: 'Deposit', amountType: 'percent', amountValue: 25, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Progress', amountType: 'percent', amountValue: 50, offsetValue: 90, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 180, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      const all = await listSchedules()
      const created = all.find((s) => s.id === id)
      expect(created?.name).toBe('25 / 50 / 25')
      expect(created?.stages).toHaveLength(3)
      expect(created?.stages[2]?.amountType).toBe('remainder')
    } finally {
      activeUser = null
    }
  })

  it('rejects a one-stage schedule', async () => {
    activeUser = user
    try {
      await expect(
        createSchedule({
          name: 'Pointless',
          stages: [{ label: 'All of it', amountType: 'percent', amountValue: 100, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' }],
        }),
      ).rejects.toThrow(/single stage/i)
    } finally {
      activeUser = null
    }
  })

  it('moves the default flag rather than adding a second one', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: '50 / 50',
        stages: [
          { label: 'Deposit', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Final', amountType: 'remainder', amountValue: null, offsetValue: 60, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await setDefaultSchedule(id)

      const admin = serviceClient()
      const { data } = await admin
        .from('payment_schedules')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
      expect(data).toHaveLength(1)
      expect(data![0]!.id).toBe(id)
    } finally {
      activeUser = null
    }
  })

  it('replaces unpaid stages and never touches paid ones', async () => {
    activeUser = user
    try {
      const admin = serviceClient()

      // Create a couple first (required for invoices)
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Test couple', status: 'new' })
        .select('id')
        .single()

      const { data: invoice } = await admin
        .from('invoices')
        .insert({
          user_id: user.id,
          couple_id: couple!.id,
          title: 'Replace test',
          invoice_number: '001',
          subtotal: 1000,
          status: 'sent',
        })
        .select('id')
        .single()

      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await admin
        .from('invoice_payment_stages')
        .update({ paid_at: '2026-08-02T00:00:00Z' })
        .eq('invoice_id', invoice!.id)
        .eq('position', 1)

      // A second replace drops the unpaid stage and keeps the paid one.
      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Renamed final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-10-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      const { data } = await admin
        .from('invoice_payment_stages')
        .select('position, label, paid_at, due_date')
        .eq('invoice_id', invoice!.id)
        .order('position')
      expect(data).toHaveLength(2)
      expect(data![0]!.paid_at).not.toBeNull()
      expect(data![1]!.label).toBe('Renamed final')
    } finally {
      activeUser = null
    }
  })

  it('updates a schedule name', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: 'Original name',
        stages: [
          { label: 'Half', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Half', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await updateSchedule({ id, name: 'Updated name' })

      const all = await listSchedules()
      const updated = all.find((s) => s.id === id)
      expect(updated?.name).toBe('Updated name')
    } finally {
      activeUser = null
    }
  })

  it('updates a schedule stages', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: 'Original stages',
        stages: [
          { label: 'Half', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Half', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await updateSchedule({
        id,
        stages: [
          { label: 'Third', amountType: 'percent', amountValue: 33, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Third', amountType: 'percent', amountValue: 33, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Last', amountType: 'remainder', amountValue: null, offsetValue: 60, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      const all = await listSchedules()
      const updated = all.find((s) => s.id === id)
      expect(updated?.stages).toHaveLength(3)
      expect(updated?.stages[0]?.label).toBe('Third')
    } finally {
      activeUser = null
    }
  })

  it('deletes a schedule', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: 'To delete',
        stages: [
          { label: 'Half', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Half', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await deleteSchedule(id)

      const all = await listSchedules()
      const deleted = all.find((s) => s.id === id)
      expect(deleted).toBeUndefined()
    } finally {
      activeUser = null
    }
  })

  it('marks a stage as paid', async () => {
    activeUser = user
    try {
      const admin = serviceClient()

      // Create a couple first (required for invoices)
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Test couple 2', status: 'new' })
        .select('id')
        .single()

      const { data: invoice } = await admin
        .from('invoices')
        .insert({
          user_id: user.id,
          couple_id: couple!.id,
          title: 'Mark paid test',
          invoice_number: '002',
          subtotal: 1000,
          status: 'sent',
        })
        .select('id')
        .single()

      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      const { data: stages } = await admin
        .from('invoice_payment_stages')
        .select('id')
        .eq('invoice_id', invoice!.id)
        .eq('position', 1)
        .single()

      await markStagePaid(stages!.id)

      const { data: marked } = await admin
        .from('invoice_payment_stages')
        .select('paid_at')
        .eq('id', stages!.id)
        .single()

      expect(marked?.paid_at).not.toBeNull()
    } finally {
      activeUser = null
    }
  })

  it('calling markStagePaid twice preserves the first timestamp and does not throw', async () => {
    activeUser = user
    try {
      const admin = serviceClient()

      // Create a couple first (required for invoices)
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Test couple mark twice', status: 'new' })
        .select('id')
        .single()

      const { data: invoice } = await admin
        .from('invoices')
        .insert({
          user_id: user.id,
          couple_id: couple!.id,
          title: 'Mark twice test',
          invoice_number: '999',
          subtotal: 1000,
          status: 'sent',
        })
        .select('id')
        .single()

      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      const { data: stages } = await admin
        .from('invoice_payment_stages')
        .select('id')
        .eq('invoice_id', invoice!.id)
        .eq('position', 1)
        .single()

      // First mark: should succeed
      await markStagePaid(stages!.id)

      const { data: afterFirst } = await admin
        .from('invoice_payment_stages')
        .select('paid_at')
        .eq('id', stages!.id)
        .single()

      const firstTimestamp = afterFirst?.paid_at
      expect(firstTimestamp).not.toBeNull()

      // Slight delay to ensure timestamps would differ if written again
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second mark: should not throw and should not update the timestamp
      await markStagePaid(stages!.id)

      const { data: afterSecond } = await admin
        .from('invoice_payment_stages')
        .select('paid_at')
        .eq('id', stages!.id)
        .single()

      // Timestamp should be unchanged: atomic replay guard preserved it
      expect(afterSecond?.paid_at).toBe(firstTimestamp)
    } finally {
      activeUser = null
    }
  })

  it('updateSchedule with both name and stages', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: 'Original',
        stages: [
          { label: 'Half', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Half', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })
      await updateSchedule({
        id,
        name: 'Updated both',
        stages: [
          { label: 'Third', amountType: 'percent', amountValue: 33, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Third', amountType: 'percent', amountValue: 33, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Last', amountType: 'remainder', amountValue: null, offsetValue: 60, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      const all = await listSchedules()
      const updated = all.find((s) => s.id === id)
      expect(updated?.name).toBe('Updated both')
      expect(updated?.stages).toHaveLength(3)
      expect(updated?.stages[0]?.label).toBe('Third')
    } finally {
      activeUser = null
    }
  })

  it('replaceInvoiceStages with empty incoming list clears unpaid stages', async () => {
    activeUser = user
    try {
      const admin = serviceClient()

      // Create a couple and invoice
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Test couple 3', status: 'new' })
        .select('id')
        .single()

      const { data: invoice } = await admin
        .from('invoices')
        .insert({
          user_id: user.id,
          couple_id: couple!.id,
          title: 'Empty replace test',
          invoice_number: '003',
          subtotal: 1000,
          status: 'sent',
        })
        .select('id')
        .single()

      // Insert initial stages
      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      // Replace with empty list clears unpaid stages
      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [],
      })

      const { data: remaining } = await admin
        .from('invoice_payment_stages')
        .select('id')
        .eq('invoice_id', invoice!.id)

      expect(remaining).toHaveLength(0)
    } finally {
      activeUser = null
    }
  })

  it('createSchedule validation error messages are readable', async () => {
    activeUser = user
    try {
      await expect(
        createSchedule({
          name: 'Bad',
          stages: [
            { label: 'Only stage', amountType: 'remainder', amountValue: null, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          ],
        }),
      ).rejects.toThrow('single stage')
    } finally {
      activeUser = null
    }
  })

  it('updateSchedule validation error messages are readable', async () => {
    activeUser = user
    try {
      const { id } = await createSchedule({
        name: 'Valid',
        stages: [
          { label: 'Half', amountType: 'percent', amountValue: 50, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { label: 'Half', amountType: 'remainder', amountValue: null, offsetValue: 30, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      await expect(
        updateSchedule({
          id,
          stages: [
            { label: 'Only stage', amountType: 'remainder', amountValue: null, offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          ],
        }),
      ).rejects.toThrow('single stage')
    } finally {
      activeUser = null
    }
  })

  it('aborts before deleting when the select of existing stages fails', async () => {
    activeUser = user
    try {
      const admin = serviceClient()

      // Arrange: Create a couple, invoice, and two stages (one paid, one unpaid)
      const { data: couple } = await admin
        .from('couples')
        .insert({ user_id: user.id, name: 'Abort read-fail test', status: 'new' })
        .select('id')
        .single()

      const { data: invoice } = await admin
        .from('invoices')
        .insert({
          user_id: user.id,
          couple_id: couple!.id,
          title: 'Abort on read fail test',
          invoice_number: '888',
          subtotal: 1000,
          status: 'sent',
        })
        .select('id')
        .single()

      // Create initial stages via successful call
      await replaceInvoiceStages({
        invoiceId: invoice!.id,
        stages: [
          { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          { position: 2, label: 'Final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-09-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
        ],
      })

      // Mark first stage as paid
      await admin
        .from('invoice_payment_stages')
        .update({ paid_at: '2026-08-02T00:00:00Z' })
        .eq('invoice_id', invoice!.id)
        .eq('position', 1)

      // Create a wrapper that makes select on invoice_payment_stages fail
      const failingQuery = {
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'simulated read failure' } }),
        }),
      }

      const realClient = activeUser!.client
      const wrappedClient = {
        ...realClient,
        from: (tableName: string) => {
          if (tableName === 'invoice_payment_stages') {
            return failingQuery as unknown as ReturnType<typeof realClient.from>
          }
          return realClient.from(tableName as unknown as never)
        },
      } as unknown as DbClient

      // Temporarily replace the mock to use the failing client
      const mockCreateClient = vi.mocked(createClient)
      mockCreateClient.mockImplementationOnce(async () => wrappedClient)

      // Act & Assert 1: Call should reject with read failure
      await expect(
        replaceInvoiceStages({
          invoiceId: invoice!.id,
          stages: [
            { position: 1, label: 'Deposit', amountType: 'percent', amountValue: 50, amountCents: 50_000, dueDate: '2026-08-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
            { position: 2, label: 'Replaced final', amountType: 'remainder', amountValue: null, amountCents: 50_000, dueDate: '2026-10-01', offsetValue: 0, offsetUnit: 'day', offsetAnchor: 'issue' },
          ],
        }),
      ).rejects.toThrow('simulated read failure')

      // Assert 2: Database state unchanged (abort happened before delete)
      // This is the critical assertion proving the function aborted before deleting.
      const { data: remaining } = await admin
        .from('invoice_payment_stages')
        .select('position, label, paid_at')
        .eq('invoice_id', invoice!.id)
        .order('position')

      expect(remaining).toHaveLength(2)
      expect(remaining![0]!.position).toBe(1)
      expect(remaining![0]!.paid_at).not.toBeNull()
      expect(remaining![1]!.position).toBe(2)
      expect(remaining![1]!.label).toBe('Final')
    } finally {
      // Restore the mock for subsequent tests
      const mockCreateClient = vi.mocked(createClient)
      mockCreateClient.mockImplementation(async () => {
        if (!activeUser) throw new Error('No active test user')
        return activeUser.client
      })
      activeUser = null
    }
  })
})

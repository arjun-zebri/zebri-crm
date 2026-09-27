/**
 * The builder's Compose email preview (Task 28).
 *
 * The draft is rendered server-side against the MC's own couple, picked
 * through their own RLS client, so it must never render for another
 * tenant's couple or read another tenant's template, and must write no
 * send record.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { previewComposeEmailAction } from '@/app/(dashboard)/workflows/preview-actions'
import { PREVIEW_UNSUBSCRIBE_URL } from '@/lib/email/send-email-render'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user, set `activeUser` first')
    return activeUser.client
  }),
}))

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const admin = serviceClient()

let owner: TestUser
let lonely: TestUser
let ownerCoupleId: string

const draft = {
  subject: 'Hello {{couple.name}}',
  content: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'See you soon' }],
      },
    ],
  },
}

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
  lonely = await createTestUser({}, PRO)
  const { data, error } = await admin
    .from('couples')
    .insert({ user_id: owner.id, name: 'Compose Owner Couple', status: 'Enquiry' } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  ownerCoupleId = (data as { id: string }).id
})

afterEach(() => {
  activeUser = null
})

describe('previewComposeEmailAction', () => {
  it("renders the draft for the MC's own couple, shell and footer included", async () => {
    activeUser = owner
    const res = await previewComposeEmailAction(draft)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.couple).toEqual({ name: 'Compose Owner Couple', sample: false })
    expect(res.data.subject).toBe('Hello Compose Owner Couple')
    expect(res.data.html).toContain('<strong>See you soon</strong>')
    expect(res.data.html).toContain(PREVIEW_UNSUBSCRIBE_URL)

    const { count } = await admin
      .from('couple_emails')
      .select('id', { count: 'exact', head: true })
      .eq('couple_id', ownerCoupleId)
    expect(count).toBe(0)
  })

  it('falls back to a labelled sample for an MC with no couples, never another tenant', async () => {
    activeUser = lonely
    const res = await previewComposeEmailAction(draft)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.couple.sample).toBe(true)
    expect(res.data.html).not.toContain('Compose Owner Couple')
  })

  it("will not read another MC's saved template", async () => {
    const { data, error } = await admin
      .from('email_templates')
      .insert({ user_id: owner.id, name: 'Private', subject: 'Secret', content: draft.content } as never)
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    activeUser = lonely
    const res = await previewComposeEmailAction({
      subject: '',
      content: null,
      templateId: (data as { id: string }).id,
    })
    expect(res).toEqual({ ok: false, error: 'The saved template could not be found.' })
  })

  it('rejects a malformed draft', async () => {
    activeUser = owner
    const res = await previewComposeEmailAction({ subject: 'x'.repeat(301), content: null })
    expect(res.ok).toBe(false)
  })

  // Live check B8: the compose preview's subject dropped a gap silently
  // ("Your day at"), where step detail marks it ("Your day at [Venue]").
  it('marks a gap in the subject the way step detail does', async () => {
    activeUser = owner
    const res = await previewComposeEmailAction({ subject: 'Your day at {{venue.name}}', content: draft.content })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.subject).toBe('Your day at [Venue name]')
    expect(res.data.unresolved).toEqual(['Venue name'])
    expect(res.data.unknown).toEqual([])
  })

  // Live check B7: a variable Zebri does not know is not "empty for" the
  // couple; it is reported on its own.
  it('reports a variable Zebri does not know apart from a missing detail', async () => {
    activeUser = owner
    const res = await previewComposeEmailAction({ subject: 'Your day at {{event.venue}}', content: draft.content })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data.unknown).toEqual(['event.venue'])
    expect(res.data.unresolved).toEqual([])
  })
})

/**
 * The "Make edits" route's write behaviour, against local Supabase
 * (founder, 2026-09-23: "Clicking make edits works but it increases the
 * proposal count when youve quit out of it").
 *
 * The route itself is React, so what is exercised here is the seam it
 * sits on: everything opening the editor needs is a read, and the pair of
 * calls the autosave makes on the first change (create, then the guarded
 * layout write) leaves exactly one proposal carrying the MC's edit and
 * the template's seeded options.
 *
 * It also pins the revision a brand new proposal starts at. The editor
 * mounts before its row exists, so its first save is based on the
 * column's default rather than anything it read back: if that default
 * ever moves, this test is what says so (see
 * `app/(dashboard)/proposals/design/new/use-materialise-proposal.ts`).
 *
 * Server actions are called directly with `@/lib/supabase/server` mocked
 * to the signed-in test user's client, the pattern every proposals
 * integration test here uses, so RLS still applies exactly as in the app.
 *
 * @module tests/integration/proposals/new-proposal-design
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProposalFromTemplateAction } from '@/app/(dashboard)/proposals/create-from-template'
import {
  cloneLayoutWithFreshIds, createTemplateAction, doc, getTemplateAction, paragraph, text,
  updateProposalLayoutAction, type PackageOption, type ProposalLayout,
} from '@/features/proposals'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const created: TestUser[] = []

const cards: PackageOption[] = [
  {
    id: 'pk-a', title: 'Reception MC', description: 'Five hours',
    pricingMode: 'single', fixedPrice: 1400, gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
    items: [{ id: 'pi-a1', description: 'Reception hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
  },
]

/** A two-section template: one content section the test edits, one packages section to seed options from. */
function templateLayout(): ProposalLayout {
  return {
    version: 2,
    sections: [
      { id: 'sec-intro', kind: 'content', style: { height: 'fit' }, content: doc(paragraph(text('Hello you two'))) },
      {
        id: 'sec-packages', kind: 'packages', style: { height: 'fit' },
        data: { kind: 'packages', packages: { layout: 'cards', showInclusions: true, ctaLabel: 'Choose this', options: cards } },
      },
    ],
  }
}

/** A signed-in MC with a couple and a template, standing where the send modal's "Make edits" leaves them. */
async function arrange(): Promise<{ user: TestUser; coupleId: string; templateId: string }> {
  const user = await createTestUser({}, pro)
  created.push(user)
  activeUser = user
  const { data: couple, error } = await user.client
    .from('couples').insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' }).select('id').single()
  if (error || !couple) throw new Error(`couple insert failed: ${error?.message}`)
  const template = await createTemplateAction({ name: 'Signature', layout: templateLayout() })
  if (!template.ok) throw new Error(template.error)
  return { user, coupleId: couple.id, templateId: template.template.id }
}

/** How many proposals the account owns right now. */
async function proposalCount(user: TestUser): Promise<number> {
  const { count, error } = await user.client.from('proposals').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if (error) throw new Error(error.message)
  return count ?? 0
}

afterEach(async () => {
  for (const user of created.splice(0)) await user.cleanup()
  activeUser = null
})

describe('the design editor for a proposal that does not exist yet', () => {
  it('writes no proposal for an MC who opens it and leaves without editing', async () => {
    const { user, coupleId, templateId } = await arrange()

    // Everything the route needs to mount: the template's layout and the
    // couple's name. Both reads, and that is the whole point.
    const template = await getTemplateAction(templateId)
    expect(template.ok).toBe(true)
    const { data: couple } = await user.client.from('couples').select('name').eq('id', coupleId).maybeSingle()
    expect(couple?.name).toBe('Anna & Jake')

    expect(await proposalCount(user)).toBe(0)
  })

  it('creates exactly one proposal on the first change, holding the edit and the template options', async () => {
    const { user, coupleId, templateId } = await arrange()
    const template = await getTemplateAction(templateId)
    if (!template.ok) throw new Error(template.error)

    // What the editor holds: the template's layout, copied with fresh
    // section ids, with one section's text changed by the MC.
    const edited = cloneLayoutWithFreshIds(template.template.layout)
    const first = edited.sections[0]
    if (!first || first.kind !== 'content') throw new Error('expected a content section first')
    first.content = doc(paragraph(text('Hello Anna and Jake')))

    // The autosave's save path, in order: create the row, then write the
    // layout into it based on the revision it starts at.
    const madeIt = await createProposalFromTemplateAction({ coupleId, templateId, expiresAt: null })
    expect(madeIt.ok).toBe(true)
    if (!madeIt.ok) return
    const saved = await updateProposalLayoutAction({ id: madeIt.proposalId, layout: edited, baseRevision: 0 })
    expect(saved).toMatchObject({ ok: true, revision: 1 })

    expect(await proposalCount(user)).toBe(1)

    const { data: proposal } = await user.client
      .from('proposals').select('layout, layout_revision, template_id, couple_id, status').eq('id', madeIt.proposalId).single()
    expect(proposal).toMatchObject({ template_id: templateId, couple_id: coupleId, status: 'draft', layout_revision: 1 })
    const stored = proposal?.layout as unknown as ProposalLayout
    expect(JSON.stringify(stored)).toContain('Hello Anna and Jake')
    // Still a snapshot: the template's own section ids never reach it.
    expect(stored.sections.map((s) => s.id)).not.toContain('sec-intro')

    // The couple's choosable options were seeded from the template's
    // packages section by the create, and survive the layout write.
    const { data: options } = await user.client
      .from('proposal_options').select('title, position').eq('proposal_id', madeIt.proposalId).order('position')
    expect(options).toEqual([{ title: 'Reception MC', position: 1 }])

    // And the template is untouched, which is what the editor's explainer
    // promises the MC.
    const after = await getTemplateAction(templateId)
    if (!after.ok) throw new Error(after.error)
    expect(JSON.stringify(after.template.layout)).toContain('Hello you two')
    expect(JSON.stringify(after.template.layout)).not.toContain('Hello Anna and Jake')
  })
})

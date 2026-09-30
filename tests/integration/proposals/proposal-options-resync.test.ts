/**
 * Editing a couple's own copy of a proposal, against local Supabase.
 *
 * Two promises are under test, and they are the founder's own two
 * questions about "Make edits" ("the make edits should be just for the
 * proposal going out to that couple, we dont want to change the entire
 * template"):
 *
 * 1. The couple's `proposal_options` rows follow the proposal's layout. A
 *    price edited in the editor has to reach the rows, because the layout
 *    is what the couple reads and the rows are what the contract and the
 *    invoice are built from. Rows the layout did not touch keep their ids,
 *    since the public page renders options by id.
 * 2. Nothing here ever writes to `proposal_templates`.
 *
 * Server actions are called directly with `@/lib/supabase/server` mocked to
 * the signed-in test user's client, the pattern `create-from-template.test.ts`
 * uses, so RLS applies exactly as it does in the app.
 *
 * @module tests/integration/proposals/proposal-options-resync
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProposalFromTemplateAction } from '@/app/(dashboard)/proposals/create-from-template'
import {
  createTemplateAction, doc, getProposalDesignAction, getTemplateAction, paragraph, text, updateProposalLayoutAction,
  type PackageOption, type ProposalLayout,
} from '@/features/proposals'
import { resyncProposalOptions } from '@/features/proposals/data/resync-options'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const createdUsers: TestUser[] = []

/** The two package cards the template authors, and the proposal is seeded from. */
const cards: PackageOption[] = [
  {
    id: 'pk-a', title: 'Reception MC', description: 'Five hours',
    pricingMode: 'single', fixedPrice: 1400, gstInclusive: true, weekendLoadingPercent: null, isPopular: false,
    items: [{ id: 'pi-a1', description: 'Reception hosting', amount: 0, quantity: 1, isAddon: false, defaultIncluded: true }],
  },
  {
    id: 'pk-b', title: 'Full day', description: 'Ceremony and reception',
    pricingMode: 'itemised', fixedPrice: null, gstInclusive: true, weekendLoadingPercent: 15, isPopular: true,
    items: [
      { id: 'pi-b1', description: 'Ceremony and reception', amount: 2200, quantity: 1, isAddon: false, defaultIncluded: true },
      { id: 'pi-b2', description: 'Rehearsal', amount: 300, quantity: 1, isAddon: true, defaultIncluded: false },
    ],
  },
]

/** A content section plus a packages section carrying {@link cards}. */
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

/** One option row as the couple's page and the close path read it. */
interface OptionRow {
  id: string
  position: number
  title: string
  fixed_price: number | null
  subtotal: number
  proposal_option_items: { description: string; amount: number; is_addon: boolean; position: number }[]
}

/** Every option on `proposalId`, in the couple's reading order. */
async function readOptions(user: TestUser, proposalId: string): Promise<OptionRow[]> {
  const { data, error } = await user.client
    .from('proposal_options')
    .select('id, position, title, fixed_price, subtotal, proposal_option_items(description, amount, is_addon, position)')
    .eq('proposal_id', proposalId)
    .order('position')
  if (error) throw new Error(`option read failed: ${error.message}`)
  return (data ?? []) as OptionRow[]
}

/** A signed-in MC with a couple, a template and a proposal already created from it. */
async function arrange(): Promise<{ user: TestUser; templateId: string; proposalId: string }> {
  const user = await createTestUser({}, pro)
  createdUsers.push(user)
  activeUser = user
  const { data: couple, error } = await user.client
    .from('couples').insert({ user_id: user.id, name: 'Anna & Jake', status: 'new' }).select('id').single()
  if (error || !couple) throw new Error(`couple insert failed: ${error?.message}`)
  const template = await createTemplateAction({ name: 'Signature', layout: templateLayout() })
  if (!template.ok) throw new Error(template.error)
  const proposal = await createProposalFromTemplateAction({ coupleId: couple.id, templateId: template.template.id, expiresAt: null })
  if (!proposal.ok) throw new Error(proposal.error)
  return { user, templateId: template.template.id, proposalId: proposal.proposalId }
}

/** The proposal's own layout as stored, with `mutate` applied to its packages section's cards. */
async function editedLayout(proposalId: string, mutate: (options: PackageOption[]) => void): Promise<{ layout: ProposalLayout; revision: number }> {
  const loaded = await getProposalDesignAction(proposalId)
  if (!loaded.ok) throw new Error(loaded.error)
  const layout = structuredClone(loaded.proposal.layout)
  const section = layout.sections.find((s) => s.kind === 'packages')
  if (section?.data?.kind !== 'packages') throw new Error('proposal layout lost its packages section')
  mutate(section.data.packages.options ?? [])
  return { layout, revision: loaded.proposal.layoutRevision }
}

afterEach(async () => {
  for (const user of createdUsers.splice(0)) await user.cleanup()
  activeUser = null
})

describe('a proposal layout save and the couple\'s option rows', () => {
  it('rewrites the rows when the MC edits a package, and leaves the template alone', async () => {
    const { user, templateId, proposalId } = await arrange()
    const before = await readOptions(user, proposalId)
    expect(before.map((o) => o.title)).toEqual(['Reception MC', 'Full day'])

    const { layout, revision } = await editedLayout(proposalId, (options) => {
      const first = options[0]
      if (!first) throw new Error('no package to edit')
      first.title = 'Reception MC, extended'
      first.fixedPrice = 1650
    })
    const saved = await updateProposalLayoutAction({ id: proposalId, layout, baseRevision: revision })
    expect(saved).toEqual({ ok: true, revision: revision + 1 })

    const after = await readOptions(user, proposalId)
    expect(after.map((o) => o.title)).toEqual(['Reception MC, extended', 'Full day'])
    // The money, not just the label: `subtotal` is what the contract and
    // the invoice are built from, and it has to follow the new price.
    expect(Number(after[0]?.fixed_price)).toBe(1650)
    expect(Number(after[0]?.subtotal)).toBe(1650)

    // The founder's actual question: the template is untouched by any of it.
    const template = await getTemplateAction(templateId)
    expect(template.ok).toBe(true)
    if (template.ok) expect(template.template.layout).toEqual(templateLayout())
  })

  it('carries an edited inclusion and a new add-on through to the item rows', async () => {
    const { user, proposalId } = await arrange()
    const { layout, revision } = await editedLayout(proposalId, (options) => {
      const full = options[1]
      if (!full) throw new Error('no itemised package to edit')
      full.items = [
        { id: 'pi-b1', description: 'Ceremony and reception', amount: 2400, quantity: 1, isAddon: false, defaultIncluded: true },
        { id: 'pi-new', description: 'Late finish', amount: 400, quantity: 1, isAddon: true, defaultIncluded: false },
      ]
    })
    expect((await updateProposalLayoutAction({ id: proposalId, layout, baseRevision: revision })).ok).toBe(true)

    const [, full] = await readOptions(user, proposalId)
    const items = (full?.proposal_option_items ?? []).slice().sort((a, b) => a.position - b.position)
    expect(items.map((i) => i.description)).toEqual(['Ceremony and reception', 'Late finish'])
    expect(Number(items[1]?.amount)).toBe(400)
    expect(items[1]?.is_addon).toBe(true)
    // `subtotal` counts the base only, never the add-on.
    expect(Number(full?.subtotal)).toBe(2400)
  })

  it('leaves the rows, and their ids, alone when the save did not touch the packages', async () => {
    const { user, proposalId } = await arrange()
    const before = await readOptions(user, proposalId)

    const loaded = await getProposalDesignAction(proposalId)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const layout = structuredClone(loaded.proposal.layout)
    const intro = layout.sections.find((s) => s.kind === 'content')
    if (!intro) throw new Error('proposal layout lost its content section')
    intro.content = doc(paragraph(text('Hello you two, and congratulations')))
    expect((await updateProposalLayoutAction({ id: proposalId, layout, baseRevision: loaded.proposal.layoutRevision })).ok).toBe(true)

    // Ids, not just contents: the public page renders each option by id, so
    // a needless delete-and-reinsert would move the ground under a couple
    // with the page open.
    expect(await readOptions(user, proposalId)).toEqual(before)
  })

  it('never rewrites an accepted proposal\'s rows: the contract and invoice were built from them', async () => {
    const { user, proposalId } = await arrange()
    const before = await readOptions(user, proposalId)
    const { layout, revision } = await editedLayout(proposalId, (options) => {
      const first = options[0]
      if (!first) throw new Error('no package to edit')
      first.fixedPrice = 99
    })
    const accepted = await user.client.from('proposals').update({ status: 'accepted' }).eq('id', proposalId)
    expect(accepted.error).toBeNull()

    const saved = await updateProposalLayoutAction({ id: proposalId, layout, baseRevision: revision })
    expect(saved).toEqual({ ok: false, error: 'This proposal has been accepted and can no longer be edited' })
    expect(await readOptions(user, proposalId)).toEqual(before)

    // And the re-seed refuses on its own account too, not only because the
    // layout write in front of it did.
    await resyncProposalOptions(user.client, { proposalId, userId: user.id, layout })
    expect(await readOptions(user, proposalId)).toEqual(before)
  })

  it('refuses another tenant\'s proposal and touches neither their layout nor their rows', async () => {
    const owner = await arrange()
    const ownerRows = await readOptions(owner.user, owner.proposalId)
    const { layout, revision } = await editedLayout(owner.proposalId, (options) => {
      const first = options[0]
      if (!first) throw new Error('no package to edit')
      first.fixedPrice = 1
    })

    const intruder = await createTestUser({}, pro)
    createdUsers.push(intruder)
    activeUser = intruder
    const attack = await updateProposalLayoutAction({ id: owner.proposalId, layout, baseRevision: revision })
    expect(attack.ok).toBe(false)

    activeUser = owner.user
    expect(await readOptions(owner.user, owner.proposalId)).toEqual(ownerRows)
    const reread = await getProposalDesignAction(owner.proposalId)
    expect(reread.ok && reread.proposal.layoutRevision).toBe(revision)
  })

  it('names the template the editor is not changing', async () => {
    const { proposalId } = await arrange()
    const loaded = await getProposalDesignAction(proposalId)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.proposal.coupleName).toBe('Anna & Jake')
      expect(loaded.proposal.templateName).toBe('Signature')
    }
  })
})

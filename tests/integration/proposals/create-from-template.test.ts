/**
 * Creating a proposal from a template, against local Supabase (roadmap R3
 * §6.1): the layout is copied as a snapshot with fresh section ids, the
 * options are seeded from the template's packages section, the template's
 * own settings beat the account's, another tenant's template is refused,
 * and the per-proposal layout write is guarded by `layout_revision`.
 *
 * Both server actions are called directly: `@/lib/supabase/server` is
 * mocked to hand back the signed-in test user's client, the same pattern
 * `templates-actions.test.ts` and `save-proposal-action.test.ts` use, so
 * no request context is needed and RLS still applies exactly as in the app.
 *
 * @module tests/integration/proposals/create-from-template
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProposalFromTemplateAction } from '@/app/(dashboard)/proposals/create-from-template'
import {
  createTemplateAction, doc, getProposalDesignAction, paragraph, text, updateProposalLayoutAction,
  type PackageOption, type ProposalLayout, type ProposalSettingsSnapshot,
} from '@/features/proposals'
import type { Json } from '@/types/database'

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
  {
    id: 'pk-b', title: 'Full day', description: '',
    pricingMode: 'itemised', fixedPrice: null, gstInclusive: true, weekendLoadingPercent: 15, isPopular: true,
    items: [
      { id: 'pi-b1', description: 'Ceremony and reception', amount: 2200, quantity: 1, isAddon: false, defaultIncluded: true },
      { id: 'pi-b2', description: 'Rehearsal', amount: 300, quantity: 1, isAddon: true, defaultIncluded: false },
    ],
  },
]

/** A two-section layout: one content section and one packages section carrying {@link cards}. */
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

/** A signed-in user with a couple and a template, ready to create a proposal from. */
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

afterEach(async () => {
  for (const user of created.splice(0)) await user.cleanup()
  activeUser = null
})

describe('createProposalFromTemplateAction', () => {
  it('snapshots the layout with fresh section ids, records the template and seeds the options', async () => {
    const { user, coupleId, templateId } = await arrange()
    const result = await createProposalFromTemplateAction({ coupleId, templateId, expiresAt: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { data: proposal } = await user.client
      .from('proposals').select('template_id, couple_id, status, title, layout, layout_revision, expires_at, deposit_percent')
      .eq('id', result.proposalId).single()
    expect(proposal?.template_id).toBe(templateId)
    expect(proposal?.couple_id).toBe(coupleId)
    expect(proposal?.status).toBe('draft')
    expect(proposal?.title).toBe('Anna & Jake, your wedding')
    expect(proposal?.layout_revision).toBe(0)

    const stored = proposal?.layout as unknown as ProposalLayout
    expect(stored.sections).toHaveLength(2)
    // The snapshot must not share ids with the template: editing the
    // template later must never reach a proposal already sent.
    expect(stored.sections.map((s) => s.id)).not.toContain('sec-intro')
    expect(stored.sections.map((s) => s.id)).not.toContain('sec-packages')
    expect(stored.sections.map((s) => s.kind)).toEqual(['content', 'packages'])

    const { data: options } = await user.client
      .from('proposal_options')
      .select('id, position, title, description, pricing_mode, fixed_price, is_popular, weekend_loading_percent, subtotal, proposal_option_items(description, amount, quantity, is_addon, default_included, position)')
      .eq('proposal_id', result.proposalId)
      .order('position')
    expect(options).toHaveLength(2)
    expect(options?.[0]).toMatchObject({ position: 1, title: 'Reception MC', description: 'Five hours', pricing_mode: 'single', is_popular: false })
    expect(options?.[0]?.proposal_option_items).toHaveLength(1)
    expect(options?.[1]).toMatchObject({ position: 2, title: 'Full day', description: null, pricing_mode: 'itemised', is_popular: true })
    expect(options?.[1]?.proposal_option_items).toHaveLength(2)
    expect(options?.[1]?.proposal_option_items.find((i) => i.is_addon)).toMatchObject({ description: 'Rehearsal', default_included: false })
  })

  it('lets the template settings beat the account settings for expiry days and deposit', async () => {
    const { user, coupleId, templateId } = await arrange()
    const account: ProposalSettingsSnapshot = {
      password_enabled: false, allow_download: true, expiry_days: 30, deposit_percent: 10, link_preview: null,
    }
    const override: ProposalSettingsSnapshot = { ...account, expiry_days: 7, deposit_percent: 45 }
    const settings = await user.client.from('proposal_settings').upsert({ user_id: user.id, ...account }, { onConflict: 'user_id' })
    expect(settings.error).toBeNull()
    const stamped = await user.client.from('proposal_templates').update({ settings: override as unknown as Json }).eq('id', templateId)
    expect(stamped.error).toBeNull()

    const result = await createProposalFromTemplateAction({ coupleId, templateId, expiresAt: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { data: proposal } = await user.client.from('proposals').select('expires_at, deposit_percent').eq('id', result.proposalId).single()
    expect(Number(proposal?.deposit_percent)).toBe(45)
    const expected = new Date()
    expected.setUTCDate(expected.getUTCDate() + 7)
    expect(proposal?.expires_at).toBe(expected.toISOString().slice(0, 10))
  })

  it('refuses another tenant\'s template and creates nothing', async () => {
    const other = await arrange()
    const mine = await arrange()
    // `arrange` leaves the most recent user active, so this runs as `mine`.
    const result = await createProposalFromTemplateAction({ coupleId: mine.coupleId, templateId: other.templateId, expiresAt: null })
    expect(result).toEqual({ ok: false, error: 'Template not found.' })
    const { count } = await mine.user.client.from('proposals').select('id', { count: 'exact', head: true })
    expect(count).toBe(0)
  })
})

describe('updateProposalLayoutAction', () => {
  it('bumps layout_revision on a matched write and refuses a stale one without overwriting', async () => {
    const { coupleId, templateId } = await arrange()
    const proposal = await createProposalFromTemplateAction({ coupleId, templateId, expiresAt: null })
    expect(proposal.ok).toBe(true)
    if (!proposal.ok) return
    const id = proposal.proposalId

    const edited: ProposalLayout = { version: 2, sections: [], page: { allowDownload: false } }
    const first = await updateProposalLayoutAction({ id, layout: edited, baseRevision: 0 })
    expect(first).toEqual({ ok: true, revision: 1 })

    const clobber: ProposalLayout = { version: 2, sections: [], page: { allowDownload: true } }
    const stale = await updateProposalLayoutAction({ id, layout: clobber, baseRevision: 0 })
    expect(stale.ok).toBe(false)
    if (stale.ok) return
    expect(stale.conflict?.revision).toBe(1)
    expect(stale.conflict?.layout).toEqual(edited)

    const reread = await getProposalDesignAction(id)
    expect(reread.ok && reread.proposal.layoutRevision).toBe(1)
    expect(reread.ok && reread.proposal.layout).toEqual(edited)
    expect(reread.ok && reread.proposal.coupleName).toBe('Anna & Jake')
  })
})

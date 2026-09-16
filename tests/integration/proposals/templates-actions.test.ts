/**
 * Template server actions against local Supabase: CRUD under RLS, the
 * one-default invariant, and the lazy v1 → v2 migration with backup.
 *
 * @module tests/integration/proposals/templates-actions
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, listTemplatesAction,
  setDefaultTemplateAction, updateTemplateLayoutAction,
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

afterEach(async () => { await activeUser?.cleanup(); activeUser = null })

describe('template actions', () => {
  it('ensureDefaultTemplate creates a default from the role starter when the user has nothing', async () => {
    activeUser = await createTestUser({}, pro)
    const first = await ensureDefaultTemplateAction('celebrant')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.migratedFromV1).toBe(false)
    expect(first.template.isDefault).toBe(true)
    expect(first.template.layout.sections.some((s) => s.kind === 'accept')).toBe(true)
    const again = await ensureDefaultTemplateAction('mc')
    expect(again.ok && again.template.id).toBe(first.template.id)
  })

  it('ensureDefaultTemplate falls back to the persisted proposal_role, not "mc", when the caller supplies none', async () => {
    activeUser = await createTestUser({}, pro)
    const { error } = await activeUser.client.from('user_branding').upsert({ user_id: activeUser.id, proposal_role: 'celebrant' })
    expect(error).toBeNull()
    // No role argument at all - templates-list.tsx's real call shape - so
    // the only source of the role is the persisted user_branding row.
    const result = await ensureDefaultTemplateAction()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // SUBHEADING.celebrant from proposal-starters.ts; 'mc' would instead
    // read "A proposal to host your reception".
    expect(JSON.stringify(result.template.layout)).toContain('A proposal to marry you')
  })

  it('ensureDefaultTemplate backs up the v1 tree even when the migrated layout fails validation', async () => {
    activeUser = await createTestUser({}, pro)
    // A malformed `buttonColor` (not `#RRGGBB`) migrates without throwing
    // (migrateProposalTreeToLayout copies it straight onto the button node)
    // but fails `parseProposalLayout`'s hexColor check, so the action falls
    // back to the role starter - the exact failure-path Minor 12 covers: the
    // backup must still happen even though the migrated layout is discarded.
    const v1 = [{ id: 'a1', type: 'action', primary: 'Book now', secondary: null, buttonColor: 'not-a-hex-colour' }]
    const { error } = await activeUser.client.from('user_branding').upsert({ user_id: activeUser.id, branding_blocks: { proposal: v1 } as unknown as Json })
    expect(error).toBeNull()
    const result = await ensureDefaultTemplateAction()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The layout actually stored is the starter, not the (invalid) migration.
    expect(result.migratedFromV1).toBe(false)
    const { data } = await activeUser.client.from('user_branding').select('blocks_proposal_v1_backup, blocks_proposal_v1_backup_at').eq('user_id', activeUser.id).single()
    expect(data?.blocks_proposal_v1_backup).toEqual(v1)
    expect(data?.blocks_proposal_v1_backup_at).not.toBeNull()
  })

  it('ensureDefaultTemplate migrates a v1 branding tree and backs it up', async () => {
    activeUser = await createTestUser({}, pro)
    const v1 = defaultBlocksFor('proposal')
    // `Block[]` is not structurally `Json` (readonly TS index-signature
    // mismatch); the codebase's established cast for this exact case (see
    // tests/integration/lead-capture/form-submissions.test.ts) is used here.
    const { error } = await activeUser.client.from('user_branding').upsert({ user_id: activeUser.id, branding_blocks: { proposal: v1 } as unknown as Json })
    expect(error).toBeNull()
    const result = await ensureDefaultTemplateAction()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.migratedFromV1).toBe(true)
    expect(result.template.layout.version).toBe(2)
    const { data } = await activeUser.client.from('user_branding').select('blocks_proposal_v1_backup, blocks_proposal_v1_backup_at').eq('user_id', activeUser.id).single()
    expect(Array.isArray(data?.blocks_proposal_v1_backup)).toBe(true)
    expect(data?.blocks_proposal_v1_backup_at).not.toBeNull()
  })

  it('create, update, set default and delete respect the one-default and last-template rules', async () => {
    activeUser = await createTestUser({}, pro)
    await ensureDefaultTemplateAction('mc')
    const created = await createTemplateAction({ name: 'Celebrant', role: 'celebrant' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const list = await listTemplatesAction()
    expect(list.ok && list.templates).toHaveLength(2)

    const updated = await updateTemplateLayoutAction({ id: created.template.id, layout: { version: 2, sections: [] } })
    expect(updated.ok).toBe(true)
    const bad = await updateTemplateLayoutAction({ id: created.template.id, layout: { version: 1, sections: [] } as never })
    expect(bad.ok).toBe(false)

    const setDefault = await setDefaultTemplateAction({ id: created.template.id })
    expect(setDefault.ok).toBe(true)
    const afterDefault = await listTemplatesAction()
    expect(afterDefault.ok && afterDefault.templates.filter((t) => t.isDefault).map((t) => t.id)).toEqual([created.template.id])

    const refused = await deleteTemplateAction({ id: created.template.id })
    expect(refused.ok).toBe(false)   // it is the default now
    const other = afterDefault.ok ? afterDefault.templates.find((t) => !t.isDefault)! : null
    const deleted = await deleteTemplateAction({ id: other!.id })
    expect(deleted.ok).toBe(true)

    // Only `created.template` remains, and it is still the default: the
    // is_default check is reached before the last-template count check, so
    // this still refuses as "make another the default first", not "last
    // template", the count check needs a non-default lone row (below).
    const stillDefault = await deleteTemplateAction({ id: created.template.id })
    expect(stillDefault.ok).toBe(false)
    expect(!stillDefault.ok && stillDefault.error).toBe('Make another template the default before deleting this one')

    // Exercise the last-template branch directly: clear is_default on the
    // one remaining row (bypassing the actions, mirroring the state a
    // crashed setDefault call could leave) so delete reaches the count
    // check instead of the is_default check.
    await activeUser.client.from('proposal_templates').update({ is_default: false }).eq('id', created.template.id)
    const last = await deleteTemplateAction({ id: created.template.id })
    expect(last.ok).toBe(false)
    expect(!last.ok && last.error).toBe('You need at least one template')
  })

  it('setDefaultTemplateAction refuses an unknown id and leaves the current default intact', async () => {
    activeUser = await createTestUser({}, pro)
    const first = await ensureDefaultTemplateAction('mc')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const result = await setDefaultTemplateAction({ id: '00000000-0000-0000-0000-000000000000' })
    expect(result.ok).toBe(false)
    const list = await listTemplatesAction()
    expect(list.ok && list.templates.filter((t) => t.isDefault)).toHaveLength(1)
    expect(list.ok && list.templates.find((t) => t.isDefault)?.id).toBe(first.template.id)
  })

  it('ensureDefaultTemplate promotes the latest template instead of re-migrating when no default is set', async () => {
    activeUser = await createTestUser({}, pro)
    const first = await ensureDefaultTemplateAction('mc')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // Simulate the crash window setDefaultTemplateAction's why-comment
    // describes: the old default cleared, the new one never set.
    await activeUser.client.from('proposal_templates').update({ is_default: false }).eq('is_default', true)
    const result = await ensureDefaultTemplateAction()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.migratedFromV1).toBe(false)
    expect(result.template.id).toBe(first.template.id)
    const list = await listTemplatesAction()
    expect(list.ok && list.templates.filter((t) => t.isDefault)).toHaveLength(1)
  })
})

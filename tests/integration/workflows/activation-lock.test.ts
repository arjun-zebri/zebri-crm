/**
 * Only the pre-flighted Turn on can switch a workflow on (Task 34 fix
 * round 1).
 *
 * The pre-flight lives in `setTemplateStatusAction`, so every other way
 * to set `status = 'active'` had to close: a signed-in client updating
 * the row under its own RLS, inserting a row already on, or calling
 * `set_workflow_template_status` itself. The database now refuses all
 * three (a BEFORE trigger, and EXECUTE revoked from `authenticated`),
 * while everything that legitimately writes a template keeps working:
 * create and duplicate (drafts), Turn off and archive, a rename of a
 * workflow that is already on, and the service role (the converter).
 *
 * The RPC also re-reads the steps under a row lock and refuses a Turn on
 * whose steps changed after the pre-flight read them.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createWorkflowTemplateAction,
  duplicateTemplateAction,
  setTemplateStatusAction,
} from '@/app/(dashboard)/workflows/actions'

import { runSql } from '../helpers/sql'
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
const FINISHED = { actionType: 'update_couple_stage', toStatus: 'Booked' }

const admin = serviceClient()
let owner: TestUser

beforeAll(async () => {
  owner = await createTestUser({}, PRO)
})

afterEach(() => {
  activeUser = null
})

/** A template of the owner's with one finished step, in `status`. */
async function template(name: string, status = 'draft'): Promise<string> {
  const { data, error } = await admin
    .from('workflow_templates')
    .insert({ user_id: owner.id, name, status } as never)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  const { error: stepErr } = await admin.from('workflow_template_steps').insert({
    template_id: id,
    position: 100,
    type: 'action',
    title: '',
    config: FINISHED,
  } as never)
  if (stepErr) throw new Error(stepErr.message)
  return id
}

async function status(id: string): Promise<string> {
  const { data } = await admin.from('workflow_templates').select('status').eq('id', id).single()
  return (data as { status: string }).status
}

describe('a signed-in client cannot switch a workflow on itself', () => {
  it('by updating the row', async () => {
    const id = await template('Direct update')
    const { error } = await owner.client
      .from('workflow_templates')
      .update({ status: 'active' } as never)
      .eq('id', id)
    expect(error).not.toBeNull()
    expect(await status(id)).toBe('draft')
  })

  it('by inserting a row that is already on', async () => {
    const { error } = await owner.client
      .from('workflow_templates')
      .insert({ user_id: owner.id, name: 'Born active', status: 'active' } as never)
    expect(error).not.toBeNull()
  })

  it('by calling the status function', async () => {
    const id = await template('Direct rpc')
    const { error } = await owner.client.rpc('set_workflow_template_status' as never, {
      p_template_id: id,
      p_status: 'active',
    } as never)
    expect(error).not.toBeNull()
    expect(await status(id)).toBe('draft')
  })
})

describe('everything that legitimately writes a template still works', () => {
  it('Turn on through the action, for a finished workflow', async () => {
    const id = await template('Action on')
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: id, status: 'active' })).ok).toBe(true)
    expect(await status(id)).toBe('active')
  })

  it('Turn off and archive through the action', async () => {
    const off = await template('Action off', 'active')
    const archived = await template('Action archive', 'active')
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: off, status: 'draft' })).ok).toBe(true)
    activeUser = owner
    expect((await setTemplateStatusAction({ templateId: archived, status: 'archived' })).ok).toBe(true)
    expect(await status(off)).toBe('draft')
    expect(await status(archived)).toBe('archived')
  })

  it('create and duplicate, which make drafts', async () => {
    activeUser = owner
    const created = await createWorkflowTemplateAction({ name: 'Created draft', applyRuleType: 'manual', applyRuleConfig: {} })
    expect(created.ok).toBe(true)
    const source = await template('Duplicated source', 'active')
    activeUser = owner
    const copy = await duplicateTemplateAction({ templateId: source })
    expect(copy.ok).toBe(true)
    if (copy.ok) expect(await status(copy.data.id)).toBe('draft')
  })

  it('renaming a workflow that is already on, and moving it off, as the owner', async () => {
    const id = await template('Already on', 'active')
    const renamed = await owner.client
      .from('workflow_templates')
      .update({ name: 'Already on, renamed' } as never)
      .eq('id', id)
    expect(renamed.error).toBeNull()
    const off = await owner.client
      .from('workflow_templates')
      .update({ status: 'archived' } as never)
      .eq('id', id)
    expect(off.error).toBeNull()
    expect(await status(id)).toBe('archived')
  })

  it('the service role (the legacy converter) can still insert a running workflow', async () => {
    const { error } = await admin
      .from('workflow_templates')
      .insert({ user_id: owner.id, name: 'Converted, running', status: 'active' } as never)
    expect(error).toBeNull()
  })
})

describe('the flip re-checks the steps under a lock', () => {
  it('refuses a Turn on whose steps changed after they were checked', async () => {
    const id = await template('Changed underneath')
    const { error } = await admin.rpc('set_workflow_template_status' as never, {
      p_template_id: id,
      p_status: 'active',
      // The pre-flight saw the template before its step was written
      // (revision 0); inserting the step moved it on. Since 20261024200000
      // the fingerprint is the steps revision, not a count and timestamp.
      p_expected_steps_revision: 0,
    } as never)
    expect(error?.code).toBe('WF002')
    expect(await status(id)).toBe('draft')
  })

  it('flips on the exact revision, and refuses it once any step write moved it', async () => {
    const id = await template('Revision exact')
    const revision = async () =>
      ((await admin.from('workflow_templates').select('steps_revision').eq('id', id).single()).data as {
        steps_revision: number
      }).steps_revision
    const before = await revision()
    expect(before).toBeGreaterThanOrEqual(1)

    // Every kind of step write bumps it: an update (the MC editing a
    // config), an insert and a delete.
    const { data: step } = await admin.from('workflow_template_steps').select('id').eq('template_id', id).limit(1).single()
    await admin.from('workflow_template_steps').update({ title: 'Edited' }).eq('id', (step as { id: string }).id)
    expect(await revision()).toBe(before + 1)

    const stale = await admin.rpc('set_workflow_template_status' as never, {
      p_template_id: id,
      p_status: 'active',
      p_expected_steps_revision: before,
    } as never)
    expect(stale.error?.code).toBe('WF002')

    const exact = await admin.rpc('set_workflow_template_status' as never, {
      p_template_id: id,
      p_status: 'active',
      p_expected_steps_revision: before + 1,
    } as never)
    expect(exact.error).toBeNull()
    expect(await status(id)).toBe('active')
  })

  it('a template with steps can still be deleted (the bump finds no row mid-cascade)', async () => {
    const id = await template('Delete with steps')
    const { error } = await admin.from('workflow_templates').delete().eq('id', id)
    expect(error).toBeNull()
  })

  it('refuses an activation by any role not on the allow-list', () => {
    // A throwaway role inside a rolled-back transaction: nothing persists.
    // The deny-list this replaced refused only `authenticated` and `anon`,
    // so this role would have reached the row (Task 34 re-review Minor 3).
    const out = runSql(`
      begin;
      create role zebri_activation_probe;
      grant zebri_activation_probe to postgres;
      grant usage on schema public to zebri_activation_probe;
      grant insert on public.workflow_templates to zebri_activation_probe;
      set local role zebri_activation_probe;
      do $$
      begin
        insert into public.workflow_templates (user_id, name, status)
        values (gen_random_uuid(), 'probe', 'active');
        perform set_config('zebri.probe', 'allowed', true);
      exception when others then
        perform set_config('zebri.probe', sqlerrm, true);
      end $$;
      select current_setting('zebri.probe');
      rollback;
    `)
    expect(out).toContain('Turn this workflow on from the builder')
  })

  it('refuses a Turn on that did not say what it checked', async () => {
    const id = await template('Unchecked')
    const { error } = await admin.rpc('set_workflow_template_status' as never, {
      p_template_id: id,
      p_status: 'active',
    } as never)
    expect(error).not.toBeNull()
    expect(await status(id)).toBe('draft')
  })
})

/**
 * Only the step-revision trigger writes `workflow_templates.steps_revision`
 * (Phase 6 residual pass; re-review F1).
 *
 * The Turn on refuses a flip (WF002) when the revision moved after the
 * pre-flight read it. A signed-in client that could write the column
 * itself could reset it under a step edit still in flight and pass that
 * check with steps nobody checked. The client's step writes must still
 * bump it, through the trigger.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

describe('steps_revision is written only by its trigger', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function revision(id: string): Promise<number> {
    const { data } = await admin.from('workflow_templates').select('steps_revision').eq('id', id).single()
    return Number(data!.steps_revision)
  }

  async function draftWithStep(name: string): Promise<string> {
    const { data, error } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name, status: 'draft', apply_rule_type: 'manual' })
      .select('id')
      .single()
    expect(error).toBeNull()
    const step = await user.client
      .from('workflow_template_steps')
      .insert({ template_id: data!.id, position: 0, type: 'todo', title: 'Call them' })
    expect(step.error).toBeNull()
    return data!.id
  }

  it('refuses a signed-in client resetting the revision, and keeps the value', async () => {
    const id = await draftWithStep('Revision Reset')
    const before = await revision(id)
    expect(before).toBeGreaterThanOrEqual(1)

    const { error } = await user.client.from('workflow_templates').update({ steps_revision: 0 }).eq('id', id)

    expect(error).not.toBeNull()
    expect(await revision(id)).toBe(before)
  })

  it('refuses a signed-in client inserting a template with a revision of its own', async () => {
    const { error } = await user.client
      .from('workflow_templates')
      .insert({ user_id: user.id, name: 'Revision Insert', status: 'draft', apply_rule_type: 'manual', steps_revision: 7 })
    expect(error).not.toBeNull()
  })

  it('refuses the service role too: nothing but the trigger sets it', async () => {
    const id = await draftWithStep('Revision Service')
    const before = await revision(id)
    const { error } = await admin.from('workflow_templates').update({ steps_revision: before + 5 }).eq('id', id)
    expect(error).not.toBeNull()
    expect(await revision(id)).toBe(before)
  })

  it("still lets the client's step edits bump it, and other template edits through", async () => {
    const id = await draftWithStep('Revision Bump')
    const before = await revision(id)

    const edit = await user.client
      .from('workflow_template_steps')
      .update({ title: 'Call them back' })
      .eq('template_id', id)
    expect(edit.error).toBeNull()
    expect(await revision(id)).toBe(before + 1)

    const rename = await user.client.from('workflow_templates').update({ name: 'Renamed' }).eq('id', id)
    expect(rename.error).toBeNull()
    expect(await revision(id)).toBe(before + 1)
  })
})

/**
 * Deleting a user, or a template, that owns workflow steps (Phase 6
 * live check, B2).
 *
 * `auth.admin.deleteUser` (the admin "Delete user" action) cascades from
 * `auth.users` through every owned table. The step-revision bump
 * (20261024200000) is an AFTER trigger on `workflow_template_steps`, and
 * the cascade fires it as `supabase_auth_admin`, which cannot update
 * `workflow_templates`: every owner of a template with steps became
 * undeletable ("Database error deleting user"). The bump now runs as its
 * owner and skips a template that is gone (20261024400000).
 */
import { describe, expect, it } from 'vitest'

import type { Json } from '@/types/database'

import { createTestUser, serviceClient } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

describe('deleting an owner of workflow steps', () => {
  const admin = serviceClient()

  it('deletes a user who owns a template with steps, an instance with steps and couple emails, and leaves no rows', async () => {
    const user = await createTestUser({}, PRO)
    try {
      const { data: template, error: tErr } = await user.client
        .from('workflow_templates')
        .insert({ user_id: user.id, name: 'Delete Me', status: 'draft', apply_rule_type: 'manual' })
        .select('id')
        .single()
      expect(tErr).toBeNull()
      const steps = await user.client.from('workflow_template_steps').insert([
        { template_id: template!.id, position: 0, type: 'todo', title: 'Call them' },
        { template_id: template!.id, position: 1, type: 'todo', title: 'Send the form' },
      ])
      expect(steps.error).toBeNull()

      const { data: couple } = await user.client
        .from('couples')
        .insert({ user_id: user.id, name: 'Delete Couple', status: 'Enquiry' })
        .select('id')
        .single()
      const { data: instance, error: iErr } = await admin
        .from('workflow_instances')
        .insert({ user_id: user.id, couple_id: couple!.id, template_id: template!.id, name: 'Delete Me' })
        .select('id')
        .single()
      expect(iErr).toBeNull()
      const iSteps = await admin.from('workflow_steps').insert({
        instance_id: instance!.id,
        position: 0,
        type: 'action',
        title: 'Add a note',
        config: { actionType: 'add_note', text: 'x' } as Json,
        status: 'pending',
      })
      expect(iSteps.error).toBeNull()
      const email = await admin
        .from('couple_emails')
        .insert({ user_id: user.id, couple_id: couple!.id, subject: 'Hello', to_email: 'a@example.com' } as never)
      expect(email.error).toBeNull()

      const { error } = await admin.auth.admin.deleteUser(user.id)
      expect(error).toBeNull()

      for (const table of ['workflow_templates', 'workflow_instances', 'couples', 'couple_emails'] as const) {
        const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        expect(count, table).toBe(0)
      }
      const { count: tsCount } = await admin
        .from('workflow_template_steps')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template!.id)
      expect(tsCount).toBe(0)
      const { count: sCount } = await admin
        .from('workflow_steps')
        .select('id', { count: 'exact', head: true })
        .eq('instance_id', instance!.id)
      expect(sCount).toBe(0)
    } finally {
      await user.cleanup()
    }
  })

  it('deletes a template with steps as its signed-in owner', async () => {
    const user = await createTestUser({}, PRO)
    try {
      const { data: template } = await user.client
        .from('workflow_templates')
        .insert({ user_id: user.id, name: 'Delete Template', status: 'draft', apply_rule_type: 'manual' })
        .select('id')
        .single()
      await user.client
        .from('workflow_template_steps')
        .insert({ template_id: template!.id, position: 0, type: 'todo', title: 'Call them' })

      const { error } = await user.client.rpc('delete_workflow_template', { p_template_id: template!.id })
      expect(error).toBeNull()

      const { count } = await admin
        .from('workflow_template_steps')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', template!.id)
      expect(count).toBe(0)
      const { count: tCount } = await admin
        .from('workflow_templates')
        .select('id', { count: 'exact', head: true })
        .eq('id', template!.id)
      expect(tCount).toBe(0)
    } finally {
      await user.cleanup()
    }
  })

  it('still refuses a signed-in client writing steps_revision, and still bumps it on a step edit (F1 holds)', async () => {
    const user = await createTestUser({}, PRO)
    try {
      const { data: template } = await user.client
        .from('workflow_templates')
        .insert({ user_id: user.id, name: 'Guard Holds', status: 'draft', apply_rule_type: 'manual' })
        .select('id, steps_revision')
        .single()
      await user.client
        .from('workflow_template_steps')
        .insert({ template_id: template!.id, position: 0, type: 'todo', title: 'Call them' })
      const read = async () =>
        Number((await admin.from('workflow_templates').select('steps_revision').eq('id', template!.id).single()).data!.steps_revision)
      expect(await read()).toBe(1)
      const { error } = await user.client.from('workflow_templates').update({ steps_revision: 0 }).eq('id', template!.id)
      expect(error).not.toBeNull()
      expect(await read()).toBe(1)
    } finally {
      await user.cleanup()
    }
  })
})

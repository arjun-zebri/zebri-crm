/**
 * Skipped branches: reopening one brings its lanes back, skipping one
 * writes one timeline line, and the one-off data fix finishes branches
 * the MC skipped before the deep skip existed (Phase 6 fix wave; Task 36
 * re-review 2, N7, N8, N9).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => true) }))

import { skipBranchSide } from '@/lib/workflows/branch-skip'
import { advanceDueSteps, completeInstanceIfDone, completeStep, reopenStep } from '@/lib/workflows/executor'
import { HEAL_MAX_PAGES, HEAL_PAGE_SIZE, healStrandedInstances } from '@/lib/workflows/heal'
import type { Database, Json } from '@/types/database'
import type { WorkflowInstanceRow } from '@/types/workflows'

import { runSql } from '../helpers/sql'
import { createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

const PRO = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }
const PAST = '2026-01-01T00:00:00.000Z'

describe('skipped branches', () => {
  const admin = serviceClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser({}, PRO)
  })

  afterAll(async () => {
    await user?.cleanup()
  })

  async function newInstance(name: string): Promise<string> {
    const { data: couple } = await user.client
      .from('couples')
      .insert({ user_id: user.id, name, status: 'Enquiry' })
      .select('id')
      .single()
    const { data, error } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name, applied_at: PAST })
      .select('id')
      .single()
    expect(error).toBeNull()
    return data!.id
  }

  async function addStep(row: Database['public']['Tables']['workflow_steps']['Insert']): Promise<string> {
    const { data, error } = await admin.from('workflow_steps').insert(row).select('id').single()
    expect(error).toBeNull()
    return data!.id
  }

  /**
   * A later to-do still open, so skipping everything under the branch
   * does not complete the instance (a completed one reopens only through
   * a template that is on, and these fixtures have none).
   */
  async function openAfter(instanceId: string): Promise<void> {
    await addStep({ instance_id: instanceId, position: 9, type: 'todo', title: 'Later', status: 'pending' })
  }

  async function instanceRow(id: string): Promise<WorkflowInstanceRow> {
    const { data } = await admin.from('workflow_instances').select('*').eq('id', id).single()
    return data as unknown as WorkflowInstanceRow
  }

  async function status(id: string): Promise<string> {
    const { data } = await admin.from('workflow_steps').select('status').eq('id', id).single()
    return data!.status as string
  }

  /** A branch with one to-do on each lane and a nested branch on "no". */
  async function branchFixture(instanceId: string, branchStatus: string) {
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Paid the deposit?',
      config: {} as Json,
      status: branchStatus,
      completed_at: branchStatus === 'pending' ? null : PAST,
      due_at: PAST,
    })
    const lane = (path: 'yes' | 'no', title: string, lanStatus: string, parent = branchId) =>
      addStep({
        instance_id: instanceId,
        parent_step_id: parent,
        branch_path: path,
        position: 0,
        type: 'todo',
        title,
        status: lanStatus,
        completed_at: lanStatus === 'pending' ? null : PAST,
      })
    return { branchId, lane }
  }

  it('reopening a skipped branch brings its lanes back, nested ones too (N8)', async () => {
    const instanceId = await newInstance('Reopen Branch')
    // Built pending and skipped through the MC's own "Skip this step", so
    // the lanes carry the branch's skip reason (residual pass F3: only
    // steps the branch logic skipped come back).
    const { branchId, lane } = await branchFixture(instanceId, 'pending')
    const yes = await lane('yes', 'Say thanks', 'pending')
    const nested = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 0,
      type: 'branch',
      title: 'Asked twice?',
      config: {} as Json,
      status: 'pending',
    })
    const deep = await lane('yes', 'Chase again', 'pending', nested)
    await openAfter(instanceId)
    await expect(completeStep(admin, branchId, { skipped: true })).resolves.toBe('done')
    expect(await status(deep)).toBe('skipped')

    await expect(reopenStep(admin, branchId)).resolves.toEqual({ ok: true })

    expect(await status(branchId)).toBe('pending')
    expect(await status(yes)).toBe('pending')
    expect(await status(nested)).toBe('pending')
    expect(await status(deep)).toBe('pending')
    // Undated: their branch has not chosen yet.
    const { data } = await admin.from('workflow_steps').select('due_at').eq('id', yes).single()
    expect(data!.due_at).toBeNull()
  })

  it('reopening a finished branch brings back its losing side and keeps the lane that ran (N8)', async () => {
    const instanceId = await newInstance('Reopen Done Branch')
    const { branchId, lane } = await branchFixture(instanceId, 'done')
    const ran = await lane('yes', 'Say thanks', 'done')
    const lost = await lane('no', 'Chase the deposit', 'pending')
    // The losing side skipped the way the executor skips it when the
    // branch picks a lane (residual pass F3 setup).
    await skipBranchSide(admin, await instanceRow(instanceId), branchId, 'no', { site: 'test', reason: 'branch took yes' })

    await expect(reopenStep(admin, branchId)).resolves.toEqual({ ok: true })

    expect(await status(ran)).toBe('done')
    expect(await status(lost)).toBe('pending')
  })

  it('reopening a branch never brings back a step skipped for another reason, so a past wedding step does not send late (F3)', async () => {
    const { data: couple } = await user.client
      .from('couples')
      .insert({
        user_id: user.id,
        name: 'Reopen Past Wedding',
        status: 'Enquiry',
        event_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      })
      .select('id')
      .single()
    const { data: inst } = await admin
      .from('workflow_instances')
      .insert({ user_id: user.id, couple_id: couple!.id, name: 'Reopen Past Wedding', applied_at: PAST })
      .select('id')
      .single()
    const instanceId = inst!.id
    // No signed contract, so the branch takes "no" every time it runs.
    const branchId = await addStep({
      instance_id: instanceId,
      position: 0,
      type: 'branch',
      title: 'Signed yet?',
      config: { predicate: { kind: 'has_signed_contract' } } as Json,
      status: 'done',
      completed_at: PAST,
      due_at: PAST,
    })
    await openAfter(instanceId)
    // A week before the wedding, which passed while the workflow was
    // paused: the resume skipped it (a plain skip, no branch reason).
    const pastWedding = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 0,
      type: 'action',
      title: 'Mark them booked',
      config: { actionType: 'update_couple_stage', toStatus: 'Booked' } as Json,
      timing: { mode: 'wedding_relative', direction: 'before', amount: 1, unit: 'weeks' } as Json,
      status: 'skipped',
      completed_at: PAST,
    })
    // One the MC skipped by hand.
    const mcSkipped = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'no',
      position: 1,
      type: 'todo',
      title: 'Send the playlist form',
      status: 'pending',
    })
    await expect(completeStep(admin, mcSkipped, { skipped: true })).resolves.toBe('done')
    // And the side the branch did not take.
    const lost = await addStep({
      instance_id: instanceId,
      parent_step_id: branchId,
      branch_path: 'yes',
      position: 0,
      type: 'todo',
      title: 'Say thanks',
      status: 'pending',
    })
    await skipBranchSide(admin, await instanceRow(instanceId), branchId, 'yes', { site: 'test', reason: 'branch took no' })

    await expect(reopenStep(admin, branchId)).resolves.toEqual({ ok: true })

    expect(await status(pastWedding)).toBe('skipped')
    expect(await status(mcSkipped)).toBe('skipped')
    expect(await status(lost)).toBe('pending')

    // The branch runs again and takes "no": the past step still does not send.
    for (let tick = 0; tick < 3; tick += 1) await advanceDueSteps(admin, { userId: user.id })
    expect(await status(branchId)).toBe('done')
    expect(await status(pastWedding)).toBe('skipped')
    const { data: after } = await admin.from('couples').select('status').eq('id', couple!.id).single()
    expect(after!.status).toBe('Enquiry')
  })

  it('"Skip this step" on a branch writes one Skipped line, not two (N9)', async () => {
    const instanceId = await newInstance('Skip Branch Once')
    const { branchId, lane } = await branchFixture(instanceId, 'pending')
    const yes = await lane('yes', 'Say thanks', 'pending')

    await expect(completeStep(admin, branchId, { skipped: true })).resolves.toBe('done')

    expect(await status(yes)).toBe('skipped')
    const { data } = await admin
      .from('workflow_audit_log')
      .select('event, detail')
      .eq('step_id', branchId)
      .eq('event', 'step_skipped')
    expect(data).toHaveLength(1)
  })

  it('the data fix skips lanes a pre-deploy branch skip left pending, and the heal finishes the workflow (N7)', async () => {
    const instanceId = await newInstance('Data Fix Branch')
    // The shape an old "Skip this step" left: the branch skipped, its
    // lanes still pending.
    const { branchId, lane } = await branchFixture(instanceId, 'skipped')
    const yes = await lane('yes', 'Say thanks', 'pending')
    const no = await lane('no', 'Chase the deposit', 'pending')

    // Stuck: the lanes are outstanding, so the workflow never finishes.
    await expect(completeInstanceIfDone(admin, instanceId)).resolves.toBe(false)

    runSql(
      readFileSync(
        join(process.cwd(), 'supabase/migrations/20261024100000_workflow_skipped_branch_lanes_fix.sql'),
        'utf8',
      ),
    )

    expect(await status(yes)).toBe('skipped')
    expect(await status(no)).toBe('skipped')
    const { data: rows } = await admin
      .from('workflow_audit_log')
      .select('detail')
      .eq('step_id', branchId)
      .eq('event', 'step_skipped')
    expect(rows).toHaveLength(1)
    expect((rows![0]!.detail as { via?: string }).via).toBe('deploy_fix')

    for (let tick = 0; tick < 20; tick += 1) {
      const r = await healStrandedInstances(admin)
      if (r.healed + r.failed < HEAL_PAGE_SIZE * HEAL_MAX_PAGES) break
    }
    const { data: instance } = await admin
      .from('workflow_instances')
      .select('status, needs_recompute_at')
      .eq('id', instanceId)
      .single()
    expect(instance!.status).toBe('completed')
    expect(instance!.needs_recompute_at).toBeNull()

    // Running it again changes nothing.
    runSql(
      readFileSync(
        join(process.cwd(), 'supabase/migrations/20261024100000_workflow_skipped_branch_lanes_fix.sql'),
        'utf8',
      ),
    )
    const { data: again } = await admin
      .from('workflow_audit_log')
      .select('id')
      .eq('step_id', branchId)
      .eq('event', 'step_skipped')
    expect(again).toHaveLength(1)
  })
})

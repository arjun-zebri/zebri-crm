import { describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'
import { anonClient, createTestUser } from '../helpers/supabase'

/**
 * `automations_tick_due(p_at)` decides whether a five-minute pg_cron slot
 * wakes the app. Each case runs in a transaction that is rolled back, so
 * it can empty the queues the predicate reads (the local db is shared with
 * every other suite) and plant exactly one row. Foreign keys are off for
 * the transaction (`session_replication_role = replica`) so a planted step
 * needs only the instance row the predicate joins on.
 *
 * Planted SQL writes `AT` for the slot's instant. It defaults to five past
 * the current hour: a slot that is not on the quarter hour, so only real
 * work wakes it.
 */
function tickDue(plant = '', at = "date_trunc('hour', now()) + interval '5 minutes'"): boolean {
  const slot = `(${at})`
  const out = runSql(`
    begin;
    set local session_replication_role = replica;
    delete from public.automation_events;
    delete from public.workflow_steps;
    delete from public.outreach_messages;
    delete from public.outreach_check_runs;
    insert into public.system_heartbeats (name, last_run_at) values ('automations-tick', ${slot} - interval '5 minutes')
      on conflict (name) do update set last_run_at = excluded.last_run_at;
    ${plant.replaceAll('AT', slot)}
    select 'due=' || public.automations_tick_due(${slot});
    rollback;
  `)
  const line = out.split('\n').find((l) => l.startsWith('due='))
  if (!line) throw new Error(`no result from automations_tick_due(): ${out}`)
  return line === 'due=true'
}

const INSTANCE = '00000000-0000-4000-8000-0000000000a1'
const USER = '00000000-0000-4000-8000-0000000000b1'

/** An instance row for planted steps to hang off. */
function instance(status: string): string {
  return `
    delete from public.workflow_instances where id = '${INSTANCE}';
    insert into public.workflow_instances (id, user_id, name, status) values ('${INSTANCE}', '${USER}', 'Test', '${status}');
  `
}

function step(opts: { type?: string; due?: string; status?: string; approval?: boolean } = {}): string {
  const { type = 'wait', due = "AT - interval '1 minute'", status = 'pending', approval = false } = opts
  return `
    insert into public.workflow_steps (instance_id, position, type, status, due_at, requires_approval)
    values ('${INSTANCE}', 0, '${type}', '${status}', ${due}, ${approval});
  `
}

const setHeartbeat = (ago: string) =>
  `update public.system_heartbeats set last_run_at = AT - interval '${ago}' where name = 'automations-tick';`

describe('automations_tick_due()', () => {
  it('stays asleep off the quarter hour when nothing is waiting', () => {
    expect(tickDue()).toBe(false)
  })

  it('always wakes on the quarter hour, so the time emitters run', () => {
    for (const minute of [0, 15, 30, 45]) {
      expect(tickDue('', `date_trunc('hour', now()) + interval '${minute} minutes'`)).toBe(true)
    }
    for (const minute of [5, 10, 20, 50, 55]) {
      expect(tickDue('', `date_trunc('hour', now()) + interval '${minute} minutes'`)).toBe(false)
    }
  })

  it('wakes when the last quarter-hour call did not land', () => {
    expect(tickDue(setHeartbeat('16 minutes 1 second'))).toBe(true)
    expect(tickDue(setHeartbeat('15 minutes'))).toBe(false)
  })

  it('wakes when the tick has never run', () => {
    expect(tickDue(`delete from public.system_heartbeats where name = 'automations-tick';`)).toBe(true)
  })

  it('wakes for an unprocessed event on the bus, not a processed one', () => {
    const event = (processed: string) => `
      insert into public.automation_events (user_id, source_table, event_type, processed_at)
      values ('${USER}', 'couples', 'couple_created', ${processed});
    `
    expect(tickDue(event('null'))).toBe(true)
    expect(tickDue(event('AT'))).toBe(false)
  })

  it('wakes for an automated step that is due on an active workflow', () => {
    expect(tickDue(instance('active') + step())).toBe(true)
    expect(tickDue(instance('active') + step({ type: 'action', status: 'waiting' }))).toBe(true)
    expect(tickDue(instance('active') + step({ type: 'branch' }))).toBe(true)
  })

  it('stays asleep for steps the executor would not run', () => {
    expect(tickDue(instance('active') + step({ due: "AT + interval '1 minute'" }))).toBe(false)
    expect(tickDue(instance('active') + step({ type: 'todo' }))).toBe(false)
    expect(tickDue(instance('active') + step({ type: 'appointment' }))).toBe(false)
    expect(tickDue(instance('active') + step({ approval: true }))).toBe(false)
    expect(tickDue(instance('active') + step({ status: 'done' }))).toBe(false)
    expect(tickDue(instance('cancelled') + step())).toBe(false)
    expect(tickDue(instance('completed') + step())).toBe(false)
  })

  it('wakes for an outreach email that is due or mid-send', () => {
    const message = (status: string, when: string) => `
      insert into public.outreach_messages (enrollment_id, prospect_id, step_id, channel, status, scheduled_for, body)
      values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'email', '${status}', ${when}, 'x');
    `
    expect(tickDue(message('scheduled', "AT - interval '1 minute'"))).toBe(true)
    expect(tickDue(message('sending', "AT - interval '1 hour'"))).toBe(true)
    expect(tickDue(message('scheduled', "AT + interval '1 hour'"))).toBe(false)
    expect(tickDue(message('sent', "AT - interval '1 minute'"))).toBe(false)
  })

  it('wakes while an outreach check run is still working', () => {
    expect(tickDue(`insert into public.outreach_check_runs (kind, status) values ('activity', 'running');`)).toBe(true)
    expect(tickDue(`insert into public.outreach_check_runs (kind, status) values ('activity', 'done');`)).toBe(false)
  })

  it('cannot be called by an authenticated or anonymous client', async () => {
    const user = await createTestUser()
    try {
      const authed = await user.client.rpc('automations_tick_due' as never)
      expect(authed.error?.message).toMatch(/permission denied/)
      const anon = await anonClient().rpc('automations_tick_due' as never)
      expect(anon.error?.message).toMatch(/permission denied/)
    } finally {
      await user.cleanup()
    }
  })
})

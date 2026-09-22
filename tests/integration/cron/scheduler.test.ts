import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '@/types/database'

import { runSql } from '../helpers/sql'
import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/** Secret names the migration reads. Saved and restored around the suite. */
const NAMES = ['app_base_url', 'cron_secret', 'slack_webhook_url'] as const

function readSecret(name: string): string | null {
  const out = runSql(`select decrypted_secret from vault.decrypted_secrets where name = '${name}'`)
  return out === '' ? null : out
}

function clearSecrets() {
  runSql(`delete from vault.secrets where name in ('app_base_url', 'cron_secret', 'slack_webhook_url')`)
}

/** Poll pg_net's response table for a request id. The worker is async. */
async function waitForResponse(id: string): Promise<{ error: string | null; status: string | null }> {
  for (let i = 0; i < 50; i += 1) {
    const row = runSql(
      `select coalesce(error_msg, ''), coalesce(status_code::text, '') from net._http_response where id = ${id}`,
    )
    if (row !== '') {
      const [error, status] = row.split('|')
      return { error: error || null, status: status || null }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`no pg_net response for request ${id} after 5s`)
}

describe('pg_cron scheduler migration', () => {
  const admin = serviceClient()
  const saved: Record<string, string | null> = {}
  let savedTick: { last_run_at: string; detail: Json } | null = null
  let user: TestUser

  beforeAll(async () => {
    for (const n of NAMES) saved[n] = readSecret(n)
    clearSecrets()
    user = await createTestUser()
    // The watchdog cases move the tick's heartbeat about; put it back after.
    const { data } = await admin
      .from('system_heartbeats')
      .select('last_run_at, detail')
      .eq('name', 'automations-tick')
      .maybeSingle()
    savedTick = data
  })

  afterAll(async () => {
    clearSecrets()
    for (const n of NAMES) {
      // Dollar-quote the restored value rather than interpolating it inside
      // single quotes: a saved secret containing a `'` would otherwise break
      // out of the string literal. `$zebri$` is specific enough that a real
      // secret value colliding with it is not a realistic concern.
      if (saved[n]) runSql(`select vault.create_secret($zebri$${saved[n]}$zebri$, '${n}')`)
    }
    await admin.from('system_heartbeats').delete().eq('name', 'it-heartbeat')
    await admin.from('system_heartbeats').delete().eq('name', 'tick-watchdog')
    if (savedTick) {
      await admin.from('system_heartbeats').upsert({ name: 'automations-tick', ...savedTick })
    }
    await user?.cleanup()
  })

  it('registers every route as a zebri: job with the spec schedule', () => {
    const rows = runSql(`select jobname, schedule from cron.job where jobname like 'zebri:%' order by jobname`)
    expect(rows.split('\n')).toEqual([
      'zebri:automations-tick|* * * * *',
      'zebri:booking-reminders|30 22 * * *',
      'zebri:cron-history-prune|0 4 * * *',
      'zebri:expire-contracts|0 22 * * *',
      'zebri:prune-stripe-events|0 3 * * *',
      'zebri:tick-watchdog|*/5 * * * *',
      'zebri:workflow-digest|0 * * * *',
    ])
  })

  it('unschedules the legacy feature/video-meetings job names', () => {
    const names = runSql(`select jobname from cron.job order by jobname`).split('\n')
    expect(names).not.toContain('zebri-workflows-tick')
    expect(names).not.toContain('zebri-workflow-digest')
    // That branch's own sweep jobs (zebri-meetings-sweep, -audio-sweep)
    // exist only where its migration ran (local and dev, not CI's fresh
    // DB), so their survival is checked by hand on dev, not asserted here.
  })

  it('cron_call is a silent no-op while the secrets are unset', async () => {
    const { data, error } = await admin.rpc('cron_call', { p_path: '/api/cron/automations-tick' })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('set_scheduler_secrets writes the vault and cron_call then issues the request', async () => {
    // A closed port on loopback: the request is attempted and refused, which
    // is exactly the evidence wanted here (host and path reached pg_net).
    const { error: setErr } = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9/',
      p_secret: 'integration-test-secret-0123456789',
    })
    expect(setErr).toBeNull()
    expect(readSecret('app_base_url')).toBe('http://127.0.0.1:9/')

    const { data: id, error } = await admin.rpc('cron_call', { p_path: '/api/cron/automations-tick' })
    expect(error).toBeNull()
    expect(id).not.toBeNull()

    const res = await waitForResponse(String(id))
    expect(res.status).toBeNull()
    expect(res.error ?? '').toMatch(/refused|connect/i)
  })

  it('set_scheduler_secrets updates in place on a second call', async () => {
    const { error } = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9',
      p_secret: 'integration-test-secret-9876543210',
    })
    expect(error).toBeNull()
    expect(runSql(`select count(*) from vault.secrets where name = 'cron_secret'`)).toBe('1')
    expect(readSecret('cron_secret')).toBe('integration-test-secret-9876543210')
  })

  it('set_scheduler_secrets rejects a non-http base url and a short secret', async () => {
    const bad = await admin.rpc('set_scheduler_secrets', { p_base_url: 'ftp://x', p_secret: 'integration-test-secret-0123456789' })
    expect(bad.error?.message).toMatch(/http/)
    const short = await admin.rpc('set_scheduler_secrets', { p_base_url: 'http://127.0.0.1:9', p_secret: 'short' })
    expect(short.error?.message).toMatch(/secret/)
  })

  it('set_scheduler_secrets stores a Slack webhook, keeps it when omitted, and rejects a non-Slack host', async () => {
    const hook = 'https://hooks.slack.com/services/T000/B000/integration'
    const set = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9',
      p_secret: 'integration-test-secret-9876543210',
      p_slack_webhook_url: hook,
    })
    expect(set.error).toBeNull()
    expect(readSecret('slack_webhook_url')).toBe(hook)

    // A re-sync without the webhook (SLACK_WEBHOOK_URL unset on that deploy)
    // must not disconnect Slack.
    const again = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9',
      p_secret: 'integration-test-secret-9876543210',
    })
    expect(again.error).toBeNull()
    expect(readSecret('slack_webhook_url')).toBe(hook)

    const bad = await admin.rpc('set_scheduler_secrets', {
      p_base_url: 'http://127.0.0.1:9',
      p_secret: 'integration-test-secret-9876543210',
      p_slack_webhook_url: 'https://example.com/hook',
    })
    expect(bad.error?.message).toMatch(/hooks\.slack\.com/)
  })

  describe('tick_watchdog', () => {
    /** Point the webhook at a closed loopback port, bypassing the host check. */
    function useLoopbackWebhook() {
      runSql(`delete from vault.secrets where name = 'slack_webhook_url'`)
      runSql(`select vault.create_secret('http://127.0.0.1:9/hook', 'slack_webhook_url')`)
    }

    async function setTick(agoMs: number) {
      const { error } = await admin
        .from('system_heartbeats')
        .upsert({ name: 'automations-tick', last_run_at: new Date(Date.now() - agoMs).toISOString() })
      expect(error).toBeNull()
    }

    async function watchdogState() {
      const { data } = await admin
        .from('system_heartbeats')
        .select('detail')
        .eq('name', 'tick-watchdog')
        .maybeSingle()
      return (data?.detail ?? null) as { open?: boolean; alerted_at?: string; recovered_at?: string } | null
    }

    beforeAll(async () => {
      await admin.from('system_heartbeats').delete().eq('name', 'tick-watchdog')
    })

    it('is silent without a Slack webhook, however stale the tick', async () => {
      runSql(`delete from vault.secrets where name = 'slack_webhook_url'`)
      await setTick(60 * 60_000)
      const { data, error } = await admin.rpc('tick_watchdog')
      expect(error).toBeNull()
      expect(data).toBeNull()
      expect(await watchdogState()).toBeNull()
    })

    it('posts once when the tick is stale, then holds for an hour', async () => {
      useLoopbackWebhook()
      await setTick(6 * 60_000)

      const first = await admin.rpc('tick_watchdog')
      expect(first.error).toBeNull()
      expect(first.data).not.toBeNull()
      const res = await waitForResponse(String(first.data))
      expect(res.error ?? '').toMatch(/refused|connect/i)
      const state = await watchdogState()
      expect(state?.open).toBe(true)
      expect(state?.alerted_at).toBeTruthy()

      const second = await admin.rpc('tick_watchdog')
      expect(second.error).toBeNull()
      expect(second.data).toBeNull()
    })

    it('posts a recovery once the heartbeat is fresh again, then goes quiet', async () => {
      useLoopbackWebhook()
      await setTick(30_000)

      const recovered = await admin.rpc('tick_watchdog')
      expect(recovered.error).toBeNull()
      expect(recovered.data).not.toBeNull()
      expect((await watchdogState())?.open).toBe(false)

      const quiet = await admin.rpc('tick_watchdog')
      expect(quiet.error).toBeNull()
      expect(quiet.data).toBeNull()
      expect((await watchdogState())?.open).toBe(false)
    })

    it('treats a tick that has never run as stale', async () => {
      useLoopbackWebhook()
      await admin.from('system_heartbeats').delete().eq('name', 'tick-watchdog')
      await admin.from('system_heartbeats').delete().eq('name', 'automations-tick')
      const { data, error } = await admin.rpc('tick_watchdog')
      expect(error).toBeNull()
      expect(data).not.toBeNull()
      expect((await watchdogState())?.open).toBe(true)
    })

    it('cannot be called by an authenticated or anonymous client', async () => {
      const authed = await user.client.rpc('tick_watchdog')
      expect(authed.error?.message).toMatch(/permission denied/)
      const anon = await anonClient().rpc('tick_watchdog')
      expect(anon.error?.message).toMatch(/permission denied/)
    })
  })

  it('scheduler_status reports configuration, jobs and heartbeats with their detail', async () => {
    await admin
      .from('system_heartbeats')
      .upsert({ name: 'it-heartbeat', last_run_at: '2026-09-20T00:00:00Z', detail: { truncated: true } })
    const { data, error } = await admin.rpc('scheduler_status')
    expect(error).toBeNull()
    const status = data as {
      configured: boolean
      slack_configured: boolean
      base_url: string
      jobs: { name: string }[]
      heartbeats: Record<string, { last_run_at: string; detail: { truncated?: boolean } | null }>
    }
    expect(status.configured).toBe(true)
    expect(status.slack_configured).toBe(true)
    expect(status.base_url).toBe('http://127.0.0.1:9')
    expect(status.jobs.map((j) => j.name)).toContain('zebri:automations-tick')
    expect(status.heartbeats['it-heartbeat']?.last_run_at).toMatch(/^2026-09-20/)
    expect(status.heartbeats['it-heartbeat']?.detail?.truncated).toBe(true)
  })

  it('an authenticated user can call none of the three functions and cannot read or write heartbeats', async () => {
    const call = await user.client.rpc('cron_call', { p_path: '/x' })
    expect(call.error?.message).toMatch(/permission denied/)
    const set = await user.client.rpc('set_scheduler_secrets', { p_base_url: 'http://a', p_secret: 'integration-test-secret-0123456789' })
    expect(set.error?.message).toMatch(/permission denied/)
    const status = await user.client.rpc('scheduler_status')
    expect(status.error?.message).toMatch(/permission denied/)
    const hb = await user.client.from('system_heartbeats').select('name')
    expect(hb.error?.message).toMatch(/permission denied/)
    const hbInsert = await user.client.from('system_heartbeats').insert({ name: 'it-deny' })
    expect(hbInsert.error?.message).toMatch(/permission denied/)
  })

  it('an anonymous client can call none of the three functions and cannot read heartbeats', async () => {
    const anon = anonClient()
    const call = await anon.rpc('cron_call', { p_path: '/x' })
    expect(call.error?.message).toMatch(/permission denied/)
    const set = await anon.rpc('set_scheduler_secrets', { p_base_url: 'http://a', p_secret: 'integration-test-secret-0123456789' })
    expect(set.error?.message).toMatch(/permission denied/)
    const status = await anon.rpc('scheduler_status')
    expect(status.error?.message).toMatch(/permission denied/)
    const hb = await anon.from('system_heartbeats').select('name')
    expect(hb.error?.message).toMatch(/permission denied/)
  })
})

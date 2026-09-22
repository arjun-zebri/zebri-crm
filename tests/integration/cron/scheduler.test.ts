import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSql } from '../helpers/sql'
import { anonClient, createTestUser, serviceClient, type TestUser } from '../helpers/supabase'

/** Secret names the migration reads. Saved and restored around the suite. */
const NAMES = ['app_base_url', 'cron_secret'] as const

function readSecret(name: string): string | null {
  const out = runSql(`select decrypted_secret from vault.decrypted_secrets where name = '${name}'`)
  return out === '' ? null : out
}

function clearSecrets() {
  runSql(`delete from vault.secrets where name in ('app_base_url', 'cron_secret')`)
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
  let user: TestUser

  beforeAll(async () => {
    for (const n of NAMES) saved[n] = readSecret(n)
    clearSecrets()
    user = await createTestUser()
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
    await user?.cleanup()
  })

  it('registers every route as a zebri: job with the spec schedule', () => {
    const rows = runSql(`select jobname, schedule from cron.job where jobname like 'zebri:%' order by jobname`)
    expect(rows.split('\n')).toEqual([
      'zebri:automations-tick|*/15 * * * *',
      'zebri:booking-reminders|30 22 * * *',
      'zebri:cron-history-prune|0 4 * * *',
      'zebri:expire-contracts|0 22 * * *',
      'zebri:prune-stripe-events|0 3 * * *',
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

  it('scheduler_status reports configuration, jobs and heartbeats with their detail', async () => {
    await admin
      .from('system_heartbeats')
      .upsert({ name: 'it-heartbeat', last_run_at: '2026-09-20T00:00:00Z', detail: { truncated: true } })
    const { data, error } = await admin.rpc('scheduler_status')
    expect(error).toBeNull()
    const status = data as {
      configured: boolean
      base_url: string
      jobs: { name: string }[]
      heartbeats: Record<string, { last_run_at: string; detail: { truncated?: boolean } | null }>
    }
    expect(status.configured).toBe(true)
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

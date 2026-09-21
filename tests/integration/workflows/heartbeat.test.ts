import { afterAll, describe, expect, it } from 'vitest'

import { readHeartbeat, recordHeartbeat } from '@/lib/workflows/heartbeat'

import { serviceClient } from '../helpers/supabase'

describe('heartbeat round trip', () => {
  const admin = serviceClient()
  const NAME = 'it-round-trip'

  afterAll(async () => {
    await admin.from('system_heartbeats').delete().eq('name', NAME)
  })

  it('records, then reads back, then overwrites', async () => {
    expect(await readHeartbeat(admin, NAME)).toBeNull()
    await recordHeartbeat(admin, NAME, { truncated: false })
    const first = await readHeartbeat(admin, NAME)
    expect(first).not.toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    await recordHeartbeat(admin, NAME, { truncated: true })
    const second = await readHeartbeat(admin, NAME)
    expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime())
  })
})

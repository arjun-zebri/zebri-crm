'use server'

/**
 * Admin actions for the Scheduler card.
 *
 * Both are gated by {@link assertAdmin}; the RPCs underneath are
 * service-role only, so the gate here is the only thing between a
 * signed-in vendor and the Vault write.
 *
 * @module app/admin/scheduler-actions
 */
import { revalidatePath } from 'next/cache'

import { assertAdmin } from '@/lib/admin/assert-admin'
import { recordAdminAction } from '@/lib/admin/audit'
import {
  getSchedulerStatus,
  syncSchedulerSecrets,
  type SchedulerStatus,
  type SyncResult,
} from '@/lib/admin/scheduler'

/** Write the deployment's URL and cron secret into Vault. */
export async function syncSchedulerAction(): Promise<SyncResult> {
  const admin = await assertAdmin()
  const result = await syncSchedulerSecrets()
  // The audit log is readable by every admin; record the outcome only,
  // never the URL or the secret.
  await recordAdminAction({
    actorId: admin.id,
    targetUserId: null,
    action: 'sync_scheduler',
    details: { ok: result.ok },
  })
  revalidatePath('/admin')
  return result
}

/** Re-read `scheduler_status()` for the card's refresh button. */
export async function refreshSchedulerStatusAction(): Promise<SchedulerStatus> {
  await assertAdmin()
  return getSchedulerStatus()
}

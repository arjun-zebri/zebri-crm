/**
 * Scheduler health for the Admin page.
 *
 * Both reads go through the service-role client because the two RPCs
 * (`scheduler_status`, `set_scheduler_secrets`) are executable by
 * `service_role` only; the caller is responsible for the admin gate.
 *
 * @module lib/admin/scheduler
 */
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * One pg_cron job as the card lists it.
 *
 * `lastStatus` is pg_cron's own outcome of `select public.cron_call(...)`,
 * i.e. whether the request was handed to pg_net, not whether the route it
 * called returned 200. `cron_call` never raises, so this is
 * `succeeded` for every job pg_cron actually ran, or null when it has
 * never run; the underlying route's HTTP result is observable today only
 * for the tick, through its heartbeat (`tickTruncated` below). See
 * `.claude/docs/cicd.md` "Scheduled jobs (pg_cron)".
 */
export interface SchedulerJob {
  name: string
  schedule: string
  active: boolean
  /** pg_cron's own `succeeded` / `failed` (enqueued to pg_net, not the HTTP result), or null when it has never run. */
  lastStatus: string | null
  lastStart: string | null
  lastMessage: string | null
}

/** The parsed `scheduler_status()` result. */
export interface SchedulerStatus {
  configured: boolean
  baseUrl: string | null
  jobs: SchedulerJob[]
  /** `system_heartbeats.automations-tick.last_run_at`, or null when it has never run. */
  tickHeartbeat: string | null
  /**
   * The last tick's `detail.truncated`. Null when the tick has never run
   * or its detail carries no `truncated` key (a heartbeat written before
   * this field existed).
   */
  tickTruncated: boolean | null
}

/** The outcome of a Vault write. */
export type SyncResult = { ok: true } | { ok: false; error: string }

const EMPTY: SchedulerStatus = {
  configured: false,
  baseUrl: null,
  jobs: [],
  tickHeartbeat: null,
  tickTruncated: null,
}

/** Coerce the RPC's jsonb into {@link SchedulerStatus}; anything odd reads as unconfigured. */
export function parseSchedulerStatus(raw: unknown): SchedulerStatus {
  if (typeof raw !== 'object' || raw === null) return EMPTY
  const v = raw as Record<string, unknown>
  const jobsRaw = Array.isArray(v['jobs']) ? (v['jobs'] as Record<string, unknown>[]) : []
  const heartbeats = (
    typeof v['heartbeats'] === 'object' && v['heartbeats'] !== null ? v['heartbeats'] : {}
  ) as Record<string, unknown>
  // Each heartbeat is now `{ last_run_at, detail }`, not a bare timestamp
  // (migration 20261001000000). Anything shaped differently (an old row,
  // or a project mid-migration) reads as never-run rather than throwing.
  const tick =
    typeof heartbeats['automations-tick'] === 'object' && heartbeats['automations-tick'] !== null
      ? (heartbeats['automations-tick'] as Record<string, unknown>)
      : null
  const tickDetail =
    typeof tick?.['detail'] === 'object' && tick['detail'] !== null
      ? (tick['detail'] as Record<string, unknown>)
      : null
  return {
    configured: v['configured'] === true,
    baseUrl: typeof v['base_url'] === 'string' ? v['base_url'] : null,
    jobs: jobsRaw.map((j) => ({
      name: String(j['name'] ?? ''),
      schedule: String(j['schedule'] ?? ''),
      active: j['active'] === true,
      lastStatus: typeof j['last_status'] === 'string' ? j['last_status'] : null,
      lastStart: typeof j['last_start'] === 'string' ? j['last_start'] : null,
      lastMessage: typeof j['last_message'] === 'string' ? j['last_message'] : null,
    })),
    tickHeartbeat: typeof tick?.['last_run_at'] === 'string' ? (tick['last_run_at'] as string) : null,
    tickTruncated: typeof tickDetail?.['truncated'] === 'boolean' ? (tickDetail['truncated'] as boolean) : null,
  }
}

/** Current status from the database. */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const { data, error } = await createAdminClient().rpc('scheduler_status')
  if (error) throw new Error(`scheduler_status: ${error.message}`)
  return parseSchedulerStatus(data)
}

/** What the Admin page hands the card: a status plus the read error, if any. */
export interface SchedulerCardData {
  status: SchedulerStatus
  /** Why the status could not be read, or null when it was. */
  error: string | null
}

/**
 * {@link getSchedulerStatus} that never throws.
 *
 * The Admin page loads every section in one `Promise.all`; a project
 * where the scheduler migration has not landed yet (no `scheduler_status`
 * RPC) must degrade to an error line on this one card, not take the
 * whole page down.
 */
export async function loadSchedulerCard(): Promise<SchedulerCardData> {
  try {
    return { status: await getSchedulerStatus(), error: null }
  } catch (e) {
    return { status: EMPTY, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Push this deployment's own URL and cron secret into Vault.
 *
 * Reads env rather than taking arguments so the value pg_cron sends is
 * the value `isCronAuthorized` checks, by construction.
 */
export async function syncSchedulerSecrets(): Promise<SyncResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.CRON_SECRET
  if (!baseUrl) return { ok: false, error: 'NEXT_PUBLIC_APP_URL is not set on this deployment' }
  if (!secret) return { ok: false, error: 'CRON_SECRET is not set on this deployment' }
  const { error } = await createAdminClient().rpc('set_scheduler_secrets', {
    p_base_url: baseUrl,
    p_secret: secret,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

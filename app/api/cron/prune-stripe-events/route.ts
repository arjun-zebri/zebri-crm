/**
 * Daily prune of the Stripe webhook idempotency ledger.
 *
 * The `stripe_events` table records every webhook event ID we've
 * processed (so retries are no-ops). Stripe stops retrying after
 * ~30 days, so anything older than 90 days is dead weight.
 * Retention picked at 3× Stripe's window per [[phase_2_payments]]
 * §11.1.
 *
 * Scheduled via `vercel.json` to run daily at 03:00 UTC. Bearer-
 * token gated via {@link isCronAuthorized}. Returns
 * `{ ok, deletedCount }`. Fires the `stripe_events_prune_high`
 * alert if it deletes > 5,000 rows in a single run — a normal
 * day deletes ~the previous day's volume (hundreds to low
 * thousands at our scale); a big-delete signals either backfill
 * recovery, the prune missing previous days, or event spam.
 *
 * @module app/api/cron/prune-stripe-events/route
 */
import { NextResponse, type NextRequest } from 'next/server';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { isCronAuthorized } from '@/lib/api/cron-auth';
import { createClient as createServerClient } from '@/lib/supabase/server';

const OLDER_THAN_DAYS = 90;
const HIGH_DELETE_ALERT_THRESHOLD = 5_000;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - OLDER_THAN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from('stripe_events')
    .delete({ count: 'exact' })
    .lt('received_at', cutoff);

  if (error) {
    logger.error('[cron/prune-stripe-events] delete failed', { error: error.message });
    await sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'prune-stripe-events',
      errorMessage: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deletedCount = count ?? 0;
  logger.info('[cron/prune-stripe-events] done', { deletedCount, cutoff });

  if (deletedCount > HIGH_DELETE_ALERT_THRESHOLD) {
    await sendAlert({
      type: 'stripe_events_prune_high',
      severity: 'warn',
      deletedCount,
      olderThanDays: OLDER_THAN_DAYS,
    });
  }

  return NextResponse.json({ ok: true, deletedCount });
}

export const GET = handle;
export const POST = handle;

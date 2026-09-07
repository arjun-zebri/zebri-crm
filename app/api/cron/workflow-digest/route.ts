import { NextRequest, NextResponse } from 'next/server';

import { isCronAuthorized } from '@/lib/api/cron-auth';
import { sendWorkflowDigestEmail } from '@/lib/email/workflow-digest';
import { zonedDateParts } from '@/lib/scheduling/timezone';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildDigest, digestSubject, isDigestHour } from '@/lib/workflows/digest';

/**
 * Morning digest cron.
 *
 * Runs **hourly**, deliberately. Every MC gets the digest at 7am in their
 * own timezone, so the route wakes each hour, works out whose local 7am
 * it currently is, and sends only to them. A single daily UTC run would
 * put the email at a different local time for each MC and drift an hour
 * twice a year with daylight saving.
 *
 * Two guards keep it to one send per MC per day:
 *
 * - `daily_digest_last_sent_on` holds the MC's **local** date, so the
 *   repeated hour that daylight saving creates cannot produce a second
 *   send.
 * - a digest with nothing in it is never sent at all. An MC who receives
 *   "you have 0 things" every morning stops reading it within a week,
 *   and then misses the morning that mattered.
 *
 * @module app/api/cron/workflow-digest/route
 */
async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au';

  const { data: settings, error } = await admin
    .from('user_public_settings')
    .select('user_id, timezone, daily_digest_enabled, daily_digest_last_sent_on')
    .eq('daily_digest_enabled', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let considered = 0;
  let sent = 0;
  let skippedEmpty = 0;
  let failed = 0;

  for (const row of settings ?? []) {
    const timezone = row.timezone ?? 'Australia/Sydney';
    if (!isDigestHour(now, timezone)) continue;

    const localDate = zonedDateParts(now, timezone).date;
    if (row.daily_digest_last_sent_on === localDate) continue;

    considered += 1;

    try {
      const payload = await buildDigest(admin, row.user_id);
      if (!payload) {
        skippedEmpty += 1;
        // Stamp the date anyway. Without it, an MC with an empty morning
        // would be rebuilt on every subsequent hour of that local day.
        await admin
          .from('user_public_settings')
          .update({ daily_digest_last_sent_on: localDate })
          .eq('user_id', row.user_id);
        continue;
      }

      const { data: userRow } = await admin.auth.admin.getUserById(row.user_id);
      const email = userRow?.user?.email;
      if (!email) continue;
      const businessName =
        ((userRow?.user?.user_metadata ?? {}) as Record<string, unknown>)['business_name'];

      const result = await sendWorkflowDigestEmail(admin, {
        payload,
        to: email,
        businessName: typeof businessName === 'string' ? businessName : 'Zebri',
        subject: digestSubject(payload),
        appUrl,
      });

      if (result.ok) {
        sent += 1;
        await admin
          .from('user_public_settings')
          .update({ daily_digest_last_sent_on: localDate })
          .eq('user_id', row.user_id);
      } else {
        // Leave the date unstamped so the next hourly run retries. A
        // transient transport failure should not cost the MC their day.
        failed += 1;
      }
    } catch (err) {
      failed += 1;
      console.error('[workflow-digest] failed for user', row.user_id, err);
    }
  }

  return NextResponse.json({ considered, sent, skippedEmpty, failed });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

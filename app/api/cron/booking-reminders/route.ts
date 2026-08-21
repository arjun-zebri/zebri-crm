import { NextRequest, NextResponse } from 'next/server';

import { sendAlert } from '@/lib/alerts/send-alert';
import { isCronAuthorized } from '@/lib/api/cron-auth';
import { sendBookingReminderEmail } from '@/lib/email/booking';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Booking reminder cron: sends a reminder email to bookers one day before their confirmed meeting.
 *
 * Runs daily at 22:30 UTC (30 22 * * *). The candidate RPC `bookings_due_for_reminder()`
 * returns confirmed bookings whose meeting type has `reminder_enabled`, starting within the
 * next 36 hours, with `reminder_sent_at` null. The wider 36-hour window means nothing slips
 * between daily runs, and the `reminder_sent_at` column guards against sending duplicates
 * even though the window overlaps between days.
 */
async function handle(request: NextRequest) {
  // Constant-time bearer-token check via the shared helper.
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No user session in a cron run, so per-MC sender lookups must use the
  // admin client. The candidate RPC is service_role only.
  const admin = createAdminClient();

  const { data: rows, error } = await admin.rpc('bookings_due_for_reminder');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface BookingRow {
    booking_id: string;
    /** The capability the manage page resolves on. NOT the booking id. */
    manage_token: string;
    user_id: string;
    name: string;
    email: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    video_join_url: string | null;
    business_name: string;
    meeting_type_name: string;
    location_type: 'video' | 'phone' | 'in_person';
    address: string | null;
  }

  let sent = 0;
  let failed = 0;
  let unmarked = 0;

  // Same fallback as every other surface that builds a public URL, so a
  // missing env var yields a local link rather than "undefined/book/...".
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  for (const row of (rows as unknown as BookingRow[]) || []) {
    // manage_token, not booking_id: /book/manage/[manage_token] resolves
    // through get_booking_by_manage_token, so a booking id 404s into the
    // unavailable state and every reminder shipped a dead reschedule link.
    const manageUrl = `${APP_URL}/book/manage/${row.manage_token}`;

    const res = await sendBookingReminderEmail(admin, {
      userId: row.user_id,
      businessName: row.business_name,
      to: row.email,
      bookerName: row.name,
      meetingTypeName: row.meeting_type_name,
      start: new Date(row.starts_at),
      end: new Date(row.ends_at),
      timezone: row.timezone,
      locationType: row.location_type,
      address: row.address,
      joinUrl: row.video_join_url,
      manageUrl,
    });

    if (res.ok) {
      sent += 1;
      // Why: an email that went out but never got marked is re-sent by the
      // next run (the candidate query filters on reminder_sent_at IS NULL),
      // so a mark failure must be counted and alerted, and must never abort
      // the loop for the remaining rows. supabase-js reports failures as
      // { error } on the result; the try/catch covers thrown ones too.
      try {
        const { error: markError } = await admin.rpc('mark_booking_reminder_sent', {
          p_booking_id: row.booking_id,
        });
        if (markError) unmarked += 1;
      } catch {
        unmarked += 1;
      }
    } else {
      failed += 1;
    }
  }

  // Alert on any failures, including sends that could not be marked (those
  // will duplicate tomorrow unless someone intervenes).
  if (failed > 0 || unmarked > 0) {
    const parts = [];
    if (failed > 0) parts.push(`failed to send ${failed}`);
    if (unmarked > 0) parts.push(`sent ${unmarked} that could not be marked (will re-send next run)`);
    void sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'booking-reminders',
      errorMessage: `Booking reminders: ${parts.join('; ')} (${sent} sent successfully)`,
    });
  }

  return NextResponse.json({ ok: true, sent, failed, unmarked });
}

export const GET = handle;
export const POST = handle;

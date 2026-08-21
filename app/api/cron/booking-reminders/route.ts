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

  for (const row of (rows as unknown as BookingRow[]) || []) {
    const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/manage/${row.booking_id}`;

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
      await admin.rpc('mark_booking_reminder_sent', { p_booking_id: row.booking_id });
      sent += 1;
    } else {
      failed += 1;
    }
  }

  // Alert on any failures
  if (failed > 0) {
    void sendAlert({
      type: 'cron_job_failed',
      severity: 'error',
      job: 'booking-reminders',
      errorMessage: `Failed to send ${failed} booking reminders (${sent} sent successfully)`,
    });
  }

  return NextResponse.json({ ok: true, sent, failed });
}

export const GET = handle;
export const POST = handle;

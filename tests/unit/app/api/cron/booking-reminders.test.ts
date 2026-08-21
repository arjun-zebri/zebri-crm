/**
 * Unit tests for the booking-reminder cron route.
 *
 * The route's whole job is to turn `bookings_due_for_reminder()` rows into
 * emails, so what matters here is that the link it builds actually resolves
 * and that a failed send never marks the booking as reminded.
 *
 * @module tests/unit/app/api/cron/booking-reminders.test
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/cron-auth', () => ({
  isCronAuthorized: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/alerts/send-alert', () => ({
  sendAlert: vi.fn(),
}));

const sendBookingReminderEmail = vi.fn();
vi.mock('@/lib/email/booking', () => ({
  sendBookingReminderEmail: (...args: unknown[]) => sendBookingReminderEmail(...args),
}));

const rpc = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc }),
}));

import { GET } from '@/app/api/cron/booking-reminders/route';
import { sendAlert } from '@/lib/alerts/send-alert';
import { isCronAuthorized } from '@/lib/api/cron-auth';


/** One row as `bookings_due_for_reminder()` returns it. */
const row = {
  booking_id: '99999999-9999-9999-9999-999999999999',
  manage_token: '11111111-2222-3333-4444-555555555555',
  user_id: 'u1',
  name: 'Jane Booker',
  email: 'jane@example.com',
  starts_at: '2026-08-22T06:00:00Z',
  ends_at: '2026-08-22T06:30:00Z',
  timezone: 'Australia/Sydney',
  video_join_url: null,
  business_name: 'My Business',
  meeting_type_name: 'Consultation',
  location_type: 'video' as const,
  address: null,
};

function request() {
  return new NextRequest('https://zebri.test/api/cron/booking-reminders');
}

describe('GET /api/cron/booking-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCronAuthorized).mockReturnValue(true);
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.zebri.test';
    rpc.mockImplementation((fn: string) => {
      if (fn === 'bookings_due_for_reminder') return Promise.resolve({ data: [row], error: null });
      return Promise.resolve({ data: null, error: null });
    });
    sendBookingReminderEmail.mockResolvedValue({ ok: true });
  });

  it('rejects an unauthorised caller', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(sendBookingReminderEmail).not.toHaveBeenCalled();
  });

  it('builds the manage link from manage_token, not booking_id', async () => {
    await GET(request());

    // /book/manage/[manage_token] resolves through
    // get_booking_by_manage_token, so a booking id 404s into the unavailable
    // state: every reminder used to ship a dead reschedule link.
    expect(sendBookingReminderEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        manageUrl: `https://app.zebri.test/book/manage/${row.manage_token}`,
      }),
    );
    const [, opts] = sendBookingReminderEmail.mock.calls[0] as [unknown, { manageUrl: string }];
    expect(opts.manageUrl).not.toContain(row.booking_id);
  });

  it('falls back to localhost rather than an "undefined" URL', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await GET(request());

    const [, opts] = sendBookingReminderEmail.mock.calls[0] as [unknown, { manageUrl: string }];
    expect(opts.manageUrl.startsWith('http://localhost:3000/')).toBe(true);
    expect(opts.manageUrl).not.toContain('undefined');
  });

  it('keeps processing and alerts when marking a sent reminder fails', async () => {
    // An email that goes out but never gets marked is re-sent by tomorrow's
    // run (the candidate query filters on reminder_sent_at IS NULL), so a
    // mark failure must not abort the loop and must not pass silently.
    const row2 = { ...row, booking_id: '88888888-8888-8888-8888-888888888888', email: 'second@example.com' };
    rpc.mockImplementation((fn: string, args?: { p_booking_id?: string }) => {
      if (fn === 'bookings_due_for_reminder') {
        return Promise.resolve({ data: [row, row2], error: null });
      }
      if (fn === 'mark_booking_reminder_sent' && args?.p_booking_id === row.booking_id) {
        return Promise.reject(new Error('connection reset'));
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(sendBookingReminderEmail).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('mark_booking_reminder_sent', {
      p_booking_id: row2.booking_id,
    });
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'booking-reminders' }),
    );
  });

  it('marks the booking reminded only after a successful send', async () => {
    await GET(request());
    expect(rpc).toHaveBeenCalledWith('mark_booking_reminder_sent', {
      p_booking_id: row.booking_id,
    });
  });

  it('leaves the booking unmarked when the send fails', async () => {
    sendBookingReminderEmail.mockResolvedValue({ ok: false, error: 'smtp down' });
    const res = await GET(request());

    expect(rpc).not.toHaveBeenCalledWith('mark_booking_reminder_sent', expect.anything());
    await expect(res.json()).resolves.toMatchObject({ sent: 0, failed: 1 });
  });
});

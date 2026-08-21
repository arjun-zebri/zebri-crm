/**
 * Unit tests for booking confirmation and MC notification emails.
 *
 * Mock `@/lib/email/dispatch` and `@/lib/email/sender-identity` to verify:
 * - confirmation email renders time in booker's timezone
 * - location line renders correctly (join link, video fallback, address, phone)
 * - MC notification email goes to MC with booker as reply-to
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// These are assigned in beforeEach after hoisting.
let dispatchMock: any;
let resolveSenderMock: any;

vi.mock('@/lib/email/dispatch', () => {
  return {
    get dispatchEmail() {
      return dispatchMock;
    },
  };
});

vi.mock('@/lib/email/sender-identity', () => {
  return {
    get resolveSender() {
      return resolveSenderMock;
    },
    DEFAULT_FROM: 'Zebri <noreply@app.zebri.com.au>',
  };
});

import {
  sendBookingConfirmationEmail,
  sendBookingNotificationEmail,
} from '@/lib/email/booking';

describe('sendBookingConfirmationEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    resolveSenderMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_1' });
    resolveSenderMock.mockResolvedValue({
      transport: 'resend',
      from: 'Zebri <noreply@app.zebri.com.au>',
    });
  });

  it('renders the booker timezone time string in confirmation email', async () => {
    const supabase = {} as any;
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start,
      end,
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    expect(resolveSenderMock).toHaveBeenCalledWith(supabase, 'user123', 'Alex MCs');
    expect(dispatchMock).toHaveBeenCalled();

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload).toBeTruthy();
    if (payload) {
      expect(payload.to).toBe('couple@example.com');
      expect(payload.subject).toContain('Planning Call');
      // Check that Sydney timezone formatting appears in the HTML
      // Sydney is UTC+10 (or +11 with daylight), so Sept 15 10:00 UTC = 20:00 or 21:00 Sydney
      expect(payload.html).toMatch(/AEST|AEDT/);
    }
  });

  it('includes join link in confirmation when provided', async () => {
    const supabase = {} as any;
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start,
      end,
      timezone: 'America/New_York',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('https://zoom.us/j/12345');
  });

  it('renders "Video call (link to follow)" when video without link', async () => {
    const supabase = {} as any;

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-15T10:00:00Z'),
      end: new Date('2026-09-15T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: null,
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('Video call (link to follow)');
  });

  it('renders address when in_person', async () => {
    const supabase = {} as any;

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-15T10:00:00Z'),
      end: new Date('2026-09-15T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'in_person',
      address: '123 Main Street, Sydney NSW 2000',
      joinUrl: null,
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('123 Main Street, Sydney NSW 2000');
  });

  it('renders "Phone call" for phone location', async () => {
    const supabase = {} as any;

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-15T10:00:00Z'),
      end: new Date('2026-09-15T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'phone',
      address: null,
      joinUrl: null,
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('Phone call');
  });
});

describe('sendBookingNotificationEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_2' });
  });

  it('sends MC notification to MC email with booker as reply-to', async () => {
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    await sendBookingNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start,
        end,
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: 'https://zoom.us/j/12345',
      },
    });

    expect(dispatchMock).toHaveBeenCalled();
    const call = dispatchMock.mock.calls[0];
    expect(call).toBeTruthy();

    if (call) {
      const [, payload] = call;
      expect(payload?.to).toBe('mc@example.com');
      expect(payload?.replyTo).toBe('couple@example.com');
      // Subject should mention the meeting type or booker
      expect(payload?.subject).toMatch(/Planning Call|Sarah & Jake/i);
    }
  });

  it('uses DEFAULT_FROM as sender for MC notification', async () => {
    await sendBookingNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start: new Date('2026-09-15T10:00:00Z'),
        end: new Date('2026-09-15T11:00:00Z'),
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: null,
      },
    });

    const call = dispatchMock.mock.calls[0];
    if (call) {
      const [sender] = call;
      expect(sender.transport).toBe('resend');
      expect(sender.from).toBe('Zebri <noreply@app.zebri.com.au>');
    }
  });

  it('renders MC notification with table of booker details', async () => {
    await sendBookingNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start: new Date('2026-09-15T10:00:00Z'),
        end: new Date('2026-09-15T11:00:00Z'),
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: 'https://zoom.us/j/12345',
      },
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    // The ampersand should be HTML escaped
    expect(payload?.html).toContain('Sarah &amp; Jake');
    expect(payload?.html).toContain('couple@example.com');
    expect(payload?.html).toContain('Planning Call');
    // Table should be present (ops email style)
    expect(payload?.html).toContain('<table');
  });

  it('renders MC notification time in MC timezone', async () => {
    await sendBookingNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start: new Date('2026-09-15T10:00:00Z'),
        end: new Date('2026-09-15T11:00:00Z'),
        timezone: 'America/Los_Angeles',
        locationType: 'video',
        address: null,
        joinUrl: null,
      },
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    // LA is UTC-7 (PDT) or UTC-8 (PST); the Intl formatter may show GMT-7 or the abbreviation
    expect(payload?.html).toMatch(/GMT-7|PDT|PST/);
  });
});

describe('sendBookingConfirmationEmail - with manage URL', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    resolveSenderMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_1' });
    resolveSenderMock.mockResolvedValue({
      transport: 'resend',
      from: 'Zebri <noreply@app.zebri.com.au>',
    });
  });

  it('includes manage URL in confirmation email', async () => {
    const supabase = {} as any;
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    await sendBookingConfirmationEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start,
      end,
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123def456',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('https://app.zebri.com.au/book/manage/abc123def456');
    expect(payload?.html).toMatch(/reschedule|cancel/i);
  });
});

describe('sendBookingRescheduledEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    resolveSenderMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_3' });
    resolveSenderMock.mockResolvedValue({
      transport: 'resend',
      from: 'Zebri <noreply@app.zebri.com.au>',
    });
  });

  it('sends reschedule email to booker with old and new times', async () => {
    const supabase = {} as any;
    const previousStart = new Date('2026-09-10T10:00:00Z');
    const newStart = new Date('2026-09-15T14:00:00Z');
    const newEnd = new Date('2026-09-15T15:00:00Z');

    // Mock the send
    const { sendBookingRescheduledEmail } = await import('@/lib/email/booking');
    await sendBookingRescheduledEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      previousStart,
      start: newStart,
      end: newEnd,
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123def456',
    });

    expect(resolveSenderMock).toHaveBeenCalledWith(supabase, 'user123', 'Alex MCs');
    expect(dispatchMock).toHaveBeenCalled();

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('Sarah &amp; Jake');
    expect(payload?.html).toContain('https://app.zebri.com.au/book/manage/abc123def456');
    expect(payload?.html).toMatch(/AEST|AEDT/);
  });
});

describe('sendBookingCancelledEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    resolveSenderMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_4' });
    resolveSenderMock.mockResolvedValue({
      transport: 'resend',
      from: 'Zebri <noreply@app.zebri.com.au>',
    });
  });

  it('sends cancellation email to booker without manage URL', async () => {
    const supabase = {} as any;
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    const { sendBookingCancelledEmail } = await import('@/lib/email/booking');
    await sendBookingCancelledEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start,
      end,
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
    });

    expect(resolveSenderMock).toHaveBeenCalledWith(supabase, 'user123', 'Alex MCs');
    expect(dispatchMock).toHaveBeenCalled();

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('cancel');
    expect(payload?.html).not.toContain('book/manage');
    expect(payload?.html).toContain('Sarah &amp; Jake');
    expect(payload?.html).toMatch(/AEST|AEDT/);
  });

  it('escapes booker names with script tags', async () => {
    const supabase = {} as any;

    const { sendBookingCancelledEmail } = await import('@/lib/email/booking');
    await sendBookingCancelledEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah <script>alert("xss")</script>',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-15T10:00:00Z'),
      end: new Date('2026-09-15T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'phone',
      address: null,
      joinUrl: null,
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('Sarah &lt;script&gt;');
    expect(payload?.html).not.toContain('<script>');
  });
});

describe('sendBookingChangeNotificationEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_5' });
  });

  it('sends MC notification for rescheduled booking', async () => {
    const { sendBookingChangeNotificationEmail } = await import('@/lib/email/booking');
    const start = new Date('2026-09-15T10:00:00Z');
    const end = new Date('2026-09-15T11:00:00Z');

    await sendBookingChangeNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      kind: 'rescheduled',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start,
        end,
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: null,
      },
    });

    expect(dispatchMock).toHaveBeenCalled();
    const call = dispatchMock.mock.calls[0];
    const [sender, payload] = call;

    expect(sender.transport).toBe('resend');
    expect(sender.from).toBe('Zebri <noreply@app.zebri.com.au>');
    expect(payload?.to).toBe('mc@example.com');
    expect(payload?.replyTo).toBe('couple@example.com');
    expect(payload?.subject).toMatch(/reschedule/i);
    expect(payload?.html).toContain('Sarah &amp; Jake');
  });

  it('sends MC notification for cancelled booking with different subject', async () => {
    const { sendBookingChangeNotificationEmail } = await import('@/lib/email/booking');

    await sendBookingChangeNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      kind: 'cancelled',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start: new Date('2026-09-15T10:00:00Z'),
        end: new Date('2026-09-15T11:00:00Z'),
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: null,
      },
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.subject).toMatch(/cancel/i);
    expect(payload?.subject).not.toMatch(/reschedule/i);
  });

  it('uses DEFAULT_FROM for MC notification', async () => {
    const { sendBookingChangeNotificationEmail } = await import('@/lib/email/booking');

    await sendBookingChangeNotificationEmail({
      to: 'mc@example.com',
      mcBusinessName: 'Alex MCs',
      kind: 'rescheduled',
      booking: {
        bookerName: 'Sarah & Jake',
        bookerEmail: 'couple@example.com',
        meetingTypeName: 'Planning Call',
        start: new Date('2026-09-15T10:00:00Z'),
        end: new Date('2026-09-15T11:00:00Z'),
        timezone: 'Australia/Sydney',
        locationType: 'video',
        address: null,
        joinUrl: null,
      },
    });

    const call = dispatchMock.mock.calls[0];
    const [sender] = call;
    expect(sender.from).toBe('Zebri <noreply@app.zebri.com.au>');
  });
});

describe('sendBookingReminderEmail', () => {
  beforeEach(() => {
    dispatchMock = vi.fn();
    resolveSenderMock = vi.fn();
    dispatchMock.mockResolvedValue({ ok: true, messageId: 'msg_6' });
    resolveSenderMock.mockResolvedValue({
      transport: 'resend',
      from: 'Zebri <noreply@app.zebri.com.au>',
    });
  });

  it('sends reminder email tomorrow phrasing in booker timezone', async () => {
    const { sendBookingReminderEmail } = await import('@/lib/email/booking');
    const supabase = {} as any;
    // Tomorrow in Sydney (UTC+10/+11)
    const now = new Date('2026-09-15T10:00:00Z');
    const tomorrow = new Date('2026-09-16T10:00:00Z');
    const tomorrowEnd = new Date('2026-09-16T11:00:00Z');

    await sendBookingReminderEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: tomorrow,
      end: tomorrowEnd,
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    expect(resolveSenderMock).toHaveBeenCalledWith(supabase, 'user123', 'Alex MCs');
    expect(dispatchMock).toHaveBeenCalled();

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.to).toBe('couple@example.com');
    expect(payload?.subject).toMatch(/tomorrow|reminder/i);
    expect(payload?.html).toContain('tomorrow');
    expect(payload?.html).toMatch(/AEST|AEDT/);
  });

  it('includes join link in reminder when provided', async () => {
    const { sendBookingReminderEmail } = await import('@/lib/email/booking');
    const supabase = {} as any;
    const tomorrow = new Date('2026-09-16T14:00:00Z');
    const tomorrowEnd = new Date('2026-09-16T15:00:00Z');

    await sendBookingReminderEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: tomorrow,
      end: tomorrowEnd,
      timezone: 'America/New_York',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/99999',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('https://zoom.us/j/99999');
  });

  it('renders manage link in reminder', async () => {
    const { sendBookingReminderEmail } = await import('@/lib/email/booking');
    const supabase = {} as any;

    await sendBookingReminderEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-16T10:00:00Z'),
      end: new Date('2026-09-16T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'video',
      address: null,
      joinUrl: 'https://zoom.us/j/12345',
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123def456',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('https://app.zebri.com.au/book/manage/abc123def456');
  });

  it('renders address for in_person meeting', async () => {
    const { sendBookingReminderEmail } = await import('@/lib/email/booking');
    const supabase = {} as any;

    await sendBookingReminderEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah & Jake',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-16T10:00:00Z'),
      end: new Date('2026-09-16T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'in_person',
      address: '42 Chapel Lane, Melbourne VIC 3000',
      joinUrl: null,
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('42 Chapel Lane, Melbourne VIC 3000');
  });

  it('escapes booker-controlled strings', async () => {
    const { sendBookingReminderEmail } = await import('@/lib/email/booking');
    const supabase = {} as any;

    await sendBookingReminderEmail(supabase, {
      userId: 'user123',
      businessName: 'Alex MCs',
      to: 'couple@example.com',
      bookerName: 'Sarah <script>alert("xss")</script>',
      meetingTypeName: 'Planning Call',
      start: new Date('2026-09-16T10:00:00Z'),
      end: new Date('2026-09-16T11:00:00Z'),
      timezone: 'Australia/Sydney',
      locationType: 'phone',
      address: null,
      joinUrl: null,
      manageUrl: 'https://app.zebri.com.au/book/manage/abc123',
    });

    const payload = dispatchMock.mock.calls[0]?.[1];
    expect(payload?.html).toContain('Sarah &lt;script&gt;');
    expect(payload?.html).not.toContain('<script>');
  });
});

import { describe, expect, it } from 'vitest';

import type { GmailThread } from '@/lib/outreach/gmail/client';
import { isInSendWindow } from '@/lib/outreach/sequencer/schedule';
import { inboundAfter } from '@/lib/outreach/services/send-guards';

const OWN = 'founder@zebri.com.au';
const SENT = new Date('2026-10-13T00:00:00Z');

function msg(id: string, from: string, internalMs: number, extra: { auto?: string; subject?: string } = {}): GmailThread['messages'] extends (infer M)[] | undefined ? M : never {
  const headers = [{ name: 'From', value: from }];
  if (extra.auto) headers.push({ name: 'Auto-Submitted', value: extra.auto });
  if (extra.subject) headers.push({ name: 'Subject', value: extra.subject });
  return { id, threadId: 't1', internalDate: String(internalMs), payload: { headers } };
}

describe('inboundAfter', () => {
  it('is true for a real reply dated after our last send', () => {
    const thread: GmailThread = { id: 't1', messages: [msg('a', OWN, SENT.getTime() - 1000), msg('b', '"Jane" <jane@x.com>', SENT.getTime() + 60_000)] };
    expect(inboundAfter(thread, OWN, SENT)).toBe(true);
  });

  it('ignores replies older than our last send', () => {
    const thread: GmailThread = { id: 't1', messages: [msg('b', 'jane@x.com', SENT.getTime() - 60_000)] };
    expect(inboundAfter(thread, OWN, SENT)).toBe(false);
  });

  it('ignores our own messages and auto-replies', () => {
    const thread: GmailThread = {
      id: 't1',
      messages: [
        msg('a', OWN, SENT.getTime() + 1000),
        msg('b', 'jane@x.com', SENT.getTime() + 2000, { auto: 'auto-replied' }),
      ],
    };
    expect(inboundAfter(thread, OWN, SENT)).toBe(false);
  });

  it('counts a bounce in the thread as inbound', () => {
    const thread: GmailThread = { id: 't1', messages: [msg('b', 'mailer-daemon@googlemail.com', SENT.getTime() + 1000)] };
    expect(inboundAfter(thread, OWN, SENT)).toBe(true);
  });
});

describe('isInSendWindow', () => {
  const settings = { windowStart: '09:00', windowEnd: '16:00', weekdays: [1, 2, 3, 4, 5] };
  // 2026-10-13 is a Tuesday. Sydney is UTC+11 in October (AEDT).
  it('is true inside the window on an allowed weekday', () => {
    expect(isInSendWindow(new Date('2026-10-13T23:30:00Z'), 'Australia/Sydney', settings)).toBe(true); // Wed 10:30
  });

  it('is false at night, and the window end is exclusive', () => {
    expect(isInSendWindow(new Date('2026-10-13T14:30:00Z'), 'Australia/Sydney', settings)).toBe(false); // Tue 01:30
    expect(isInSendWindow(new Date('2026-10-14T05:00:00Z'), 'Australia/Sydney', settings)).toBe(false); // Wed 16:00
  });

  it('uses the recipient zone, not Sydney', () => {
    // 09:30 in Perth (AWST, UTC+8) is 01:30 UTC; that is 12:30 Sydney, but 01:30 UTC is 09:30 Perth.
    expect(isInSendWindow(new Date('2026-10-13T01:30:00Z'), 'Australia/Perth', settings)).toBe(true);
  });

  it('is false on a disallowed weekday', () => {
    expect(isInSendWindow(new Date('2026-10-17T23:30:00Z'), 'Australia/Sydney', settings)).toBe(false); // Sat 10:30
  });
});

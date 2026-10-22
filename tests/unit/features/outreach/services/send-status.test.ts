/**
 * Rules behind the Today "why is nothing sending?" line. Times are fixed:
 * 2026-10-13 is a Tuesday; 02:00 UTC is 13:00 in Sydney (AEDT, UTC+11).
 */
import { describe, expect, it } from 'vitest';

import { computeSendStatus, type SendStatusInput } from '@/lib/outreach/services/send-status';

const TUE_1PM_SYDNEY = new Date('2026-10-13T02:00:00Z');

function input(overrides: Partial<SendStatusInput> = {}): SendStatusInput {
  return {
    now: TUE_1PM_SYDNEY,
    settings: {
      sending_paused: false,
      paused_reason: null,
      send_window_start: '09:00:00',
      send_window_end: '17:00:00',
      send_weekdays: [1, 2, 3, 4, 5],
      email_daily_cap: 30,
      email_ramp: [],
      ramp_started_on: null,
    },
    mailboxConnected: true,
    activeCampaigns: 1,
    sentToday: 4,
    nextScheduledAt: null,
    schedulerLastRunAt: new Date(TUE_1PM_SYDNEY.getTime() - 5 * 60_000),
    ...overrides,
  };
}

describe('computeSendStatus', () => {
  it('reports sending with the count and no blockers when everything is in place', () => {
    const s = computeSendStatus(input());
    expect(s.blocked).toBe(false);
    expect(s.reasons).toEqual([]);
    expect(s.headline).toBe('Sending. Nothing is scheduled right now.');
    expect(s.sent).toBe(4);
    expect(s.cap).toBe(30);
    expect(s.schedulerWarning).toBeNull();
  });

  it('shows the pause reason first when sending is paused', () => {
    const s = computeSendStatus(input({ settings: { ...input().settings, sending_paused: true, paused_reason: 'Gmail token expired' } }));
    expect(s.blocked).toBe(true);
    expect(s.headline).toBe('Sending is paused: Gmail token expired');
  });

  it('names a missing mailbox and a missing active campaign', () => {
    const s = computeSendStatus(input({ mailboxConnected: false, activeCampaigns: 0 }));
    expect(s.reasons).toContain('No mailbox connected. Connect one in Settings.');
    expect(s.reasons).toContain('No active campaign. Activate one in Campaigns.');
  });

  it('says when the next window opens after hours', () => {
    // 20:00 Sydney on Tuesday.
    const s = computeSendStatus(input({ now: new Date('2026-10-13T09:00:00Z') }));
    expect(s.headline).toContain('Outside the send window (9:00 am to 5:00 pm, Sydney time).');
    expect(s.headline).toContain('Next window opens Wednesday at 9:00 am.');
  });

  it('says sending is off on a day that is not allowed', () => {
    // Saturday 13:00 Sydney.
    const s = computeSendStatus(input({ now: new Date('2026-10-17T02:00:00Z') }));
    expect(s.headline).toContain('Sending is off on Saturday.');
  });

  it('shows the daily limit reached and that it resumes tomorrow', () => {
    const s = computeSendStatus(input({ sentToday: 30 }));
    expect(s.reasons).toContain('Daily limit reached (30 of 30). Resumes tomorrow.');
  });

  it('warns when the scheduler last ran more than 20 minutes ago', () => {
    const s = computeSendStatus(input({ schedulerLastRunAt: new Date(TUE_1PM_SYDNEY.getTime() - 40 * 60_000) }));
    expect(s.schedulerWarning).toBe('Scheduler last ran 40 minutes ago. Scheduled emails may be late.');
  });

  it('warns when the scheduler has never run', () => {
    const s = computeSendStatus(input({ schedulerLastRunAt: null }));
    expect(s.schedulerWarning).toBe('The scheduler has never run. Scheduled emails will not go out.');
  });
});

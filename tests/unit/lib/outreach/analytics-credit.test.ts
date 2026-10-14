import { describe, expect, it } from 'vitest';

import { computeAnalytics, type EnrollmentFact, type MessageFact } from '@/lib/outreach/analytics/compute';

const enrollment: EnrollmentFact = {
  id: 'e1', prospectId: 'p1', sequenceId: 's1', enrolledAt: '2026-10-01T00:00:00Z', state: 'VIC', score: 70,
  hasWebsite: true, hasInstagram: false, followers: null, emailSource: 'found', sentiment: null,
};

const msg = (id: string, step: number, sentAt: string, hour: number): MessageFact => ({
  id, enrollmentId: 'e1', stepPosition: step, variantId: 'v' + step, variantLabel: 'A', channel: 'email',
  sentAt, localHour: hour, localWeekday: 2,
});

describe('computeAnalytics crediting', () => {
  const messages = [msg('m1', 1, '2026-10-02T00:00:00Z', 9), msg('m2', 2, '2026-10-05T00:00:00Z', 10)];

  it('credits a link-click booking (no reply) to the last message sent before it', () => {
    const r = computeAnalytics([enrollment], messages, [{ prospectId: 'p1', type: 'demo_booked', at: '2026-10-06T00:00:00Z' }], { sequences: new Map() });
    const step2 = r.steps.find((row) => row.key === '2')!;
    const step1 = r.steps.find((row) => row.key === '1')!;
    expect(step2.metrics.booked.successes).toBe(1);
    expect(step1.metrics.booked.successes).toBe(0);
  });

  it('credits a payment to the message before it, and a reply to the message it answers', () => {
    const r = computeAnalytics(
      [enrollment],
      messages,
      [
        { prospectId: 'p1', type: 'replied', at: '2026-10-03T00:00:00Z' },
        { prospectId: 'p1', type: 'paying', at: '2026-10-09T00:00:00Z' },
      ],
      { sequences: new Map() },
    );
    expect(r.steps.find((row) => row.key === '1')!.metrics.reply.successes).toBe(1);
    expect(r.steps.find((row) => row.key === '2')!.metrics.paying.successes).toBe(1);
  });
});

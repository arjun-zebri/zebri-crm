import { describe, expect, it } from 'vitest';

import { computeAnalytics, followerBand, scoreBand, type EnrollmentFact, type MessageFact, type OutcomeFact } from '@/lib/outreach/analytics/compute';
import { wilson } from '@/lib/outreach/analytics/wilson';
import { canAutoAdvance } from '@/lib/outreach/types';

describe('wilson', () => {
  it('gives a sensible range at small n and at zero', () => {
    const r = wilson(3, 40);
    expect(r.rate).toBeCloseTo(0.075);
    expect(r.low!).toBeGreaterThan(0.02);
    expect(r.high!).toBeLessThan(0.21);
    expect(wilson(0, 10).low).toBe(0);
    expect(wilson(0, 0).rate).toBeNull();
  });
});

const enrollment = (id: string, over: Partial<EnrollmentFact> = {}): EnrollmentFact => ({
  id, prospectId: `p-${id}`, sequenceId: 'seq-a', enrolledAt: '2026-10-01T00:00:00Z', state: 'NSW', score: 70,
  hasWebsite: true, hasInstagram: false, followers: null, emailSource: 'sheet', sentiment: null, ...over,
});
const message = (id: string, enrollmentId: string, step: number, sentAt: string, over: Partial<MessageFact> = {}): MessageFact => ({
  id, enrollmentId, stepPosition: step, variantId: `v${step}a`, variantLabel: 'A', channel: 'email', sentAt, localHour: 10, localWeekday: 2, ...over,
});

describe('computeAnalytics', () => {
  const enrollments = [enrollment('1', { sentiment: 'positive' }), enrollment('2', { sequenceId: 'seq-b', state: 'VIC' }), enrollment('3')];
  const messages = [
    message('m1', '1', 1, '2026-10-01T01:00:00Z'),
    message('m2', '1', 2, '2026-10-04T01:00:00Z', { localHour: 14 }),
    message('m3', '2', 1, '2026-10-01T02:00:00Z'),
  ];
  const events: OutcomeFact[] = [
    { prospectId: 'p-1', type: 'replied', at: '2026-10-05T00:00:00Z' },
    { prospectId: 'p-1', type: 'demo_booked', at: '2026-10-06T00:00:00Z' },
    // Before enrolment: must not count.
    { prospectId: 'p-2', type: 'replied', at: '2026-09-01T00:00:00Z' },
  ];
  const report = computeAnalytics(enrollments, messages, events, { sequences: new Map([['seq-a', 'Email first'], ['seq-b', 'IG first']]) });

  it('counts only contacted enrolments per arm', () => {
    const a = report.arms.find((r) => r.key === 'seq-a')!;
    expect(a.label).toBe('Email first');
    expect(a.metrics.n).toBe(1);
    expect(a.metrics.reply.successes).toBe(1);
    expect(a.metrics.positive.successes).toBe(1);
    expect(a.metrics.booked.successes).toBe(1);
    expect(report.arms.find((r) => r.key === 'seq-b')!.metrics.reply.successes).toBe(0);
  });

  it('credits the reply to the last message sent before it', () => {
    const step2 = report.steps.find((r) => r.key === '2')!;
    const step1 = report.steps.find((r) => r.key === '1')!;
    expect(step2.metrics.reply.successes).toBe(1);
    expect(step1.metrics.reply.successes).toBe(0);
    expect(report.hours.find((r) => r.key === '14')!.metrics.reply.successes).toBe(1);
    expect(report.weekdays[0]!.label).toBe('Tue');
  });

  it('breaks down by segment', () => {
    const state = report.segments.find((s) => s.dimension === 'State')!;
    expect(state.rows.map((r) => r.key)).toEqual(['NSW', 'VIC']);
  });

  it('bands scores and followers', () => {
    expect(scoreBand(85)).toBe('80-100');
    expect(scoreBand(null)).toBe('Unscored');
    expect(followerBand(600)).toBe('500-2k');
  });
});

describe('canAutoAdvance', () => {
  it('only moves forward, never out of opted_out', () => {
    expect(canAutoAdvance('new', 'contacted')).toBe(true);
    expect(canAutoAdvance('replied', 'contacted')).toBe(false);
    expect(canAutoAdvance('opted_out', 'paying')).toBe(false);
    expect(canAutoAdvance('lost', 'demo_booked')).toBe(true);
    expect(canAutoAdvance('lost', 'contacted')).toBe(false);
  });
});

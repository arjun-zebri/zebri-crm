/**
 * Stale bus events are never dropped silently (Task 36, audit M4).
 *
 * The dispatcher stamps any event older than a day as `skipped: stale`
 * rather than replaying it. After an outage longer than that, every
 * enquiry that arrived during it goes that way, so each batch raises
 * `workflow_events_stale` with the count and leaves a record the Admin
 * scheduler card reads. The alert is deduped the way
 * `workflow_send_cap_unreadable` is, and a suppressed batch's count is
 * carried into the next alert rather than lost.
 *
 * @module tests/unit/lib/workflows/stale-events-alert.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/alerts/send-alert', () => ({ sendAlert: vi.fn(async () => undefined) }));

import { sendAlert } from '@/lib/alerts/send-alert';
import {
  _resetStaleAlertDedupForTest,
  dispatchPendingEvents,
  STALE_EVENTS_HEARTBEAT,
} from '@/lib/workflows/dispatcher';

import { called, fakeSupabase } from './fake-supabase';

/** A bus where the stale sweep stamps `stale` rows and nothing else is pending. */
function bus(stale: number) {
  return fakeSupabase((table, calls) => {
    if (table === 'automation_events' && called(calls, 'update')) return { data: null, count: stale };
    return { data: [] };
  });
}

describe('stale event alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStaleAlertDedupForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('alerts with the count and records it for the Admin card', async () => {
    const { client, log } = bus(7);

    const result = await dispatchPendingEvents(client);

    expect(result.staleEvents).toBe(7);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_events_stale', severity: 'error', count: 7, suppressed: 0 }),
    );
    const record = log.find((q) => q.table === 'system_heartbeats');
    expect(record).toBeDefined();
    expect(record!.calls[0]?.method).toBe('upsert');
    expect(record!.calls[0]?.args[0]).toMatchObject({
      name: STALE_EVENTS_HEARTBEAT,
      detail: { count: 7 },
    });
  });

  it('stays quiet, and writes nothing, when nothing was stale', async () => {
    const { client, log } = bus(0);
    await dispatchPendingEvents(client);
    expect(vi.mocked(sendAlert)).not.toHaveBeenCalled();
    expect(log.some((q) => q.table === 'system_heartbeats')).toBe(false);
  });

  it('dedupes inside ten minutes and carries the suppressed count into the next alert', async () => {
    await dispatchPendingEvents(bus(5).client);
    await dispatchPendingEvents(bus(3).client);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-09-26T10:11:00.000Z'));
    await dispatchPendingEvents(bus(2).client);

    expect(vi.mocked(sendAlert)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendAlert).mock.calls[1]?.[0]).toMatchObject({
      type: 'workflow_events_stale',
      count: 2,
      suppressed: 3,
    });
  });

  it('still alerts when the Admin card record cannot be written', async () => {
    const { client } = fakeSupabase((table, calls) => {
      if (table === 'automation_events' && called(calls, 'update')) return { data: null, count: 4 };
      if (table === 'system_heartbeats') return { data: null, error: { message: 'permission denied' } };
      return { data: [] };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await dispatchPendingEvents(client);

    expect(result.staleEvents).toBe(4);
    expect(vi.mocked(sendAlert)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow_events_stale', count: 4 }),
    );
  });
});

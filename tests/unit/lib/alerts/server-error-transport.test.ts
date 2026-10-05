/**
 * Unit tests for the logger transport that forwards server
 * `logger.error` calls to Slack with the real cause.
 *
 * @module tests/unit/lib/alerts/server-error-transport.test
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AlertEvent } from '@/lib/alerts/events';
import {
  createServerErrorTransport,
  idsFromContext,
  SERVER_ERROR_DEDUPE_MS,
  type ServerErrorTransportDeps,
} from '@/lib/alerts/server-error-transport';

const fkError = {
  message: 'insert or update on table "automation_events" violates foreign key constraint',
  code: '23503',
  details: 'Key (couple_id)=(d95a2ff0) is not present in table "couples".',
};

let sent: AlertEvent[];
let clock: number;
let tasks: Array<() => Promise<void>>;

function deps(overrides: Partial<ServerErrorTransportDeps> = {}): ServerErrorTransportDeps {
  return {
    send: async (event) => {
      sent.push(event);
    },
    lookupEmail: async () => 'mc@business.example',
    schedule: (task) => {
      tasks.push(task);
    },
    now: () => clock,
    suppressed: () => false,
    ...overrides,
  };
}

async function flush() {
  await Promise.all(tasks.splice(0).map((task) => task()));
}

beforeEach(() => {
  sent = [];
  tasks = [];
  clock = 1_000_000;
});

describe('createServerErrorTransport', () => {
  it('posts the real Postgres cause with the account and record ids', async () => {
    const transport = createServerErrorTransport(deps());
    transport('error', '[couples/actions] deleteCoupleAction failed', { userId: 'user-1', coupleId: 'couple-1' }, fkError);
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'server_error',
      source: '[couples/actions] deleteCoupleAction failed',
      message: fkError.message,
      code: '23503',
      detail: fkError.details,
      account: 'mc@business.example',
      userId: 'user-1',
      ids: { coupleId: 'couple-1' },
    });
  });

  it('ignores non-error levels and the alert layer’s own log lines', async () => {
    const transport = createServerErrorTransport(deps());
    transport('warn', 'something odd', {}, undefined);
    transport('error', 'alert: payment_failed', {}, undefined);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('dedupes the same failure inside the window, then posts again after it', async () => {
    const transport = createServerErrorTransport(deps());
    transport('error', '[cron] tick failed', {}, fkError);
    transport('error', '[cron] tick failed', {}, fkError);
    await flush();
    expect(sent).toHaveLength(1);

    clock += SERVER_ERROR_DEDUPE_MS;
    transport('error', '[cron] tick failed', {}, fkError);
    await flush();
    expect(sent).toHaveLength(2);
  });

  it('does nothing when Slack is suppressed (local runs)', async () => {
    const transport = createServerErrorTransport(deps({ suppressed: () => true }));
    transport('error', '[x] failed', {}, fkError);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('still posts without an account when the lookup fails, and never throws', async () => {
    const send = vi.fn(async () => {
      throw new Error('slack down');
    });
    const transport = createServerErrorTransport(
      deps({ send, lookupEmail: async () => undefined }),
    );
    transport('error', '[x] failed', { userId: 'user-1' }, fkError);
    await expect(flush()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(expect.not.objectContaining({ account: expect.anything() }));
  });
});

describe('idsFromContext', () => {
  it('keeps id-named scalars and drops everything else', () => {
    expect(
      idsFromContext({
        userId: 'user-1',
        coupleId: 'couple-1',
        step_id: 'step-1',
        id: 7,
        email: 'someone@example.com',
        payload: { coupleId: 'nested' },
      }),
    ).toEqual({ coupleId: 'couple-1', step_id: 'step-1', id: '7' });
  });
});

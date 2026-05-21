import { afterEach, beforeEach, vi } from 'vitest';

import { isCronAuthorized } from '@/lib/api/cron-auth';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function makeRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) headers.set('authorization', authHeader);
  return new Request('https://example.com/api/cron/x', { headers });
}

describe('isCronAuthorized', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret$with$special$chars');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    if (ORIGINAL_SECRET !== undefined) process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it('accepts the matching Bearer token', () => {
    expect(isCronAuthorized(makeRequest('Bearer s3cret$with$special$chars'))).toBe(true);
  });

  it('rejects the wrong token', () => {
    expect(isCronAuthorized(makeRequest('Bearer wrong'))).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isCronAuthorized(makeRequest(null))).toBe(false);
  });

  it('rejects a token without the Bearer scheme', () => {
    expect(isCronAuthorized(makeRequest('s3cret$with$special$chars'))).toBe(false);
  });

  it('fail-closes when CRON_SECRET is unset', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(isCronAuthorized(makeRequest('Bearer anything'))).toBe(false);
  });
});

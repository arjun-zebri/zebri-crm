import { describe, expect, it } from 'vitest';

import { checkEmail, isDnsTimeout, type DnsResolver } from '@/lib/outreach/checks/email-check';
import { estimateCostCents, parseItem } from '@/lib/outreach/checks/instagram-apify';
import { isPrivateAddress } from '@/lib/outreach/checks/website';

const err = (code: string) => Object.assign(new Error(code), { code });

function resolver(mx: Record<string, string[] | Error>, a: Record<string, string[] | Error> = {}): DnsResolver {
  return {
    mx: async (d) => {
      const v = mx[d];
      if (v instanceof Error) throw v;
      if (!v) throw err('ENOTFOUND');
      return v.map((exchange) => ({ exchange }));
    },
    a: async (d) => {
      const v = a[d];
      if (v instanceof Error) throw v;
      if (!v) throw err('ENOTFOUND');
      return v;
    },
  };
}

describe('checkEmail', () => {
  it('passes a domain with MX', async () => {
    expect(await checkEmail('jane@x.com.au', resolver({ 'x.com.au': ['mx.x.com.au'] }))).toBe('ok');
  });

  it('falls back to an A record', async () => {
    expect(await checkEmail('jane@x.com', resolver({}, { 'x.com': ['1.2.3.4'] }))).toBe('ok');
  });

  it('flags dead domains, null MX, junk and disposable addresses', async () => {
    expect(await checkEmail('jane@expired.com', resolver({}))).toBe('no_mx');
    expect(await checkEmail('jane@nomail.com', resolver({ 'nomail.com': ['.'] }))).toBe('no_mx');
    expect(await checkEmail('not-an-email', resolver({}))).toBe('invalid_syntax');
    expect(await checkEmail('x@mailinator.com', resolver({}))).toBe('disposable');
  });

  it('throws on transient DNS failure instead of condemning the address', async () => {
    await expect(checkEmail('jane@x.com', resolver({ 'x.com': err('ETIMEOUT') }))).rejects.toThrow();
  });
});

describe('isDnsTimeout', () => {
  it('singles out a lookup that ran out of time', () => {
    expect(isDnsTimeout(err('ETIMEOUT'))).toBe(true);
    expect(isDnsTimeout(err('EBUSY'))).toBe(false);
    expect(isDnsTimeout(err('ESERVFAIL'))).toBe(false);
    expect(isDnsTimeout(new Error('boom'))).toBe(false);
    expect(isDnsTimeout(null)).toBe(false);
  });
});

describe('parseItem (Apify)', () => {
  it('takes the newest post and the profile stats', () => {
    const p = parseItem({
      username: 'Jane.C', followersCount: 1200, postsCount: 300, biography: 'Celebrant', private: false,
      latestPosts: [{ timestamp: '2026-09-01T00:00:00Z' }, { timestamp: '2026-10-01T00:00:00Z' }],
    });
    expect(p).toEqual({ handle: 'jane.c', status: 'ok', lastPostAt: '2026-10-01T00:00:00.000Z', followers: 1200, posts: 300, bio: 'Celebrant', isPrivate: false });
  });

  it('marks missing and private accounts', () => {
    expect(parseItem({ inputUrl: 'https://www.instagram.com/gone/', error: 'not_found' })?.status).toBe('not_found');
    expect(parseItem({ username: 'shy', followersCount: 10, private: true })?.status).toBe('private');
  });

  it('estimates cost in whole cents', () => {
    expect(estimateCostCents(1000)).toBe(230);
    expect(estimateCostCents(1)).toBe(1);
  });
});

describe('isPrivateAddress (SSRF guard)', () => {
  it('blocks internal ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });
});

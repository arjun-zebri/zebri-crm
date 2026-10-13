import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** A resolver that answers from `lookupMock`, so no test touches DNS. */
const resolve = (host: string) => lookupMock(host) as Promise<{ address: string; family: number }[]>;

const lookupMock = vi.fn();

import { BlockedHostError, DeadDnsError, pinnedGet, resolvePublicTarget } from '@/lib/outreach/checks/safe-fetch';

describe('resolvePublicTarget', () => {
  beforeEach(() => lookupMock.mockReset());

  it('refuses a host with one private answer among public ones', async () => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '169.254.169.254', family: 4 }]);
    await expect(resolvePublicTarget('rebind.example', resolve)).rejects.toBeInstanceOf(BlockedHostError);
  });

  it('pins to the first validated answer when every answer is public', async () => {
    lookupMock.mockResolvedValue([{ address: '8.8.4.4', family: 4 }, { address: '8.8.8.8', family: 4 }]);
    await expect(resolvePublicTarget('ok.example', resolve)).resolves.toEqual({ address: '8.8.4.4', family: 4 });
  });

  it('refuses a private IP literal without a lookup', async () => {
    await expect(resolvePublicTarget('[::ffff:a9fe:a9fe]', resolve)).rejects.toBeInstanceOf(BlockedHostError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('maps NXDOMAIN to dead DNS', async () => {
    const nx = Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
    const missing = () => Promise.reject(nx);
    const thrown = await resolvePublicTarget('gone.example', missing).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(DeadDnsError);
  });

  it('refuses a host whose only answer is an IPv6 private address', async () => {
    lookupMock.mockResolvedValue([{ address: 'fe80::1', family: 6 }]);
    await expect(resolvePublicTarget('v6.example', resolve)).rejects.toBeInstanceOf(BlockedHostError);
  });
});

/**
 * The connection must go to the validated address, whatever the hostname
 * says. `pinned.test` does not resolve, so the request only succeeds if the
 * pinned lookup hands the socket 127.0.0.1.
 */
describe('pinnedGet', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: 'http://169.254.169.254/' });
        res.end();
        return;
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('x'.repeat(5000));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<p>hello</p>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const opts = (maxBytes = 100_000, readBody = () => true) => ({
    signal: new AbortController().signal,
    headers: {},
    maxBytes,
    readBody,
  });

  it('connects to the pinned address even when the hostname does not resolve', async () => {
    const res = await pinnedGet(new URL(`http://pinned.test:${port}/`), { address: '127.0.0.1', family: 4 }, opts());
    expect(res.status).toBe(200);
    expect(res.body).toBe('<p>hello</p>');
  });

  it('returns a redirect location without following it', async () => {
    const res = await pinnedGet(new URL(`http://pinned.test:${port}/redirect`), { address: '127.0.0.1', family: 4 }, opts());
    expect(res.status).toBe(302);
    expect(res.location).toBe('http://169.254.169.254/');
  });

  it('caps the body at maxBytes', async () => {
    const res = await pinnedGet(new URL(`http://pinned.test:${port}/big`), { address: '127.0.0.1', family: 4 }, opts(1000));
    expect(res.body.length).toBe(1000);
  });

  it('does not read a body the caller declines (non-HTML)', async () => {
    const res = await pinnedGet(new URL(`http://pinned.test:${port}/big`), { address: '127.0.0.1', family: 4 }, opts(100_000, () => false));
    expect(res.body).toBe('');
    expect(res.status).toBe(200);
  });
});

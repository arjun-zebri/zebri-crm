/**
 * The network half of the website checker: an HTTP GET that can only
 * connect to an address it has already validated.
 *
 * Why a custom transport: `fetch()` resolves the host again when it
 * connects, so a DNS answer that flips between the check and the connect
 * (DNS rebinding) reaches a private address. Here the address is resolved
 * once, every answer is validated, and the socket is pinned to the one
 * validated address through the request's `lookup` hook. The hostname is
 * still sent as SNI and the Host header, so TLS and virtual hosts behave.
 *
 * Redirects are never followed by the transport. The caller re-validates
 * each hop, so a public site can't bounce the checker to 169.254.169.254.
 *
 * Server-only.
 *
 * @module lib/outreach/checks/safe-fetch
 */
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

import { isPrivateAddress } from './private-address';

/** Thrown for a hop that resolves somewhere we must not connect. */
export class BlockedHostError extends Error {}
/** Thrown when DNS has no answer for the host. */
export class DeadDnsError extends Error {}

/** The one address a request is allowed to connect to. */
export interface PinnedTarget {
  address: string;
  family: 4 | 6;
}

/** What a single GET returned. */
export interface PinnedResponse {
  status: number;
  /** Raw Location header on a redirect, else null. */
  location: string | null;
  contentType: string;
  /** Body text, capped at the requested size. Empty when the caller declined to read it. */
  body: string;
}

/** Looks up every address for a host. Injectable so tests never touch DNS. */
export type AddressResolver = (host: string) => Promise<{ address: string; family: number }[]>;

/** The system resolver, with `verbatim` so IPv6 answers come back as written. */
const systemResolver: AddressResolver = (host) => lookup(host, { all: true, verbatim: true });

/**
 * Resolve a hostname to the single address the connection will use.
 *
 * Every answer is checked, not just the first. A host with one private
 * record among public ones is refused, since the socket could land on it.
 *
 * @throws {BlockedHostError} when the scheme or any answer is not public.
 * @throws {DeadDnsError} when DNS has no record for the host.
 */
export async function resolvePublicTarget(hostname: string, resolve: AddressResolver = systemResolver): Promise<PinnedTarget> {
  const host = hostname.replace(/^\[|\]$/g, '');
  const literal = isIP(host);
  if (literal) {
    if (isPrivateAddress(host)) throw new BlockedHostError('private ip');
    return { address: host, family: literal as 4 | 6 };
  }
  let answers: { address: string; family: number }[];
  try {
    answers = await resolve(host);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL') throw new DeadDnsError(code);
    throw err;
  }
  if (answers.length === 0) throw new DeadDnsError('no records');
  if (answers.some((a) => isPrivateAddress(a.address))) throw new BlockedHostError('private ip');
  const first = answers[0]!;
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

/** Options for {@link pinnedGet}. */
export interface PinnedGetOptions {
  signal: AbortSignal;
  headers: Record<string, string>;
  /** Maximum body bytes to keep; the connection is closed once reached. */
  maxBytes: number;
  /** Called with the Content-Type; return false to skip the body (non-HTML). */
  readBody: (contentType: string) => boolean;
}

/**
 * One GET to an already-validated address. Does not follow redirects.
 *
 * Why the body is destroyed rather than read when `readBody` says no: an
 * unread response holds its socket open until the server gives up, and a
 * large binary download would otherwise be pulled down in full.
 */
export function pinnedGet(url: URL, target: PinnedTarget, opts: PinnedGetOptions): Promise<PinnedResponse> {
  // Why: Node may ask for every address (autoSelectFamily), so answer with the one we validated in both shapes.
  const pinLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address: target.address, family: target.family }], target.family);
    else callback(null, target.address, target.family);
  };
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      { method: 'GET', headers: opts.headers, signal: opts.signal, lookup: pinLookup },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location ?? null;
        const contentType = res.headers['content-type'] ?? '';
        if (status >= 300 && status < 400 && location) {
          res.destroy();
          resolve({ status, location, contentType, body: '' });
          return;
        }
        if (!opts.readBody(contentType)) {
          res.destroy();
          resolve({ status, location: null, contentType, body: '' });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({ status, location: null, contentType, body: Buffer.concat(chunks).toString('utf8') });
        };
        res.on('data', (chunk: Buffer) => {
          const room = opts.maxBytes - total;
          if (room > 0) chunks.push(chunk.subarray(0, room));
          total += chunk.length;
          if (total >= opts.maxBytes) {
            res.destroy();
            finish();
          }
        });
        res.on('end', finish);
        res.on('error', (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

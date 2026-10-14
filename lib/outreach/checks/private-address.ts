/**
 * Which IP addresses the website checker must never connect to.
 *
 * Every URL the checker fetches came from a spreadsheet or a scraped page,
 * so an attacker can point it at anything. This module decides what is off
 * limits: loopback, private, link-local (cloud metadata lives at
 * 169.254.169.254), CGNAT, benchmarking, multicast and reserved space, plus
 * every IPv6 form that tunnels or embeds an IPv4 address.
 *
 * Why IPv6 is parsed rather than string-matched: the WHATWG URL parser
 * rewrites `[::ffff:169.254.169.254]` to the hex form `::ffff:a9fe:a9fe`,
 * so a dotted-quad check never sees it. Parsing the eight groups catches
 * every spelling of the same address.
 *
 * Pure: no DNS, no network.
 *
 * @module lib/outreach/checks/private-address
 */
import { isIP } from 'node:net';

/** Parse dotted-quad IPv4 into four octets, or null when malformed. */
function ipv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return null;
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
}

/** True for IPv4 addresses that are not public unicast. */
export function isPrivateIPv4(ip: string): boolean {
  const o = ipv4Octets(ip);
  if (!o) return true; // Fail closed on anything we can't read.
  const [a, b, c] = o;
  return (
    a === 0 ||                                  // 0.0.0.0/8 "this network"
    a === 10 ||                                 // 10/8 private
    a === 127 ||                                // loopback
    (a === 100 && b >= 64 && b <= 127) ||       // 100.64/10 CGNAT
    (a === 169 && b === 254) ||                 // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||        // 172.16/12 private
    (a === 192 && b === 0 && c === 0) ||        // 192.0.0.0/24 IETF protocol assignments
    (a === 192 && b === 0 && c === 2) ||        // 192.0.2.0/24 documentation
    (a === 192 && b === 168) ||                 // 192.168/16 private
    (a === 198 && (b === 18 || b === 19)) ||    // 198.18/15 benchmarking
    (a === 198 && b === 51 && c === 100) ||     // 198.51.100/24 documentation
    (a === 203 && b === 0 && c === 113) ||      // 203.0.113/24 documentation
    a >= 224                                    // multicast 224/4 and reserved 240/4
  );
}

/**
 * Parse an IPv6 literal into its eight 16-bit groups, or null when malformed.
 * Handles `::` compression, a zone id (`%eth0`, dropped) and an embedded
 * dotted IPv4 tail (`::ffff:1.2.3.4`).
 */
export function ipv6Groups(input: string): number[] | null {
  let s = input.toLowerCase();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);

  let embedded: [number, number] | null = null;
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    const o = ipv4Octets(s.slice(lastColon + 1));
    if (!o) return null;
    embedded = [o[0] * 256 + o[1], o[2] * 256 + o[3]];
    // Stand in two zero groups for the IPv4 tail; they're overwritten below.
    s = `${s.slice(0, lastColon + 1)}0:0`;
  }

  const hex = (g: string): number | null => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : null);
  let groups: number[];
  const dbl = s.indexOf('::');
  if (dbl !== -1) {
    if (s.indexOf('::', dbl + 1) !== -1) return null;
    const left = s.slice(0, dbl) ? s.slice(0, dbl).split(':') : [];
    const right = s.slice(dbl + 2) ? s.slice(dbl + 2).split(':') : [];
    const fill = 8 - left.length - right.length;
    if (fill < 1) return null;
    const parsed = [...left, ...Array<string>(fill).fill('0'), ...right].map(hex);
    if (parsed.some((g) => g === null)) return null;
    groups = parsed as number[];
  } else {
    const parsed = s.split(':').map(hex);
    if (parsed.length !== 8 || parsed.some((g) => g === null)) return null;
    groups = parsed as number[];
  }
  if (embedded) {
    groups[6] = embedded[0];
    groups[7] = embedded[1];
  }
  return groups;
}

/** True when the leading groups of `g` equal `values`. */
function prefixIs(g: number[], values: number[]): boolean {
  return values.every((v, i) => g[i] === v);
}

/** True for IPv6 addresses that are not public unicast, including every tunnelling form. */
export function isPrivateIPv6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g) return true; // Fail closed.
  const g0 = g[0] ?? 0;
  // ::/96 covers `::`, `::1` and the deprecated IPv4-compatible `::a.b.c.d`.
  if (prefixIs(g, [0, 0, 0, 0, 0, 0])) return true;
  // ::ffff:0:0/96 IPv4-mapped: judge the embedded IPv4 address.
  if (prefixIs(g, [0, 0, 0, 0, 0, 0xffff])) return isPrivateIPv4(embeddedV4(g));
  // 64:ff9b::/96 NAT64 and 64:ff9b:1::/48 local NAT64: the gateway can reach any IPv4 host.
  if (prefixIs(g, [0x64, 0xff9b]) || prefixIs(g, [0x64, 0xff9b, 1])) return true;
  // 100::/64 discard-only.
  if (prefixIs(g, [0x100, 0, 0, 0])) return true;
  // 2001::/32 Teredo: the address hides a server and an obfuscated client IPv4.
  if (prefixIs(g, [0x2001, 0])) return true;
  // 2001:db8::/32 documentation.
  if (prefixIs(g, [0x2001, 0xdb8])) return true;
  // 2002::/16 6to4: relays to an arbitrary IPv4 host; refused outright.
  if (g0 === 0x2002) return true;
  // fc00::/7 unique local, fe80::/10 link-local, fec0::/10 site-local (deprecated).
  if ((g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0) return true;
  // ff00::/8 multicast.
  if ((g0 & 0xff00) === 0xff00) return true;
  // Anything outside 2000::/3 is not global unicast.
  return (g0 & 0xe000) !== 0x2000;
}

/** The IPv4 address packed into the last two groups, as dotted text. */
function embeddedV4(g: number[]): string {
  const hi = g[6] ?? 0;
  const lo = g[7] ?? 0;
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/**
 * True for any IP address that must not be fetched: a literal IPv4 or IPv6
 * in a private, loopback, link-local, tunnelling or reserved range.
 * Unparseable input is treated as private.
 */
export function isPrivateAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  const kind = isIP(bare);
  if (kind === 4) return isPrivateIPv4(bare);
  if (kind === 6) return isPrivateIPv6(bare);
  return true;
}

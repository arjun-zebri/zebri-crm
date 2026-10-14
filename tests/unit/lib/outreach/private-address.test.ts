import { describe, expect, it } from 'vitest';

import { isPrivateAddress, ipv6Groups } from '@/lib/outreach/checks/private-address';

/**
 * Every spelling of an internal address the website checker must refuse.
 * Each row is a bypass that the old string-prefix check let through.
 */
describe('isPrivateAddress: IPv4 ranges', () => {
  it.each([
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '100.127.255.255', '169.254.169.254',
    '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1', '198.18.0.1',
    '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '240.0.0.1', '255.255.255.255',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '198.20.0.1', '203.0.114.1'])('allows public %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('isPrivateAddress: IPv6 bypasses', () => {
  it('blocks the IPv4-mapped metadata address in hex form (what the URL parser produces)', () => {
    // new URL('http://[::ffff:169.254.169.254]/').hostname === '::ffff:a9fe:a9fe'
    expect(isPrivateAddress('::ffff:a9fe:a9fe')).toBe(true);
  });

  it('blocks IPv4-mapped loopback and 10/8 in hex and dotted forms', () => {
    expect(isPrivateAddress('::ffff:7f00:1')).toBe(true);
    expect(isPrivateAddress('::ffff:0a00:1')).toBe(true);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows an IPv4-mapped public address', () => {
    expect(isPrivateAddress('::ffff:0808:0808')).toBe(false);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks the NAT64 well-known prefix and local-use NAT64, whatever they embed', () => {
    expect(isPrivateAddress('64:ff9b::a9fe:a9fe')).toBe(true);
    expect(isPrivateAddress('64:ff9b::808:808')).toBe(true);
    expect(isPrivateAddress('64:ff9b:1::1')).toBe(true);
  });

  it('blocks the deprecated IPv4-compatible ::/96 range', () => {
    expect(isPrivateAddress('::a9fe:a9fe')).toBe(true);
    expect(isPrivateAddress('::7f00:1')).toBe(true);
    expect(isPrivateAddress('::')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
  });

  it('blocks the discard prefix 100::/64', () => {
    expect(isPrivateAddress('100::1')).toBe(true);
    expect(isPrivateAddress('100::ffff:ffff:ffff:ffff')).toBe(true);
  });

  it('blocks 6to4, Teredo and documentation space', () => {
    expect(isPrivateAddress('2002:a9fe:a9fe::1')).toBe(true);
    expect(isPrivateAddress('2001:0:4136:e378:8000:63bf:3fff:fdd2')).toBe(true);
    expect(isPrivateAddress('2001:db8::1')).toBe(true);
  });

  it('blocks unique-local, link-local, site-local and multicast', () => {
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fd12:3456::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fec0::1')).toBe(true);
    expect(isPrivateAddress('ff02::1')).toBe(true);
  });

  it('allows a public global unicast address', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
  });

  it('fails closed on input it cannot parse, and accepts bracketed literals', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('[::ffff:a9fe:a9fe]')).toBe(true);
    expect(isPrivateAddress('[2606:4700:4700::1111]')).toBe(false);
  });

  it('parses the embedded IPv4 tail into the last two groups', () => {
    expect(ipv6Groups('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
    expect(ipv6Groups('1:2:3:4:5:6:7:8')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ipv6Groups('1::')).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(ipv6Groups('1::2::3')).toBeNull();
  });
});

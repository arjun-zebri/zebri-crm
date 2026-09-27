/**
 * The dependency audit ratchet gate (`scripts/npm-audit-gate.mjs`).
 *
 * The gate's whole job is a judgment call: is this specific advisory,
 * on this specific package, covered by a specific, still-valid, dated
 * exception. Get that wrong in either direction and the gate stops
 * doing its job: too strict and a dev-only or already-excepted advisory
 * blocks every PR until someone quietly disables the gate; too loose
 * and a real, unaddressed high/critical in a production dependency
 * ships silently. So the decision logic is exercised directly here,
 * against fixture `npm audit --json` shapes, rather than shelling out
 * to npm (slow, network-dependent, and not what this gate is actually
 * responsible for getting right).
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateAudit,
  extractHighSeverityFindings,
  isAllowlisted,
  isEntryExpired,
  isEntryTooFarOut,
  isEntryValid,
  MAX_ALLOWLIST_DAYS,
  parseAuditOutput,
} from '../../../scripts/npm-audit-gate.mjs';

/** Builds a minimal `npm audit --json` vulnerabilities map for one package. */
function auditJsonFor(pkg: string, severity: string, ghsa: string, source = 111) {
  return {
    vulnerabilities: {
      [pkg]: {
        name: pkg,
        severity,
        isDirect: false,
        via: [{ source, name: pkg, url: `https://github.com/advisories/${ghsa}`, severity }],
        range: '<=1.0.0',
      },
    },
  };
}

/**
 * Builds a vulnerabilities map for one package with an explicit `via`
 * array, so a fixture can carry more than one advisory the way a real
 * `npm audit --json` entry can (one entry per *package*, not per
 * advisory).
 */
function auditJsonWithVia(pkg: string, severity: string, via: unknown[]) {
  return {
    vulnerabilities: {
      [pkg]: { name: pkg, severity, isDirect: false, via, range: '<=1.0.0' },
    },
  };
}

describe('extractHighSeverityFindings', () => {
  it('keeps high and critical entries and drops the rest', () => {
    const auditJson = {
      vulnerabilities: {
        low: { severity: 'low', via: [] },
        moderate: { severity: 'moderate', via: [] },
        high: { severity: 'high', via: [] },
        critical: { severity: 'critical', via: [] },
      },
    };
    const findings = extractHighSeverityFindings(auditJson);
    expect(findings.map((f) => f.package).sort()).toEqual(['critical', 'high']);
  });

  it('reads via entries as advisory sources, ignoring dependency-chain strings', () => {
    const auditJson = {
      vulnerabilities: {
        next: {
          severity: 'critical',
          isDirect: true,
          via: [
            { source: 42, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'critical' },
            'postcss',
          ],
        },
      },
    };
    const findings = extractHighSeverityFindings(auditJson);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.package).toBe('next');
    expect(findings[0]?.via).toHaveLength(2);
  });

  it('returns an empty list for an audit with no vulnerabilities map', () => {
    expect(extractHighSeverityFindings({})).toEqual([]);
  });
});

describe('isEntryExpired / isEntryTooFarOut / isEntryValid', () => {
  const now = new Date('2026-09-25T00:00:00Z');

  it('is not expired the day it expires or after', () => {
    expect(isEntryExpired({ expires: '2026-09-25' }, now)).toBe(false);
    expect(isEntryExpired({ expires: '2026-09-26' }, now)).toBe(false);
  });

  it('is expired the day after its expiry date', () => {
    expect(isEntryExpired({ expires: '2026-09-24' }, now)).toBe(true);
  });

  it('stays valid through the end of its expiry date (UTC), not just the start of it', () => {
    // "expires": "2026-09-25" must cover all of that day, not lapse at
    // its first instant.
    expect(isEntryExpired({ expires: '2026-09-25' }, new Date('2026-09-25T23:59:00Z'))).toBe(false);
    expect(isEntryExpired({ expires: '2026-09-25' }, new Date('2026-09-26T00:00:00Z'))).toBe(true);
  });

  it('accepts a date within the 90-day window', () => {
    expect(isEntryTooFarOut({ expires: '2026-12-20' }, now)).toBe(false);
  });

  it('rejects a date past the 90-day window', () => {
    expect(isEntryTooFarOut({ expires: '2027-06-01' }, now)).toBe(true);
  });

  it('MAX_ALLOWLIST_DAYS is 90', () => {
    expect(MAX_ALLOWLIST_DAYS).toBe(90);
  });

  it('isEntryValid is false for either an expired or a too-far-out entry', () => {
    expect(isEntryValid({ expires: '2026-09-24' }, now)).toBe(false);
    expect(isEntryValid({ expires: '2027-06-01' }, now)).toBe(false);
    expect(isEntryValid({ expires: '2026-10-01' }, now)).toBe(true);
  });
});

describe('isAllowlisted', () => {
  const now = new Date('2026-09-25T00:00:00Z');

  it('matches on package and advisory id (case-insensitive)', () => {
    const finding = extractHighSeverityFindings(auditJsonFor('@tiptap/core', 'high', 'GHSA-j95f-988m-3j2f'))[0];
    const allowlist = [
      { id: 'ghsa-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(true);
  });

  it('does not match a different package with the same advisory id', () => {
    const finding = extractHighSeverityFindings(auditJsonFor('left-pad', 'high', 'GHSA-j95f-988m-3j2f'))[0];
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(false);
  });

  it('does not match the same package with a different advisory id', () => {
    // A new advisory landing on an already-allowlisted package must not
    // be silently covered by the old entry.
    const finding = extractHighSeverityFindings(auditJsonFor('@tiptap/core', 'high', 'GHSA-new-advisory-123'))[0];
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(false);
  });

  it('does not match an expired entry', () => {
    const finding = extractHighSeverityFindings(auditJsonFor('@tiptap/core', 'high', 'GHSA-j95f-988m-3j2f'))[0];
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2026-01-01' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(false);
  });

  it('does not match an entry dated more than 90 days out', () => {
    const finding = extractHighSeverityFindings(auditJsonFor('@tiptap/core', 'high', 'GHSA-j95f-988m-3j2f'))[0];
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2027-06-01' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(false);
  });

  it('matches the numeric npm advisory source id as well as GHSA', () => {
    const finding = extractHighSeverityFindings(auditJsonFor('sanitize-html', 'critical', 'GHSA-x', 987654))[0];
    const allowlist = [{ id: '987654', package: 'sanitize-html', reason: 'x', expires: '2026-12-20' }];
    expect(isAllowlisted(finding, allowlist, now)).toBe(true);
  });

  // npm audit reports one entry per package, not per advisory: a
  // package's `via` array can bundle more than one distinct
  // high/critical advisory (this is exactly today's real shape for
  // @tiptap/core, which bundles a moderate advisory alongside a high
  // one). Allowlisting one must never silently waive another.
  const twoHighAdvisories = [
    { source: 1, url: 'https://github.com/advisories/GHSA-aaaa-0001-0001', severity: 'high' },
    { source: 2, url: 'https://github.com/advisories/GHSA-bbbb-0002-0002', severity: 'high' },
  ];

  it('blocks a finding with two bundled high advisories when only one is allowlisted', () => {
    const finding = extractHighSeverityFindings(
      auditJsonWithVia('@tiptap/core', 'high', twoHighAdvisories),
    )[0];
    const allowlist = [
      { id: 'GHSA-aaaa-0001-0001', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(false);
  });

  it('allows a finding with two bundled high advisories once both are allowlisted', () => {
    const finding = extractHighSeverityFindings(
      auditJsonWithVia('@tiptap/core', 'high', twoHighAdvisories),
    )[0];
    const allowlist = [
      { id: 'GHSA-aaaa-0001-0001', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
      { id: 'GHSA-bbbb-0002-0002', package: '@tiptap/core', reason: 'y', expires: '2026-12-20' },
    ];
    expect(isAllowlisted(finding, allowlist, now)).toBe(true);
  });

  it('ignores a moderate sibling bundled alongside a high advisory: covering the high is enough', () => {
    const via = [
      { source: 1, url: 'https://github.com/advisories/GHSA-aaaa-0001-0001', severity: 'high' },
      { source: 9, url: 'https://github.com/advisories/GHSA-mod-0009-0009', severity: 'moderate' },
    ];
    const finding = extractHighSeverityFindings(auditJsonWithVia('@tiptap/core', 'high', via))[0];
    const allowlist = [
      { id: 'GHSA-aaaa-0001-0001', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    // No entry names the moderate GHSA-mod-0009-0009 at all, and the
    // finding is still fully allowlisted: the moderate sibling was
    // never required to have its own entry.
    expect(isAllowlisted(finding, allowlist, now)).toBe(true);
  });
});

describe('evaluateAudit', () => {
  const now = new Date('2026-09-25T00:00:00Z');

  it('passes with no high/critical findings and no allowlist', () => {
    const result = evaluateAudit({ vulnerabilities: { x: { severity: 'moderate', via: [] } } }, [], now);
    expect(result.ok).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('fails on an unallowlisted high finding', () => {
    const auditJson = auditJsonFor('left-pad', 'high', 'GHSA-abcd-1234-efgh');
    const result = evaluateAudit(auditJson, [], now);
    expect(result.ok).toBe(false);
    expect(result.blocked.map((f) => f.package)).toEqual(['left-pad']);
    expect(result.allowed).toHaveLength(0);
  });

  it('passes when the only finding is allowlisted', () => {
    const auditJson = auditJsonFor('@tiptap/core', 'high', 'GHSA-j95f-988m-3j2f');
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'coordinated upgrade needed', expires: '2026-12-20' },
    ];
    const result = evaluateAudit(auditJson, allowlist, now);
    expect(result.ok).toBe(true);
    expect(result.allowed.map((f) => f.package)).toEqual(['@tiptap/core']);
    expect(result.blocked).toHaveLength(0);
  });

  it('fails when an allowlist entry has expired, even with no findings left for it to cover', () => {
    // An expired entry is a signal the advisory needs another look, not
    // something to just fall out of the report quietly.
    const result = evaluateAudit({ vulnerabilities: {} }, [
      { id: 'GHSA-old', package: 'left-pad', reason: 'x', expires: '2026-01-01' },
    ], now);
    expect(result.ok).toBe(false);
    expect(result.invalidEntries).toHaveLength(1);
  });

  it('fails when an allowlist entry is dated more than 90 days out, even if it would otherwise cover the finding', () => {
    const auditJson = auditJsonFor('left-pad', 'high', 'GHSA-abcd-1234-efgh');
    const allowlist = [{ id: 'GHSA-abcd-1234-efgh', package: 'left-pad', reason: 'x', expires: '2027-06-01' }];
    const result = evaluateAudit(auditJson, allowlist, now);
    expect(result.ok).toBe(false);
    expect(result.invalidEntries).toHaveLength(1);
    expect(result.blocked.map((f) => f.package)).toEqual(['left-pad']);
  });

  it('fails when two findings exist and only one is allowlisted', () => {
    const auditJson = {
      vulnerabilities: {
        ...auditJsonFor('@tiptap/core', 'high', 'GHSA-j95f-988m-3j2f').vulnerabilities,
        ...auditJsonFor('left-pad', 'critical', 'GHSA-zzzz-9999-yyyy').vulnerabilities,
      },
    };
    const allowlist = [
      { id: 'GHSA-j95f-988m-3j2f', package: '@tiptap/core', reason: 'x', expires: '2026-12-20' },
    ];
    const result = evaluateAudit(auditJson, allowlist, now);
    expect(result.ok).toBe(false);
    expect(result.allowed.map((f) => f.package)).toEqual(['@tiptap/core']);
    expect(result.blocked.map((f) => f.package)).toEqual(['left-pad']);
  });
});

// Phase 4 review, M3: npm exits non-zero on an audit failure too, with
// `{"error": ...}` on stdout. That document has no findings, so without
// this check the gate printed OK having audited nothing.
describe('parseAuditOutput', () => {
  it('accepts a real audit report', () => {
    const raw = JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: {} } });
    expect(parseAuditOutput(raw)).toMatchObject({ ok: true });
  });

  it('fails when npm audit reports an error document', () => {
    const raw = JSON.stringify({ error: { code: 'ENOAUDIT', summary: 'audit endpoint returned an error' } });
    expect(parseAuditOutput(raw)).toEqual({ ok: false, reason: 'npm audit reported an error (ENOAUDIT)' });
  });

  it('fails on output that is not JSON', () => {
    expect(parseAuditOutput('npm ERR! network')).toMatchObject({ ok: false });
  });

  it('fails when the report is missing its vulnerabilities or metadata section', () => {
    expect(parseAuditOutput(JSON.stringify({ metadata: {} }))).toMatchObject({ ok: false });
    expect(parseAuditOutput(JSON.stringify({ vulnerabilities: {} }))).toMatchObject({ ok: false });
    expect(parseAuditOutput('null')).toMatchObject({ ok: false });
    expect(parseAuditOutput('[]')).toMatchObject({ ok: false });
  });

  it('exits the gate non-zero on an npm audit error (end to end, npm stubbed)', () => {
    const script = join(process.cwd(), 'scripts', 'npm-audit-gate.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'audit-gate-'));
    // A fake `npm` on PATH that prints an error document and exits 1,
    // exactly what npm does when the registry audit endpoint fails.
    const fake = join(dir, 'npm');
    writeFileSync(fake, '#!/bin/sh\necho \'{"error":{"code":"ENOAUDIT","summary":"down"}}\'\nexit 1\n');
    chmodSync(fake, 0o755);
    const run = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}` },
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/npm audit reported an error/);
    expect(run.stdout).not.toMatch(/Dependency audit gate: OK/);
  });
});

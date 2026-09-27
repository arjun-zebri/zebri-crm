#!/usr/bin/env node
/**
 * Dependency audit ratchet gate (Phase 4B, Task 26).
 *
 * Runs `npm audit --omit=dev --json` (production dependencies only:
 * dev tooling like vitest/vite/knip is never shipped, and gating on it
 * would fail CI on day one over advisories nobody can act on without a
 * major-version bump) and fails when a **high or critical** advisory is
 * present that is not on the dated allowlist in
 * `scripts/npm-audit-allowlist.json`.
 *
 * Same ratchet shape as `scripts/lint-gate.mjs` and
 * `scripts/typecheck-strict-gate.mjs`, but the "budget" here is a set of
 * named, dated exceptions rather than a count: an advisory can only be
 * ignored by naming it, saying why, and putting an expiry on it. An
 * expired entry fails the gate, so an unresolved advisory keeps coming
 * back for another look rather than silently living forever in a JSON
 * file. An entry also fails if it is dated more than
 * `MAX_ALLOWLIST_DAYS` out, so nobody can dodge the review by writing a
 * far-future date once.
 *
 * The decision logic (`extractHighSeverityFindings`, `isEntryValid`,
 * `isAllowlisted`, `evaluateAudit`) is exported as pure functions so
 * `tests/unit/scripts/npm-audit-gate.test.ts` can test parsing and
 * allowlist/expiry behaviour directly, against fixture JSON, without
 * shelling out to npm or touching the network.
 *
 * Usage: `npm run audit:gate` (wired into CI's fast-gates group, after
 * "Install dependencies").
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALLOWLIST_PATH = join(__dirname, 'npm-audit-allowlist.json');

/** An allowlist can only be dated up to 90 days out before the gate rejects it. */
export const MAX_ALLOWLIST_DAYS = 90;

/**
 * @typedef {object} AuditFinding
 * One vulnerable production package at high or critical severity, as
 * reported by `npm audit --json`'s `vulnerabilities` map.
 * @property {string} package
 * @property {'high'|'critical'} severity
 * @property {unknown[]} via
 * @property {string} [range]
 * @property {boolean} [isDirect]
 */

/**
 * @typedef {object} AllowlistEntry
 * One dated allowlist exception. `id` is a GHSA id (e.g.
 * `GHSA-j95f-988m-3j2f`) or the npm advisory's numeric `source` id,
 * matched against one specific advisory a finding carries. A package
 * can bundle more than one high/critical advisory in one `npm audit`
 * entry (npm reports one entry per package, not per advisory), so
 * covering one advisory never waives another on the same package: each
 * needs its own valid entry.
 * @property {string} id
 * @property {string} package
 * @property {string} reason
 * @property {string} expires
 */

/**
 * Pulls the high/critical entries out of a parsed `npm audit --json`
 * document. Anything `low`/`moderate`/`info` is out of scope for this
 * gate by design (see roadmap ruling T26): those burn down like any
 * other lint/strict debt, on the page-hardening ratchet, not here.
 */
export function extractHighSeverityFindings(auditJson) {
  const vulnerabilities = auditJson?.vulnerabilities ?? {};
  const findings = [];
  for (const [pkg, v] of Object.entries(vulnerabilities)) {
    if (v?.severity === 'high' || v?.severity === 'critical') {
      findings.push({
        package: pkg,
        severity: v.severity,
        via: Array.isArray(v.via) ? v.via : [],
        range: v.range,
        isDirect: v.isDirect,
      });
    }
  }
  return findings;
}

/**
 * Groups a finding's advisories that are themselves high or critical,
 * each as the set of identifiers (GHSA id and/or npm's numeric
 * `source` id) that refer to that one advisory. `npm audit --json`
 * reports one entry per *package*, not per advisory: a package's `via`
 * array can hold several distinct advisories, and the package's own
 * top-level `severity` is just the max across them. This is not
 * hypothetical: today's real `@tiptap/core` finding bundles a moderate
 * `mergeAttributes` advisory alongside a high ReDoS one in the same
 * `via` array. A lower-severity sibling bundled alongside a
 * high/critical one is dropped here (it never needed its own gate
 * entry to begin with), but every advisory that IS high/critical is
 * kept as its own group, so each one needs its own allowlist coverage.
 * Dependency-chain `via` entries (plain strings, e.g. a package name,
 * with no advisory of their own) are skipped.
 */
function highSeverityAdvisories(finding) {
  const advisories = [];
  for (const via of finding.via ?? []) {
    if (typeof via === 'string' || via == null) continue;
    if (via.severity !== 'high' && via.severity !== 'critical') continue;
    const ids = new Set();
    if (via.source != null) ids.add(String(via.source).toLowerCase());
    if (typeof via.url === 'string') {
      const match = via.url.match(/GHSA-[A-Za-z0-9-]+/);
      if (match) ids.add(match[0].toLowerCase());
    }
    if (ids.size > 0) advisories.push(ids);
  }
  return advisories;
}

/**
 * The instant `entry.expires` (a `YYYY-MM-DD` date) actually lapses:
 * the end of that day, UTC. An entry dated `"2026-12-20"` stays valid
 * through all of 2026-12-20 and lapses at the start of 2026-12-21, not
 * at the first instant of the 20th.
 */
function expiryInstant(entry) {
  return new Date(`${entry.expires}T23:59:59Z`).getTime();
}

/** True when `entry.expires` has passed (the entry is valid through the end of that day, UTC). */
export function isEntryExpired(entry, now = new Date()) {
  return expiryInstant(entry) < now.getTime();
}

/** True when `entry.expires` is dated more than `maxDays` past `now`. */
export function isEntryTooFarOut(entry, now = new Date(), maxDays = MAX_ALLOWLIST_DAYS) {
  const maxMs = maxDays * 24 * 60 * 60 * 1000;
  return expiryInstant(entry) - now.getTime() > maxMs;
}

/** An entry is usable by the gate only if it is neither expired nor dated too far out. */
export function isEntryValid(entry, now = new Date()) {
  return !isEntryExpired(entry, now) && !isEntryTooFarOut(entry, now);
}

/**
 * Whether EVERY high/critical advisory `finding` carries is covered by
 * its own valid allowlist entry (same package, a shared id, entry not
 * expired or dated too far out). A finding can bundle more than one
 * high/critical advisory in a single `via` array (npm's one-entry-per-
 * package shape): allowlisting one must never silently waive the
 * other, so this requires a match for each one, not just any single id
 * found anywhere in the finding. A finding with no explicit
 * high/critical advisory object in `via` (a malformed or unexpected
 * shape) fails closed rather than passing by default.
 */
export function isAllowlisted(finding, allowlist, now = new Date()) {
  const advisories = highSeverityAdvisories(finding);
  if (advisories.length === 0) return false;
  return advisories.every((ids) =>
    allowlist.some(
      (entry) =>
        entry.package === finding.package &&
        isEntryValid(entry, now) &&
        ids.has(String(entry.id).toLowerCase()),
    ),
  );
}

/**
 * Runs the gate's full decision over a parsed audit document and
 * allowlist: which findings are allowed, which block the build, and
 * which allowlist entries are no longer usable (expired or dated too
 * far out; both make the gate fail, so a stale entry gets noticed
 * instead of quietly protecting nothing or everything).
 */
export function evaluateAudit(auditJson, allowlist, now = new Date()) {
  const findings = extractHighSeverityFindings(auditJson);
  const invalidEntries = allowlist.filter((entry) => !isEntryValid(entry, now));
  const allowed = findings.filter((finding) => isAllowlisted(finding, allowlist, now));
  const blocked = findings.filter((finding) => !isAllowlisted(finding, allowlist, now));
  return {
    findings,
    allowed,
    blocked,
    invalidEntries,
    ok: blocked.length === 0 && invalidEntries.length === 0,
  };
}

/**
 * Parses `npm audit --json` output and refuses anything that is not a
 * real audit report (Phase 4 review, M3). npm exits non-zero both when it
 * finds vulnerabilities and when the audit itself fails (registry down,
 * lockfile problem); in the second case stdout holds `{"error": {...}}`,
 * which has no `vulnerabilities` map and would otherwise read as "no
 * findings" and pass the gate without auditing anything. So the gate
 * fails closed unless the document parses and carries both
 * `vulnerabilities` and `metadata`.
 *
 * @param {string} raw - stdout of `npm audit --omit=dev --json`.
 * @returns {{ ok: true, auditJson: object } | { ok: false, reason: string }}
 */
export function parseAuditOutput(raw) {
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'npm audit output is not JSON' };
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, reason: 'npm audit output is not a JSON object' };
  }
  if (doc.error) {
    const code = typeof doc.error === 'object' && doc.error?.code ? ` (${doc.error.code})` : '';
    return { ok: false, reason: `npm audit reported an error${code}` };
  }
  if (!doc.vulnerabilities || typeof doc.vulnerabilities !== 'object' || !doc.metadata) {
    return { ok: false, reason: 'npm audit output has no vulnerabilities or metadata section' };
  }
  return { ok: true, auditJson: doc };
}

function loadAllowlist() {
  let raw;
  try {
    raw = readFileSync(ALLOWLIST_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  return JSON.parse(raw);
}

function runNpmAuditJson() {
  try {
    return execSync('npm audit --omit=dev --json', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    // npm audit exits non-zero the moment any vulnerability exists;
    // the JSON report is still on stdout.
    if (err && err.stdout) return err.stdout;
    throw err;
  }
}

/** Describes every allowlist entry that covers one of `finding`'s high/critical advisories. */
function describeEntries(finding, allowlist, now) {
  const descriptions = [];
  for (const ids of highSeverityAdvisories(finding)) {
    const entry = allowlist.find(
      (e) => e.package === finding.package && isEntryValid(e, now) && ids.has(String(e.id).toLowerCase()),
    );
    if (entry) descriptions.push(`${entry.id}: ${entry.reason} (expires ${entry.expires})`);
  }
  return descriptions.join(' | ');
}

function main() {
  const now = new Date();
  const parsed = parseAuditOutput(runNpmAuditJson());
  if (!parsed.ok) {
    console.error(`Dependency audit gate failed: ${parsed.reason}. Nothing was audited; rerun once npm audit works.`);
    process.exit(1);
  }
  const auditJson = parsed.auditJson;
  const allowlist = loadAllowlist();
  const result = evaluateAudit(auditJson, allowlist, now);

  console.log('npm audit gate: production dependencies, high + critical');
  console.log(
    `  ${result.findings.length} finding(s): ${result.allowed.length} allowlisted, ` +
      `${result.blocked.length} blocking`,
  );

  if (result.allowed.length > 0) {
    console.log('\n  Allowlisted:');
    for (const finding of result.allowed) {
      console.log(`    - ${finding.package} (${finding.severity}): ${describeEntries(finding, allowlist, now)}`);
    }
  }

  if (result.invalidEntries.length > 0) {
    console.log('\n  Invalid allowlist entries (expired, or dated more than 90 days out):');
    for (const entry of result.invalidEntries) {
      console.log(`    - ${entry.package} ${entry.id} (expires ${entry.expires})`);
    }
  }

  if (result.blocked.length > 0) {
    console.log('\n  BLOCKING (high/critical, not on the allowlist):');
    for (const finding of result.blocked) {
      console.log(`    - ${finding.package} (${finding.severity})`);
    }
  }

  if (!result.ok) {
    console.error(
      '\nDependency audit gate failed. Fix the vulnerable production dependency ' +
        '(npm audit fix, never --force), or add a dated entry to ' +
        'scripts/npm-audit-allowlist.json with an advisory id, the package, a ' +
        'reason, and an expires date no more than 90 days out.',
    );
    process.exit(1);
  }

  console.log('\nDependency audit gate: OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

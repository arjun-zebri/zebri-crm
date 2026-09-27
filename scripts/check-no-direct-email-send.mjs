#!/usr/bin/env node
/**
 * Direct-provider-send guard.
 *
 * Every outgoing email must go through `lib/email/dispatch.ts`. This
 * script fails CI when any other file reaches an email provider on its
 * own: importing the Resend SDK, calling `emails.send`, or POSTing to
 * the Gmail or Microsoft Graph send endpoints.
 *
 * Why a build gate rather than a convention. The workflows executor
 * retries a failed step up to three times, so a send has to carry an
 * idempotency key, report its result, and say whether a retry is safe.
 * An action that talks to a provider directly has reliably missed at
 * least one of the three. It happened in the main send path, then in six
 * post-event actions, then in three more, each found by a separate
 * review after the previous round was called done. Each of those bugs
 * could put two extra copies of the same email in a couple's inbox. The
 * pattern is not a mistake anyone was making carelessly; it is what
 * writing a new email action looks like if nothing stops you.
 *
 * Deliberately narrow on the Graph and Gmail hosts: `/me/sendMail` and
 * `/messages/send` are mail, while `/me/events` and `/me/calendar` are
 * the calendar integration and have nothing to do with this.
 *
 * Usage: `npm run check:no-direct-email-send` (wired into the CI
 * pipeline next to the service-role guard).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';

const ROOTS = ['app', 'components', 'features', 'lib'];
const EXTS = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js']);

/**
 * The one module allowed to speak to a provider. Everything else calls
 * into it.
 */
const TRANSPORT = join('lib', 'email', 'dispatch.ts');

/**
 * What a direct send looks like, and what to say when one is found.
 *
 * Each entry names the thing to use instead, because whoever trips this
 * is adding an email action and has no reason to know any of the
 * history above.
 */
const BANNED = [
  {
    // Matches `import { Resend } from 'resend'` and the dynamic form.
    pattern: /from\s+['"]resend['"]|require\(\s*['"]resend['"]\s*\)/,
    what: 'imports the Resend SDK',
  },
  {
    pattern: /\.emails\s*\.\s*send\s*\(/,
    what: 'calls the Resend SDK directly',
  },
  {
    pattern: /gmail\.googleapis\.com\/gmail\/v1\/users\/[^'"`\s]*\/messages\/send/,
    what: 'POSTs to the Gmail send endpoint',
  },
  {
    pattern: /graph\.microsoft\.com\/[^'"`\s]*\/sendMail/,
    what: 'POSTs to the Microsoft Graph sendMail endpoint',
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const offenders = [];

for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const f of files) {
    // Normalised so the allowlist compares the same on every platform.
    if (f.split(sep).join('/') === TRANSPORT.split(sep).join('/')) continue;
    const src = readFileSync(f, 'utf8');
    const lines = src.split('\n');
    for (const rule of BANNED) {
      for (let i = 0; i < lines.length; i += 1) {
        if (rule.pattern.test(lines[i])) {
          offenders.push({ file: f, line: i + 1, what: rule.what });
        }
      }
    }
  }
}

if (offenders.length === 0) {
  console.log('direct-email-send guard: OK (every send goes through lib/email/dispatch.ts)');
  process.exit(0);
}

console.error('direct-email-send guard: FAIL');
console.error('');
console.error('These files send email without going through lib/email/dispatch.ts:');
console.error('');
for (const o of offenders) console.error(`  ${o.file}:${o.line}  (${o.what})`);
console.error('');
console.error('Use one of these instead:');
console.error('');
console.error("  sendAutomationEmail()  from '@/lib/email/automation-send'");
console.error('      An automation action mailing a couple or a vendor from the shared');
console.error('      Zebri address. Give it the step id and a fingerprint of the');
console.error('      configured copy; it handles the key, the result and the retry verdict.');
console.error('');
console.error("  dispatchEmail()        from '@/lib/email/dispatch'");
console.error("      Anything that has resolved its own sender, such as an MC's connected");
console.error('      Gmail or Microsoft mailbox. Pass `idempotencyKey` built with');
console.error("      sendIdempotencyKey() from '@/lib/email/idempotency', and ask");
console.error('      transportDeduplicates(sender) before treating a retry as safe.');
console.error('');
console.error('Why this is a build failure and not a style note: the workflows executor');
console.error('retries a failed step up to three times. A send that carries no idempotency');
console.error('key, or that reports success on a rejection, turns one failed send into');
console.error('three copies in a real couple’s inbox. See .claude/docs/workflows.md,');
console.error('"When a step fails".');
process.exit(1);

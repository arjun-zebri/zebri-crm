/**
 * The direct-provider-send guard (`scripts/check-no-direct-email-send.mjs`).
 *
 * The script is the round-3 deliverable: three separate reviews each
 * found more actions reaching a provider on their own, so the gate is
 * what stops a fourth. A gate nobody tests is a gate that quietly stops
 * matching the thing it was written for, which is the same failure one
 * level up, so its two properties are pinned here:
 *
 * - it fails on each banned shape, and
 * - it does **not** fail on the calendar integration, which talks to
 *   the same Microsoft host about events rather than mail. A guard that
 *   cries wolf on `/me/events` gets an allowlist entry within a week and
 *   then it guards nothing.
 *
 * Run against a throwaway tree rather than the repo, so it tests the
 * rules rather than today's source.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(process.cwd(), 'scripts/check-no-direct-email-send.mjs');

let workdir: string | null = null;

/** Write one file into a throwaway tree and run the guard over it. */
function runGuard(files: Record<string, string>): { code: number; output: string } {
  workdir = mkdtempSync(join(tmpdir(), 'zebri-gate-'));
  for (const [path, contents] of Object.entries(files)) {
    const full = join(workdir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents, 'utf8');
  }
  try {
    const output = execFileSync('node', [SCRIPT], {
      cwd: workdir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

afterEach(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true });
  workdir = null;
});

describe('direct-email-send guard', () => {
  it('fails on the Resend SDK import', () => {
    const { code, output } = runGuard({
      'lib/automations/actions/new-thing.ts': "import { Resend } from 'resend'\n",
    });
    expect(code).toBe(1);
    expect(output).toContain('lib/automations/actions/new-thing.ts:1');
    expect(output).toContain('imports the Resend SDK');
  });

  it('fails on a direct emails.send call', () => {
    const { code, output } = runGuard({
      'lib/thing.ts': 'export const go = async (c) => {\n  await c.emails.send({ to: "a" })\n}\n',
    });
    expect(code).toBe(1);
    expect(output).toContain('lib/thing.ts:2');
  });

  it('fails on the Gmail and Graph send endpoints', () => {
    const { code, output } = runGuard({
      'app/api/x/route.ts': [
        "await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send')",
        "await fetch('https://graph.microsoft.com/v1.0/me/sendMail')",
        '',
      ].join('\n'),
    });
    expect(code).toBe(1);
    expect(output).toContain('Gmail send endpoint');
    expect(output).toContain('Graph sendMail endpoint');
  });

  it('names what to use instead, for someone who has never seen this', () => {
    const { output } = runGuard({ 'lib/thing.ts': "import { Resend } from 'resend'\n" });
    expect(output).toContain('sendAutomationEmail()');
    expect(output).toContain('dispatchEmail()');
    expect(output).toContain('lib/email/dispatch.ts');
    // The reason, not just the rule: the next person needs to know a
    // retry is involved, or the workaround looks harmless.
    expect(output).toContain('retries a failed step');
  });

  it('allows the transport module itself', () => {
    const { code } = runGuard({
      'lib/email/dispatch.ts': "import { Resend } from 'resend'\nawait r.emails.send({})\n",
    });
    expect(code).toBe(0);
  });

  it('leaves the calendar integration alone', () => {
    // Same host, different API. `/me/events` and `/me/calendar` are the
    // Scheduler's, and a guard that flagged them would be turned off.
    const { code, output } = runGuard({
      'lib/calendar/event-push.ts': [
        "await fetch('https://graph.microsoft.com/v1.0/me/events', { method: 'POST' })",
        "await fetch('https://graph.microsoft.com/v1.0/me/calendar?$select=x')",
        "await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule')",
        '',
      ].join('\n'),
    });
    expect(code).toBe(0);
    expect(output).toContain('OK');
  });

  it('passes a tree with no email code at all', () => {
    const { code } = runGuard({ 'lib/pure.ts': 'export const add = (a: number) => a + 1\n' });
    expect(code).toBe(0);
  });
});

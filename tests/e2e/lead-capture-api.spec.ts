/**
 * Public Lead Capture API e2e.
 *
 * Serves a tiny third-party page from 127.0.0.1 (a different origin from the
 * app on localhost) that posts to /api/lead/submit from the browser:
 *   1. With the origin allowlisted the post succeeds and the lead lands with
 *      "Enquiry from 127.0.0.1:<port>".
 *   2. With the origin removed the browser refuses the post.
 *
 * Requires the lead_capture_api migration on the target database.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { login, uniqueName } from './helpers';

function thirdPartyPage(endpoint: string, token: string): string {
  return `<!doctype html><form id="f">
  <input name="name" aria-label="Name"><input name="email" aria-label="Email">
  <input name="company_website" style="display:none">
  <button>Send</button></form><p id="out"></p>
  <script>
    const rendered = Date.now();
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('${endpoint}', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: '${token}', name: f.name.value, email: f.email.value, hp: f.company_website.value, rendered_at: rendered }) });
        out.textContent = 'status:' + res.status;
      } catch (err) { out.textContent = 'error'; }
    };
  </script>`;
}

let server: Server;
let origin: string;
let html = '';

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => server.close());

test('a third-party page posts a lead only when its origin is allowlisted', async ({ page, browser, baseURL }) => {
  await login(page);
  await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
  const token = await page.getByRole('textbox', { name: 'Form token' }).inputValue();
  html = thirdPartyPage(`${baseURL}/api/lead/submit`, token);

  // Everything from here runs inside a try/finally: an ephemeral allowlist
  // entry on the shared MC account that must not survive a failed run and
  // permanently block every later run's "No domains yet" assertion, and a
  // logged-out visitor context that must not leak past this test. The
  // allowlist step itself is inside the try too: if its own visibility
  // check throws, the finally block's removal still runs instead of leaving
  // the origin stranded on the shared account.
  const visitorContext = await browser.newContext();
  try {
    // Allowlist this origin.
    await page.getByRole('textbox', { name: 'Add domain' }).fill(origin);
    await page.getByRole('button', { name: 'Add domain' }).click();
    await expect(page.getByRole('textbox', { name: origin })).toBeVisible();

    const visitor = await visitorContext.newPage();
    await visitor.goto(`${origin}/contact`);
    const leadName = uniqueName('ApiLead');
    await visitor.getByLabel('Name').fill(leadName);
    await visitor.getByLabel('Email').fill('api@example.test');
    await visitor.waitForTimeout(2200); // clear the speed trap
    await visitor.getByRole('button', { name: 'Send' }).click();
    await expect(visitor.locator('#out')).toHaveText('status:200');

    // The lead landed with its origin.
    await page.goto('/couples', { waitUntil: 'networkidle' });
    await page.getByText(leadName).click();
    await expect(page.getByText('Enquiry from')).toBeVisible();
    await expect(page.getByText(new URL(origin).host)).toBeVisible();

    // Remove the origin: the browser now refuses the post.
    await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: `Remove ${origin}` }).click();
    // Assert this test's own row is gone rather than that the list is empty:
    // the account's website from Personal Info is seeded in automatically, so
    // an empty list is not something this test can rely on.
    await expect(page.getByRole('textbox', { name: origin })).toHaveCount(0);

    await visitor.reload();
    await visitor.getByLabel('Name').fill(uniqueName('Blocked'));
    await visitor.getByLabel('Email').fill('blocked@example.test');
    await visitor.waitForTimeout(2200);
    await visitor.getByRole('button', { name: 'Send' }).click();
    await expect(visitor.locator('#out')).toHaveText('error');
  } finally {
    // Best-effort safety net: if an assertion above threw before the
    // removal step ran, the origin would otherwise survive on the shared
    // MC account and break every later run's empty-state assertion.
    await page
      .goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' })
      .catch(() => {});
    const removeBtn = page.getByRole('button', { name: `Remove ${origin}` });
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click().catch(() => {});
    }
    // Guarded so a failure here cannot mask the real assertion error above.
    await visitorContext.close().catch(() => {});
  }
});

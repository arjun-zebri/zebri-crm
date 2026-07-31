/**
 * ZEB-2 - embeddable lead-capture form e2e.
 *
 * Exercises the full inbound-lead loop end to end:
 *   1. The MC copies their hosted form link from Settings -> Lead Capture.
 *   2. A visitor (no auth) opens the hosted form, fills it, and submits.
 *   3. The visitor sees the branded success state.
 *   4. `?embed=1` renders the chromeless variant (no business heading).
 *
 * Requires the `lead_capture_forms` migration to be deployed to the target
 * database (it ships via CI). Against a database without the migration the
 * Settings tab cannot create a form, so this suite is expected to fail until
 * the migration lands - it is not a code defect.
 */
import { test, expect } from '@playwright/test';

import { login, uniqueName } from './helpers';

test.describe('Lead capture', () => {
  test('MC copies the hosted link and a visitor submits an enquiry', async ({
    page,
    context,
  }) => {
    // ── 1. MC grabs the hosted link from Settings ──────────────────────────
    await login(page);
    await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /lead capture/i })).toBeVisible();

    const hostedField = page.getByLabel('Hosted link');
    await expect(hostedField).toBeVisible();
    const hostedUrl = await hostedField.inputValue();
    expect(hostedUrl).toContain('/lead/');

    // ── 2. Visitor opens the hosted form in a fresh (unauthenticated) tab ───
    const visitor = await context.newPage();
    await visitor.goto(hostedUrl, { waitUntil: 'networkidle' });

    const leadName = uniqueName('Lead');
    await visitor.getByRole('textbox', { name: /your name/i }).fill(leadName);
    await visitor
      .getByRole('textbox', { name: /email/i })
      .fill(`${leadName.replace(/\s+/g, '.').toLowerCase()}@example.test`);

    // ── 3. Submit -> branded success state ─────────────────────────────────
    await visitor.getByRole('button', { name: /send enquiry/i }).click();
    await expect(visitor.getByText(/thank you/i)).toBeVisible();
    await visitor.close();

    // ── 4. The lead appears in the MC's pipeline ───────────────────────────
    await page.goto('/couples', { waitUntil: 'networkidle' });
    await expect(page.getByText(leadName)).toBeVisible();
  });

  test('embed mode renders the form without page chrome', async ({ page, context }) => {
    await login(page);
    await page.goto('/settings?tab=lead-capture', { waitUntil: 'networkidle' });
    const hostedUrl = await page.getByLabel('Hosted link').inputValue();

    const embed = await context.newPage();
    await embed.goto(`${hostedUrl}?embed=1`, { waitUntil: 'networkidle' });

    // The form is present but the standalone business heading is not.
    await expect(embed.getByRole('button', { name: /send enquiry/i })).toBeVisible();
    await expect(embed.getByRole('heading', { level: 1 })).toHaveCount(0);
    await embed.close();
  });
});

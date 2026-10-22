/**
 * Admin Outreach, end to end: import a sheet, run the activity check,
 * open a prospect and mark a reply.
 *
 * Signs in as its own fresh admin user (the shared e2e account is an MC,
 * not an admin), so it runs in the `signed-out` CI pass. The imported
 * rows have no website and no email, and the Instagram budget is not
 * touched, so the check makes no network calls and spends nothing.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the
 * server's Supabase to seed and clean up. Fails without them on purpose:
 * a silent skip would leave Outreach with no end-to-end coverage.
 */
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = 'Outreach-e2e-12345!';

test('import a sheet, check activity, mark a reply', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  expect(url, 'NEXT_PUBLIC_SUPABASE_URL must point at the server Supabase').toBeTruthy();
  expect(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY is needed to seed the admin user').toBeTruthy();
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });

  // Outreach tables are global, so every name carries a run-unique tag.
  // Project name, not browserName: Mobile Chrome and chromium share one.
  const tag = `${testInfo.project.name.replace(/\W/g, '').toLowerCase()}${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const quiet = `Quiet ${tag}`;
  const insta = `Insta ${tag}`;
  const email = `outreach-e2e+${tag}@zebri.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { account_type: 'admin', subscription_status: 'active', subscription_plan: 'pro' },
    // Skip the first-run welcome wizard, which would cover the page.
    user_metadata: { display_name: 'Outreach Admin', welcome_onboarded_at: new Date().toISOString() },
  });
  expect(error).toBeNull();
  const userId = created.user!.id;

  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));

    // Retired `?view=checks` lands on Prospects with nothing open.
    await page.goto('/admin/outreach?view=checks');
    await page.waitForURL(/\/admin\/outreach\?view=prospects$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 1. Import. `import=1` is the same deep link the Today setup guide uses.
    await page.goto('/admin/outreach?view=prospects&import=1');
    const csv = ['Name,State,Suburb,Instagram', `${quiet},NSW,Bondi,`, `${insta},VIC,Fitzroy,@insta_${tag}`].join('\n');
    await page.getByLabel('Choose CSV file').setInputFiles({ name: 'celebrants.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Preview import' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Run activity check' })).toBeVisible();

    // 2. Activity check. The page drives the batches itself.
    await expect(page).not.toHaveURL(/import=1/);
    await page.getByRole('button', { name: 'Run activity check' }).click();
    await page.getByRole('button', { name: 'Start check' }).click();
    await expect.poll(async () => {
      const { data } = await admin.from('outreach_prospects').select('verdict').eq('full_name', quiet).single();
      return data?.verdict;
    }, { timeout: 90_000 }).toBe('inactive');

    // 3. Find the prospect and mark a reply from the drawer.
    await page.goto('/admin/outreach?view=prospects');
    await page.getByLabel('Search prospects').fill(insta);
    // The table shows on desktop, a card list on phones: click whichever is on screen.
    await page.getByText(insta, { exact: true }).locator('visible=true').first().click();
    const drawer = page.getByRole('dialog', { name: insta });
    await drawer.getByRole('button', { name: 'Mark replied' }).click();
    await page.getByRole('dialog', { name: 'Mark replied' }).getByRole('button', { name: 'Mark replied' }).click();
    await expect(page.getByText('Marked replied', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => {
      const { data } = await admin.from('outreach_prospects').select('stage').eq('full_name', insta).single();
      return data?.stage;
    }).toBe('replied');
  } finally {
    const { data: rows } = await admin.from('outreach_prospects').select('id').in('full_name', [quiet, insta]);
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length) {
      await admin.from('outreach_events').delete().in('prospect_id', ids);
      await admin.from('outreach_prospects').delete().in('id', ids);
    }
    await admin.auth.admin.deleteUser(userId);
  }
});

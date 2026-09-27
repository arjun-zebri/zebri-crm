/**
 * Two-factor sign-in, end to end (Phase 4, Task 23).
 *
 * One test, one fresh user, the whole life of the feature: turn 2FA on
 * from Settings, sign out, sign in with the password and get stopped at
 * the code screen, pass it with a TOTP code, then lose the "phone" and get
 * back in with a recovery code, which switches 2FA off.
 *
 * Needs a server whose Supabase has TOTP enabled (local `supabase start`
 * with this repo's config.toml), plus NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY for that same project to seed the user.
 * FAILS without them, on purpose: a silent skip would leave the feature
 * with no end-to-end coverage and nobody noticing. Kept to one test so the login rate limiter (10 a
 * minute per IP) is never the thing that fails.
 */
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { totp } from './fixtures/totp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


const PASSWORD = 'Two-factor-e2e-12345!';

/**
 * Sign out by dropping the cookies. Leave the app first: a dashboard page
 * left open notices the lost session and navigates to /login by itself,
 * racing the test's own navigation.
 */
async function signOut(page: Page) {
  await page.goto('about:blank');
  await page.context().clearCookies();
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Wait for the next 30-second step so a code is never reused: a code
 * already accepted in this step can be refused as a replay.
 */
async function freshCode(page: Page, secret: string): Promise<string> {
  const msIntoStep = Date.now() % 30_000;
  await page.waitForTimeout(30_000 - msIntoStep + 500);
  return totp(secret);
}

test('turn on 2FA, sign in with a code, recover with a recovery code', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  expect(url, 'NEXT_PUBLIC_SUPABASE_URL must point at a TOTP-enabled Supabase').toBeTruthy();
  expect(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY is needed to seed the test user').toBeTruthy();
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const email = `2fa-e2e+${browserName}-${Date.now()}@zebri.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' },
    // Skip the first-run welcome wizard, which would cover the page.
    user_metadata: { display_name: 'Two Factor', welcome_onboarded_at: new Date().toISOString() },
  });
  expect(error).toBeNull();
  const userId = created.user!.id;

  try {
    // 1. Password sign-in, then turn 2FA on from Settings, Account.
    await signIn(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await page.goto('/settings?tab=account');
    await page.getByRole('button', { name: 'Turn on two-factor sign-in' }).click();

    const dialog = page.getByRole('dialog', { name: 'Turn on two-factor sign-in' });
    const secret = (await dialog.getByText(/Can't scan\? Enter this key instead:/).locator('span').innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    await dialog.getByLabel('Authentication code').fill(totp(secret));
    await dialog.getByRole('button', { name: 'Verify and turn on' }).click();

    const codeList = dialog.getByRole('list', { name: 'Recovery codes' });
    await expect(codeList.getByRole('listitem')).toHaveCount(10);
    const codes = await codeList.getByRole('listitem').allInnerTexts();
    await dialog.getByRole('button', { name: 'I have saved my codes' }).click();
    await expect(page.getByText('10 of 10 recovery codes left.', { exact: false })).toBeVisible();

    // 2. Sign out, sign in with the password: stopped at the code screen,
    //    and a dashboard URL typed directly still bounces there.
    await signOut(page);
    await signIn(page, email);
    await page.waitForURL(/\/login\/mfa/);
    await page.goto('/couples');
    await expect(page).toHaveURL(/\/login\/mfa\?next=%2Fcouples/);

    // 3. A wrong code is refused; the right one gets in.
    await page.getByLabel('Authentication code').fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText(/That code did not work/)).toBeVisible();
    await page.getByLabel('Authentication code').fill(await freshCode(page, secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    await page.waitForURL((u) => u.pathname === '/couples');

    // 4. Lost phone: password, then a recovery code. 2FA goes off and the
    //    next password sign-in lands straight in the app.
    await signOut(page);
    await signIn(page, email);
    await page.waitForURL(/\/login\/mfa/);
    await page.getByRole('button', { name: 'Use a recovery code' }).click();
    await page.getByLabel('Recovery code').fill(codes[0]!.toUpperCase());
    await page.getByRole('button', { name: 'Use recovery code' }).click();
    await page.waitForURL(/\/login\?recovered=1/);
    await expect(page.getByText(/Recovery code accepted and two-factor sign-in is off/)).toBeVisible();

    await signIn(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));

    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
    expect(factors?.factors ?? []).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});

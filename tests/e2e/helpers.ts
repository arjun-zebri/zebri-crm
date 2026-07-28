import { Page } from '@playwright/test'

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`
}

/**
 * Login helper.
 *
 * With storageState configured in playwright.config.ts, the browser context
 * already has valid auth cookies — navigating to '/' will skip /login entirely.
 * This function checks for that fast path first.
 *
 * Without storageState (or when running auth tests with cleared state), it
 * performs the full login flow via UI. Works on all servers: production, main dev server,
 * and isolated local Supabase (localhost:3123).
 */
export async function login(page: Page) {
  // Fast path: if storageState already has a valid session, '/' won't redirect to /login
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  if (!page.url().includes('/login')) {
    return
  }

  // Full login flow
  await page.goto('/login', { waitUntil: 'networkidle' })

  // The login form uses the <Input name="…"> primitive (auto-generated
  // ids), so target by name, not a hard-coded id.
  const emailInput = page.locator('input[name="email"]')
  const passwordInput = page.locator('input[name="password"]')
  const submitButton = page.locator('button[type="submit"]')

  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 })

  await emailInput.fill(process.env.TEST_EMAIL || 'test@example.com')
  await emailInput.dispatchEvent('change')
  await passwordInput.fill(process.env.TEST_PASSWORD || 'test-password')
  await passwordInput.dispatchEvent('change')

  await page.waitForTimeout(300)
  await submitButton.click()

  // BUG FIX: the old regex /\/(|dashboard|couples...)/ had an empty alternative
  // that matched /login itself, so waitForURL resolved before the redirect happened.
  // Now we explicitly wait until the URL is no longer /login.
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 })
}

export async function logout(page: Page) {
  await page.goto('/settings')
  const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Sign out"), button:has-text("Log Out")')
  await signOutButton.click()
  await page.waitForURL('/login')
}

export async function addCouple(
  page: Page,
  opts: { name: string; email?: string; phone?: string; notes?: string }
) {
  // "New couple" is a split menu (Add manually / Import from CSV).
  await openAddCoupleModal(page)
  await page.locator('input[placeholder="Couple\'s name"]').fill(opts.name)
  // The partner-contact-triples form made the primary contact's full
  // name required (Save stays disabled without it); derive one.
  await page.locator('input[placeholder="Full name"]').first().fill(opts.name.split(' ')[0] || 'Test Contact')
  if (opts.email) await page.locator('input[type="email"]').first().fill(opts.email)
  if (opts.phone) await page.locator('input[type="tel"]').first().fill(opts.phone)
  if (opts.notes) await page.locator('textarea').fill(opts.notes)
  await page.locator('button:has-text("Save")').click()
  await page.waitForSelector('h2:has-text("Add Couple")', { state: 'hidden' })
  await page.waitForLoadState('networkidle')
}

/** Open the manual "Add Couple" modal via the New-couple split menu. */
export async function openAddCoupleModal(page: Page) {
  await page.locator('button:has-text("New couple")').first().click()
  await page.locator('button:has-text("Add manually")').click()
  await page.waitForSelector('h2:has-text("Add Couple")')
}

/** Open the "Import couples" modal via the New-couple split menu. */
export async function openImportCouplesModal(page: Page) {
  await page.locator('button:has-text("New couple")').first().click()
  await page.locator('button:has-text("Import from CSV")').click()
  await page.waitForSelector('h2:has-text("Import couples")')
}

export async function openCoupleProfile(page: Page, name: string) {
  await search(page, name)
  await page.locator(`table tbody tr:has-text("${name}")`).first().click()
  await page.waitForSelector('[data-testid="couple-profile-panel"]')
}

export async function closeProfile(page: Page) {
  await page.locator('[data-testid="couple-profile-panel"]').locator('button').first().click()
  await page.waitForSelector('[data-testid="couple-profile-panel"]', { state: 'hidden' })
}

export async function deleteCouple(page: Page, name: string) {
  await openCoupleProfile(page, name)
  await page.locator('[data-testid="delete-couple-btn"]').click()
  // ConfirmDialog appears — click the Delete confirm button
  await page.locator('button:has-text("Delete")').last().click()
  await page.waitForSelector('[data-testid="couple-profile-panel"]', { state: 'hidden' })
  await page.waitForLoadState('networkidle')
}

export async function navigateToProfileTab(
  page: Page,
  tab: 'Overview' | 'Tasks' | 'Payments' | 'Names' | 'Timeline' | 'Songs' | 'Files'
) {
  await page.locator('[data-testid="couple-profile-panel"]').locator(`button:has-text("${tab}")`).click()
  await page.waitForLoadState('networkidle')
}

export async function addContact(
  page: Page,
  opts: {
    name: string
    contactName?: string
    phone?: string
    email?: string
    notes?: string
  }
) {
  await page.locator('button:has-text("New")').first().click()
  await page.waitForSelector('h2:has-text("Add Contact")')
  await page.locator('input[placeholder="e.g., Elegant Venues"]').fill(opts.name)
  if (opts.contactName) await page.locator('input[placeholder="e.g., John Smith"]').fill(opts.contactName)
  if (opts.phone) await page.locator('input[type="tel"]').fill(opts.phone)
  if (opts.email) await page.locator('input[type="email"]').fill(opts.email)
  if (opts.notes) await page.locator('textarea').fill(opts.notes)
  await page.locator('button:has-text("Save")').click()
  await page.waitForSelector('h2:has-text("Add Contact")', { state: 'hidden' })
  await page.waitForLoadState('networkidle')
}

export async function deleteContact(page: Page, name: string) {
  await search(page, name)
  await page.locator(`table tbody tr:has-text("${name}")`).first().click()
  await page.waitForSelector('[data-testid="contact-profile-panel"] h1')
  await page.locator('[data-testid="contact-profile-panel"]').locator('button:has-text("Edit")').click()
  await page.waitForSelector('h2:has-text("Edit Contact")')
  await page.locator('button:has-text("Delete")').click()
  await page.locator('button:has-text("Click again to confirm")').click()
  await page.waitForSelector('h2:has-text("Edit Contact")', { state: 'hidden' })
  await page.waitForLoadState('networkidle')
}

/** @deprecated Use addContact instead */
export const addVendor = addContact
/** @deprecated Use deleteContact instead */
export const deleteVendor = deleteContact

export async function search(page: Page, term: string) {
  const searchInput = page.locator('input[placeholder="Search..."]').first()
  await searchInput.fill(term)
  await page.waitForLoadState('networkidle')
}

export async function clearSearch(page: Page) {
  const searchInput = page.locator('input[placeholder="Search..."]').first()
  await searchInput.clear()
  await searchInput.press('Escape')
  await page.waitForLoadState('networkidle')
}

/**
 * Proposals, Phase A + B: create from /proposals, save, and open the public
 * link as a logged-out visitor. Sending needs Resend, so this spec does
 * not exercise the "Send to couple" flow; instead it asserts the 404 for
 * an unsent link, and the page for a sent one when TEST_PROPOSAL_TOKEN is
 * provided (set by flipping `share_token_enabled` on a saved proposal
 * directly in local SQL). Phase B adds the `/branding?surface=proposal`
 * role chooser + page canvas, and the public page-mode surface (package
 * selection, accept note) that replaced the Phase A document renderer.
 */
import { expect, test } from '@playwright/test'

import { login, openSidebar, uniqueName } from './helpers'

test.describe('proposals', () => {
  test('creates a proposal and lands on its detail page', async ({ page }) => {
    await login(page)
    await openSidebar(page)
    await page.getByRole('link', { name: 'Proposals' }).click()
    await expect(page.getByRole('heading', { name: 'Proposals' })).toBeVisible()

    // `getByRole` with a name resolves to the single button regardless of
    // breakpoint: `New proposal` carries `aria-label="New proposal"` so its
    // accessible name is stable even where the visible label collapses to
    // icon-only below `sm` (see proposals-header.tsx).
    await page.getByRole('button', { name: 'New proposal' }).first().click()
    const title = uniqueName('Proposal')
    await page.getByPlaceholder('Anna & Jake, your wedding').fill(title)

    await page.getByText('Select couple', { exact: false }).first().click()
    const firstCouple = page.locator('[data-radix-popper-content-wrapper] button').first()
    await firstCouple.waitFor()
    await firstCouple.click()

    // ShareAndSend's save button label is "Save changes" (not a bare
    // "Save"); see components/builders/parts/share-and-send.tsx.
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/proposals\/[0-9a-f-]{36}/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Draft')).toBeVisible()
  })

  test('an unsent proposal link is not public', async ({ browser }) => {
    const context = await browser.newContext()
    const visitor = await context.newPage()
    const res = await visitor.goto('/proposal/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(404)
    await context.close()
  })

  test('the proposal branding tab shows the role chooser once and renders the page canvas', async ({ page }) => {
    await login(page)
    await page.goto('/branding?surface=proposal')
    const chooser = page.getByRole('dialog', { name: 'What do you offer?' })
    // `isVisible()` is a single, non-waiting snapshot check, not an assertion
    // that polls: the branding page mounts its editor (and this dialog, via a
    // portal) only after an async user_branding fetch resolves, so a
    // same-tick isVisible() check reads the DOM before that mount and always
    // reports false, silently skipping the click on every run. `waitFor`
    // actually polls up to the timeout, so it reliably observes the dialog
    // whether the account needs the chooser or not.
    const chooserSeen = await chooser
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (chooserSeen) {
      // PROPOSAL_ROLE_LABELS.both.label is "MC and Celebrant" (lib/proposals/types.ts);
      // the chooser button's accessible name is that label verbatim.
      await chooser.getByRole('button', { name: /MC and Celebrant/ }).click()
    }
    // A chooser that stays open after choosing (e.g. the action failed
    // silently) must fail this test, not just be skipped over.
    await expect(page.getByRole('dialog', { name: 'What do you offer?' })).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()   // the hero heading in the canvas
    await expect(page.getByText('Your options')).toBeVisible()
    await page.reload()
    // Wait for the editor to actually be ready (not the loading skeleton)
    // before checking the dialog is gone: right after a reload there is a
    // brief window with zero dialogs simply because nothing has mounted
    // yet, which would let toHaveCount(0) pass without proving anything.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'What do you offer?' })).toHaveCount(0)
  })

  test('a sent proposal renders in page mode with selectable packages', async ({ browser }) => {
    test.skip(!process.env.TEST_PROPOSAL_TOKEN, 'needs a sent proposal token on the target DB')
    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(`/proposal/${process.env.TEST_PROPOSAL_TOKEN}`)
    await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible()
    const cards = visitor.locator('article[data-option-id]')
    await expect(cards.first()).toBeVisible()
    await cards.first().getByRole('button').first().click()
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true')
    await visitor.getByRole('button', { name: 'Accept and sign' }).click()
    await expect(visitor.getByRole('dialog')).toBeVisible()
    await context.close()
  })
})

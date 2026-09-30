/**
 * Proposal analytics (R4), end to end: a couple reads a sent Layout v2
 * proposal, and the MC sees it on the proposal's detail page as "Reading by
 * section" with a non-zero reach on the first section.
 *
 * Skipped unless both env vars are set, because it needs a sent v2
 * proposal on the target database that belongs to the e2e login
 * (`TEST_EMAIL` / `TEST_PASSWORD`):
 *
 * - `TEST_PROPOSAL_TOKEN`: its `share_token` (the public `/proposal/<token>` link).
 * - `TEST_PROPOSAL_ID`: its `id` (the `/proposals/<id>` detail page). The
 *   public page never exposes the id, so the spec cannot derive it.
 *
 * The same token as `proposals.spec.ts` works when that proposal is v2.
 *
 * @module tests/e2e/proposal-analytics
 */
import { expect, test, type Page } from '@playwright/test'

import { login } from './helpers'

const token = process.env.TEST_PROPOSAL_TOKEN
const proposalId = process.env.TEST_PROPOSAL_ID

/**
 * Distinct sessions on the detail page's Engagement facts line
 * ("1 session · first opened ..." or "2 sessions · ..."), or 0 when it
 * shows the empty state.
 * Waits for the section to finish loading first, so a still-loading
 * report is never read as zero.
 */
async function sessionCount(page: Page): Promise<number> {
  const facts = page.getByText(/^\d+ sessions?( ·|$)/)
  const empty = page.getByText('No opens yet')
  await expect(facts.or(empty).first()).toBeVisible()
  if (await empty.isVisible()) return 0
  return Number((await facts.first().textContent())?.match(/^(\d+)/)?.[1] ?? 0)
}

test.describe('proposal analytics', () => {
  test('a couple reading the proposal shows up as reading by section', async ({ browser, page }) => {
    test.skip(!token || !proposalId, 'needs TEST_PROPOSAL_TOKEN and TEST_PROPOSAL_ID for a sent v2 proposal owned by the e2e login')

    // Baseline first: the proposal is reused across runs and projects, so
    // "the report is visible" alone would pass on an earlier run's rows.
    // The session count has to go up for this visit to be proven recorded.
    await login(page)
    await page.goto(`/proposals/${proposalId}`)
    const before = await sessionCount(page)

    // A fresh context, not `page.context()`: a shared context carries the
    // owner's cookies, and `record_proposal_events` records nothing for the
    // proposal's own MC, so every event would be swallowed.
    const visitorContext = await browser.newContext()
    const visitor = await visitorContext.newPage()
    await visitor.goto(`/proposal/${token}`)
    await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible()
    // Walk the sections one by one rather than with `mouse.wheel`, which
    // mobile WebKit (the iPhone 12 project) does not support. The pause
    // gives the tracker's IntersectionObserver time to see each one.
    const sections = visitor.locator('[data-section-id]')
    const count = await sections.count()
    for (let i = 0; i < count; i++) {
      await sections.nth(i).scrollIntoViewIfNeeded()
      await visitor.waitForTimeout(300)
    }
    await visitor.waitForTimeout(3000)
    // Leaving the page fires `pagehide`, which flushes the queued events by
    // beacon. The visit is shorter than the tracker's 10s interval flush,
    // so the beacon is the only delivery. Navigate away rather than
    // `page.close()`: Playwright's WebKit closes the page without firing
    // `pagehide` at all (a real iPhone does fire it), and closing the
    // context straight after tears a just-queued beacon down, so give it a
    // moment before closing.
    await visitor.goto('about:blank')
    await visitor.waitForTimeout(2000)
    await visitorContext.close()

    // The beacon lands asynchronously, so allow a few reloads for it.
    await expect(async () => {
      await page.reload()
      expect(await sessionCount(page)).toBeGreaterThan(before)
    }).toPass({ timeout: 30_000 })

    await expect(page.getByRole('heading', { name: 'Reading by section' })).toBeVisible()
    const firstReach = page.getByText(/\d+% reached/).first()
    await expect(firstReach).toBeVisible()
    const pct = Number((await firstReach.textContent())?.match(/(\d+)%/)?.[1] ?? 0)
    expect(pct).toBeGreaterThanOrEqual(1)
  })
})

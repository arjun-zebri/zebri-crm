import { test, expect, type Page } from '@playwright/test'

import { addCouple, deleteCouple, login, navigateToProfileTab, openCoupleProfile, uniqueName } from './helpers'

/**
 * The MC adds a couple's song from Spotify on the client profile.
 *
 * `/api/spotify/search` is intercepted so the spec never depends on
 * Spotify's availability or on SPOTIFY_* credentials in the environment;
 * the route itself is covered by `tests/unit/app/api/spotify-search-route`.
 * The save path, the RPC and the CHECKs are covered by
 * `tests/integration/portal/songs-spotify.test.ts`.
 */
const COUPLE_PREFIX = 'Spotify Songs'
const TRACK = {
  id: '44AyOl4qVkzS48vBsbNXaC',
  title: "Can't Help Falling in Love",
  artist: 'Elvis Presley',
  album: 'Blue Hawaii',
  artworkUrl: 'https://i.scdn.co/image/ab67616d00004851e2b1f6e7c0aa2c3e',
  durationMs: 182_000,
}

async function stubSpotify(page: Page, tracks: unknown[] | 'down') {
  await page.route('**/api/spotify/search**', (route) =>
    tracks === 'down'
      ? route.fulfill({ status: 503, json: { error: 'Spotify search is unavailable' } })
      : route.fulfill({ status: 200, json: { tracks } }),
  )
  // Keep the real Spotify player and cover CDN out of the test run.
  await page.route('https://open.spotify.com/embed/**', (route) => route.fulfill({ status: 200, body: '<html></html>' }))
  await page.route('https://i.scdn.co/**', (route) => route.fulfill({ status: 404 }))
}

async function openAddSong(page: Page) {
  await navigateToProfileTab(page, 'Songs')
  const panel = page.locator('[data-testid="couple-profile-panel"]')
  // The add-song control sits beside each category heading; on desktop it
  // appears on hover.
  // New couples are seeded with Parents Entry as the first category.
  await panel.getByRole('heading', { name: 'Parents Entry' }).hover()
  await panel.getByRole('button', { name: 'Add song' }).first().click()
  return page.getByRole('dialog')
}

test.describe('Songs from Spotify', () => {
  let coupleName: string

  test.beforeEach(async ({ page }) => {
    await login(page)
    coupleName = uniqueName(COUPLE_PREFIX)
    await page.goto('/couples', { waitUntil: 'networkidle' })
    await addCouple(page, { name: coupleName, email: 'spotify@test.com' })
  })

  test.afterEach(async ({ page }) => {
    try {
      await page.goto('/couples', { waitUntil: 'networkidle' })
      await deleteCouple(page, coupleName)
    } catch {
      // Already deleted in the test
    }
  })

  test('search, pick, hear it, and save', async ({ page }) => {
    await stubSpotify(page, [TRACK])
    await openCoupleProfile(page, coupleName)
    const dialog = await openAddSong(page)

    await dialog.getByLabel('Search Spotify').fill('cant help falling')
    await dialog.getByRole('button', { name: /Can't Help Falling in Love/ }).click()
    await expect(dialog.getByTitle(`Play ${TRACK.title} on Spotify`)).toBeVisible()

    await dialog.getByLabel('Notes').fill('From the chorus')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    const panel = page.locator('[data-testid="couple-profile-panel"]')
    await expect(panel.getByText(TRACK.title)).toBeVisible()

    // Reopening the song shows its player, not an empty search.
    await panel.getByText(TRACK.title).click()
    await expect(page.getByRole('dialog').getByTitle(`Play ${TRACK.title} on Spotify`)).toBeVisible()
  })

  test('falls back to typing the song when Spotify is down', async ({ page }) => {
    await stubSpotify(page, 'down')
    await openCoupleProfile(page, coupleName)
    const dialog = await openAddSong(page)

    await dialog.getByLabel('Search Spotify').fill('perfect')
    await expect(dialog.getByText(/isn't available right now/)).toBeVisible()
    await dialog.getByRole('button', { name: /Type it in/ }).click()
    await dialog.getByLabel('Song title').fill('Live set')
    await dialog.getByLabel('Artist').fill('Cousin Sam')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    await expect(page.locator('[data-testid="couple-profile-panel"]').getByText('Live set')).toBeVisible()
  })
})

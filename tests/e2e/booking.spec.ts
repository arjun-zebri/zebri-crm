/**
 * E2E tests for the public booking page (Scheduler Phase C).
 *
 * Covers the full booking flow end to end:
 *   1. Seeds test data via service client (test user, active meeting type with
 *      availability rules for tomorrow).
 *   2. First logged-out visitor opens /book/<token>, picks the first slot, fills
 *      the form with name/email/phone/notes, submits, and sees the confirmation screen.
 *   3. Second logged-out visitor tries to book the same slot, sees the slot-taken
 *      recovery notice, and can pick a different time.
 *
 * Key invariants:
 *   - Uses `browser.newContext()` to create truly unauthenticated visitors
 *     (not `context.newPage()`, which shares the MC's auth cookies).
 *   - Seeding is via the service client to bypass RLS.
 *   - Runs on Desktop Chrome and Mobile Pixel 5 (from playwright.config.ts).
 *
 * IMPORTANT: This suite requires:
 *   - Local Supabase running (`supabase start`)
 *   - Dev server running on http://localhost:3000
 *   - The scheduler migrations (20260819000000_*) deployed locally
 *
 * If the stack is unavailable, skip this suite.
 *
 * @module tests/e2e/booking.spec.ts
 */

import { test, expect } from '@playwright/test'

import { serviceClient, createTestUser, type DbClient } from '../integration/helpers/supabase'

test.describe('Public booking page', () => {
  let admin: DbClient
  let mcUser: Awaited<ReturnType<typeof createTestUser>>
  // The share token for the meeting type seeded in `beforeEach`.
  //
  // Held in a describe-scoped `let` rather than hung off the imported `test`
  // object behind an `as any` cast. Mutating a Playwright export is shared
  // module state and unsafe once tests in this file run in parallel, and the
  // cast defeated the type checking that would have caught it.
  let meetingShareToken: string

  test.beforeAll(async () => {
    // Guard: ensure local Supabase and dev server are reachable.
    try {
      admin = serviceClient()
    } catch {
      test.skip(true, 'Local Supabase not available; skipping booking e2e')
      return
    }
  })

  test.beforeEach(async () => {
    // Create an MC user and their meeting type.
    mcUser = await createTestUser({}, { account_type: 'vendor' })

    // Set the MC's timezone (required for slot calculations).
    await admin
      .from('user_public_settings')
      .upsert({
        user_id: mcUser.id,
        timezone: 'Australia/Sydney',
      }, { onConflict: 'user_id' })
      .throwOnError()

    // Create an active meeting type (Consultation, 30 min, video).
    const meetingType = await admin
      .from('meeting_types')
      .insert({
        user_id: mcUser.id,
        name: 'Consultation',
        description: 'Initial 30-minute consultation',
        duration_minutes: 30,
        location_type: 'video',
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
        min_notice_hours: 1,
        max_advance_days: 30,
        active: true,
      })
      .select('id, share_token')
      .single()
      .throwOnError()

    // Create availability for tomorrow (all day, 9 AM to 6 PM).
    // Tomorrow's weekday (0 = Sunday, 6 = Saturday).
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowWeekday = tomorrow.getDay()

    await admin
      .from('availability_rules')
      .insert({
        user_id: mcUser.id,
        weekday: tomorrowWeekday,
        start_time: '09:00:00',
        end_time: '18:00:00',
      })
      .throwOnError()

    meetingShareToken = meetingType.data.share_token
  })

  test.afterEach(async () => {
    // Clean up: delete the MC user (cascades all owned data).
    if (mcUser) {
      await mcUser.cleanup()
    }
  })

  test('First visitor books a consultation and sees the confirmation screen', async ({ browser }) => {
    const bookingUrl = `/book/${meetingShareToken}`

    // Fresh browser context (no MC cookies).
    const visitor1Ctx = await browser.newContext()
    try {
      const page = await visitor1Ctx.newPage()
      await page.goto(bookingUrl, { waitUntil: 'networkidle' })

      // Verify we're on the booking page.
      await expect(page.getByRole('heading', { name: 'Consultation', level: 1 })).toBeVisible()

      // Pick the first available time slot.
      // Slots are rendered as buttons with formatted times.
      const firstSlot = page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) }).first()
      await firstSlot.click()

      // Verify we've moved to the details form step.
      await expect(page.getByText('Confirm your booking details')).toBeVisible()

      // Fill the form.
      await page.getByLabel('Your name').fill('Alice Smith')
      await page.getByLabel("Partner's name (optional)").fill('Bob Smith')
      await page.getByLabel('Email').fill('alice@example.test')
      await page.getByLabel('Phone (optional)').fill('+61 2 1234 5678')
      await page.getByLabel('Notes (optional)').fill('Looking forward to it!')

      // Submit.
      await page.getByRole('button', { name: 'Confirm booking' }).click()

      // Verify confirmation screen.
      await expect(page.getByText('Booking confirmed')).toBeVisible()
      await expect(page.getByText('Thank you for booking a consultation with us')).toBeVisible()
      await expect(page.getByText('A confirmation email has been sent to your inbox')).toBeVisible()
    } finally {
      await visitor1Ctx.close()
    }
  })

  test('Second visitor sees slot-taken notice when trying to book the same time', async ({ browser }) => {
    const bookingUrl = `/book/${meetingShareToken}`

    // First visitor books a slot.
    {
      const ctx = await browser.newContext()
      try {
        const page = await ctx.newPage()
        await page.goto(bookingUrl, { waitUntil: 'networkidle' })
        const firstSlot = page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) }).first()
        await firstSlot.click()
        await page.getByLabel('Your name').fill('Charlie Brown')
        await page.getByLabel('Email').fill('charlie@example.test')
        await page.getByRole('button', { name: 'Confirm booking' }).click()
        await expect(page.getByText('Booking confirmed')).toBeVisible()
      } finally {
        await ctx.close()
      }
    }

    // Second visitor tries to book the same time.
    {
      const ctx = await browser.newContext()
      try {
        const page = await ctx.newPage()
        await page.goto(bookingUrl, { waitUntil: 'networkidle' })
        const firstSlot = page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) }).first()
        const firstSlotText = await firstSlot.textContent()
        await firstSlot.click()

        // The slot-taken notice should appear (the first slot is now booked).
        await expect(page.getByText('That time was just taken. Please choose another time.')).toBeVisible()

        // Go back and pick a different slot.
        await page.getByRole('button', { name: 'Back' }).click()
        await expect(page.getByText('Confirm your booking details')).not.toBeVisible()

        // Pick the second slot.
        const slots = page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) })
        const slotCount = await slots.count()
        expect(slotCount).toBeGreaterThanOrEqual(2) // Verify there are multiple slots

        const secondSlot = slots.nth(1)
        const secondSlotText = await secondSlot.textContent()
        expect(secondSlotText).not.toBe(firstSlotText) // Verify it's a different time
        await secondSlot.click()

        // Fill and submit with the second slot.
        await page.getByLabel('Your name').fill('Diana Prince')
        await page.getByLabel('Email').fill('diana@example.test')
        await page.getByRole('button', { name: 'Confirm booking' }).click()

        // Verify confirmation.
        await expect(page.getByText('Booking confirmed')).toBeVisible()
      } finally {
        await ctx.close()
      }
    }
  })

  test('Mobile: slot picker and form work on Pixel 5', async ({ browser }) => {
    test.skip(process.env.CI === 'true' && !process.env.PLAYWRIGHT_BASE_URL?.includes('3123'),
      'requires local Supabase or explicit isolated stack')

    const bookingUrl = `/book/${meetingShareToken}`

    const ctx = await browser.newContext()
    try {
      const page = await ctx.newPage()
      // Viewport size for Pixel 5 (393x851 in landscape, 393x786 in portrait; portrait is default).
      page.setViewportSize({ width: 393, height: 851 })

      await page.goto(bookingUrl, { waitUntil: 'networkidle' })

      // Verify the slot picker is visible on mobile.
      await expect(page.getByText(/Times shown in your local time/)).toBeVisible()

      // Pick a slot.
      const firstSlot = page.locator('button').filter({ has: page.getByText(/\d{1,2}:\d{2}/) }).first()
      await firstSlot.click()

      // Verify the details form is visible.
      await expect(page.getByLabel('Your name')).toBeVisible()

      // Fill and submit.
      await page.getByLabel('Your name').fill('Mobile Booker')
      await page.getByLabel('Email').fill('mobile@example.test')
      await page.getByRole('button', { name: 'Confirm booking' }).click()

      // Verify confirmation.
      await expect(page.getByText('Booking confirmed')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })
})

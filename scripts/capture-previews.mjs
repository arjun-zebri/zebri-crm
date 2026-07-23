#!/usr/bin/env node

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:3123'
const EMAIL = 'preview-check@zebri.com.au'
const PASSWORD = 'test-password-e2e'
const SHOTS_DIR = '/private/tmp/claude-501/-Users-arjunpunekar-Documents-zebri-zebri-crm/0ba3daa1-4b3d-4ca5-ab5b-08e969f6849e/scratchpad/shots'

async function capturePreview(stepNum, desktopWidth = 1280) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: desktopWidth, height: 800 } })

  try {
    // Navigate and login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button:has-text("Sign in")')
    await page.waitForURL(`${BASE_URL}/`)

    // Clear onboarded flag so modal opens
    await page.evaluate(() => {
      localStorage.removeItem('zebri:welcome-onboarded')
    })

    // Navigate to home
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })

    // Click Next until we reach the target step
    for (let i = 1; i < stepNum; i++) {
      const nextBtn = await page.$('button:has-text("Next")')
      if (nextBtn) {
        await nextBtn.click()
        await page.waitForTimeout(1500) // Wait for animations
      }
    }

    // Wait for the animations on this step to complete
    await page.waitForTimeout(12000)

    // Take screenshot
    const filename = `mock-${stepNum}${desktopWidth === 393 ? '-mobile' : ''}.png`
    const filepath = `${SHOTS_DIR}/${filename}`
    await page.screenshot({ path: filepath })
    console.log(`✓ Captured ${filename}`)
  } catch (error) {
    console.error(`Error capturing step ${stepNum} at ${desktopWidth}px:`, error)
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log('Capturing preview screenshots...\n')

  // Capture previews 4-7 at both desktop and mobile widths
  for (const step of [4, 5, 6, 7]) {
    await capturePreview(step, 1280)
    await capturePreview(step, 393)
    console.log()
  }

  console.log('All captures complete!')
}

main().catch(console.error)

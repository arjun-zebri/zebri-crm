/**
 * Unit-project test setup (jsdom).
 *
 * Registers jest-dom matchers (`toBeInTheDocument`, …) on Vitest's `expect`
 * and clears the React Testing Library DOM between tests so cases stay
 * isolated.
 *
 * Seeds dummy values for env vars that downstream modules read at
 * import time — notably the Stripe SDK constructor in
 * `lib/payments/stripe.ts`. Unit tests never call real Stripe; a
 * placeholder is enough to get past module-init.
 */
process.env.STRIPE_SECRET_KEY ??= 'sk_test_unit_dummy_not_used'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_unit_dummy_not_used'
process.env.STRIPE_CONNECT_WEBHOOK_SECRET ??= 'whsec_unit_dummy_not_used'

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom has no layout, so `document.elementFromPoint` does not exist.
// prosemirror-tables' column-resize plugin calls it on every mousemove over
// a table, which turns a `userEvent.hover(cell)` in the rich-text table tests
// into an uncaught TypeError that vitest reports as an unhandled error (exit
// code 1 with every test passing). Answer "nothing under the pointer".
if (typeof document !== 'undefined' && typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null
}

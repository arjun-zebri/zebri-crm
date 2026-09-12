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

// Same gap, other side: jsdom gives elements `getClientRects` /
// `getBoundingClientRect` but not `Range`. TipTap's `focus()` scrolls to the
// caret on an animation frame, and when the caret sits in text (the
// numbering-format tests) ProseMirror's `coordsAtPos` measures a Range over
// the text node and throws after the test has already passed. Report an empty
// rectangle, as an unlaid-out node would.
if (typeof Range !== 'undefined') {
  const emptyRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 })
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = () => emptyRect() as DOMRect
  }
}

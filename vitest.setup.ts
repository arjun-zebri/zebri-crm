/**
 * Unit-project test setup (jsdom).
 *
 * Registers jest-dom matchers (`toBeInTheDocument`, …) on Vitest's `expect`
 * and clears the React Testing Library DOM between tests so cases stay
 * isolated.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

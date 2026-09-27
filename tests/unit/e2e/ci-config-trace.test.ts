// @vitest-environment node
/**
 * A failed CI e2e test keeps its trace (Phase 6 review M4).
 *
 * The base config traces `on-first-retry`, and the CI config runs with
 * retries 0 while the backlog of known failures is red, so no CI failure
 * ever recorded a trace. The CI config now keeps one for every failure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('playwright.ci.config.ts', () => {
  it('retains a trace for every failure, with retries off', async () => {
    vi.stubEnv('PLAYWRIGHT_BASE_URL', 'http://127.0.0.1:3100')
    const { default: config } = await import('../../../playwright.ci.config')
    expect(config.retries).toBe(0)
    expect(config.use?.trace).toBe('retain-on-failure')
  })
})

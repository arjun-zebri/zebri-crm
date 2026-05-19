import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

/**
 * Vitest configuration.
 *
 * Two projects with different needs:
 *  - `unit`        — fast, isolated, jsdom; pure functions + React components.
 *  - `integration` — node env, runs against the LOCAL Supabase stack with
 *                     real RLS (never cloud). Serial, longer timeouts.
 *
 * Playwright e2e (`tests/e2e/**`) is intentionally NOT picked up here — it
 * has its own runner (`npm run test:e2e`).
 *
 * `tsconfigPaths()` makes `@/…` resolve identically to tsconfig (no drift).
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          // RLS/integration tests share one local DB — run them in a
          // single process, serially, to avoid cross-test interference.
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.d.ts', '**/*.config.*'],
      // Global thresholds are intentionally NOT enforced yet — the codebase
      // starts with ~no unit tests. Per-module thresholds are added as each
      // page/feature is hardened (its Definition of Done requires meaningful
      // coverage of logic + RLS). See .claude/docs/testing.md.
    },
  },
})

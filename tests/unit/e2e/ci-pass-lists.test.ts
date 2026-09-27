// @vitest-environment node
/**
 * Backstop for the CI e2e pass lists (Task 37, review Minor 3).
 *
 * The CI job signs the shared MC account in once and every `main`-pass
 * test reuses that session. A spec that signs out through the app revokes
 * it for every test after it, and those tests then fall back to the login
 * form and trip its rate limiter. Such a spec must be listed in
 * `SIGN_OUT_SPECS` or `SIGNED_OUT_SPECS`; this test fails when one is not.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { SIGN_OUT_SPECS, SIGNED_OUT_SPECS } from '@/tests/e2e/ci-pass-lists'

const E2E_DIR = path.resolve(__dirname, '../../e2e')

/** What a sign-out looks like in a spec: the helper, the client call, the button. */
const SIGN_OUT = [
  /\blogout\(/,
  /\bsignOut\(/,
  /['"`]Sign [Oo]ut['"`]/,
  /['"`]Log [Oo]ut['"`]/,
  /aside button['"`]\)\.last\(\)/,
]

const listed = [...SIGN_OUT_SPECS, ...SIGNED_OUT_SPECS].map((glob) => glob.replace('**/', ''))

describe('CI e2e pass lists', () => {
  it('every listed spec exists', () => {
    const specs = readdirSync(E2E_DIR)
    for (const file of listed) expect(specs).toContain(file)
  })

  it('no spec outside the lists signs out', () => {
    const offenders = readdirSync(E2E_DIR)
      .filter((file) => file.endsWith('.spec.ts') && !listed.includes(file))
      .filter((file) => {
        const source = readFileSync(path.join(E2E_DIR, file), 'utf8')
        return SIGN_OUT.some((pattern) => pattern.test(source))
      })
    expect(offenders).toEqual([])
  })

  it('the patterns catch the sign-out in navigation.spec.ts', () => {
    const source = readFileSync(path.join(E2E_DIR, 'navigation.spec.ts'), 'utf8')
    expect(SIGN_OUT.some((pattern) => pattern.test(source))).toBe(true)
  })
})

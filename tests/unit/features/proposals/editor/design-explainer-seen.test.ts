/**
 * The proposal design explainer's storage gate: it must be per account,
 * and it must fail towards showing the message rather than towards
 * crashing the editor.
 *
 * The per-user rule is not theoretical. A browser-global one-time flag
 * already swallowed the welcome tour for every account that signed up
 * after the first one on a shared machine: `signOut()` clears the auth
 * cookies and leaves `localStorage` exactly where it was.
 *
 * @module tests/unit/features/proposals/editor/design-explainer-seen
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { designExplainerKey, hasSeenDesignExplainer, markDesignExplainerSeen } from '@/features/proposals'

afterEach(() => {
  // Unstubbed first: a test that replaced `localStorage` with a throwing
  // stub has no `clear` on it.
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('design explainer gate', () => {
  it('starts unseen and remembers a dismissal', () => {
    expect(hasSeenDesignExplainer('user-a')).toBe(false)
    markDesignExplainerSeen('user-a')
    expect(hasSeenDesignExplainer('user-a')).toBe(true)
  })

  it('scopes the flag to the signed-in user, so the next account still gets told', () => {
    markDesignExplainerSeen('user-a')
    expect(hasSeenDesignExplainer('user-b')).toBe(false)
    expect(designExplainerKey('user-a')).not.toBe(designExplainerKey('user-b'))
    expect(designExplainerKey('user-a')).toContain('user-a')
  })

  it('shows the explainer again when there is no user to scope it to', () => {
    markDesignExplainerSeen(null)
    expect(hasSeenDesignExplainer(null)).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it('degrades to showing the explainer when storage throws, and never throws itself', () => {
    // A private window throws on access outright; a full quota throws on
    // write. Either way the editor must still open.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => markDesignExplainerSeen('user-a')).not.toThrow()
    expect(hasSeenDesignExplainer('user-a')).toBe(false)
  })
})

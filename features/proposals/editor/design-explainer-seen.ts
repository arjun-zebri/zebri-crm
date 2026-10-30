/**
 * Whether this account has already been told what the proposal design
 * editor is (founder, 2026-09-23: "when you click edit it should open it
 * up the way it is, but have a quick modal which explains that this is a
 * one time editor that wont affect the actual template").
 *
 * Pure functions, no React, so the gate can be tested on its own:
 * `design-explainer-modal.tsx` reads it on mount and writes it on
 * dismissal.
 *
 * Two rules the rest of the app learned the hard way:
 *
 * 1. The key is scoped by user id. `localStorage` outlives a session -
 *    `signOut()` clears the auth cookies, never storage - so a
 *    browser-global one-time flag hands the next account that signs in on
 *    that machine a "you have already seen this" it never earned. That
 *    exact bug swallowed the welcome tour for every new signup on a
 *    shared browser.
 * 2. Every read and write is wrapped. A private window throws on
 *    `localStorage` access outright, and a full quota throws on write.
 *    Unreadable storage degrades to showing the explainer again, never to
 *    crashing the editor it sits in front of.
 *
 * @module features/proposals/editor/design-explainer-seen
 */

const KEY_PREFIX = 'zebri:proposal-design-explainer'

/** The storage key holding one account's "already explained" flag. */
export function designExplainerKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`
}

/** The `localStorage` object, or `null` when it is absent or throws (private mode, blocked site data). */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * True when this account has already dismissed the explainer.
 *
 * `false` whenever we cannot tell: no signed-in user, no storage, or a
 * read that threw. Showing a short modal one extra time is the harmless
 * side of that trade; silently hiding the one sentence that says the
 * template is safe is not.
 */
export function hasSeenDesignExplainer(userId: string | null): boolean {
  if (!userId) return false
  try {
    return storage()?.getItem(designExplainerKey(userId)) === '1'
  } catch {
    return false
  }
}

/** Records that this account has seen the explainer. A no-op when there is no user or no writable storage. */
export function markDesignExplainerSeen(userId: string | null): void {
  if (!userId) return
  try {
    storage()?.setItem(designExplainerKey(userId), '1')
  } catch {
    // Nothing to do: the explainer simply shows again next time, which is
    // the safe failure for a reassurance message.
  }
}

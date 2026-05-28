/**
 * Couple Profile selection state + deep-link sync.
 *
 * Owns three concerns lifted out of `/couples/page.tsx` so the page
 * is a pure orchestrator:
 *
 * 1. **The currently-selected couple** (drives the profile modal).
 * 2. **Deep-link open** — `?openCouple=<id>` in the URL opens that
 *    couple's profile on first load, then strips the query param so
 *    the deep link is a one-shot, not a permanent open state.
 * 3. **Cache sync** — when the couples query refetches (e.g. after
 *    a mutation), the open profile re-binds to the fresh row so
 *    UI state matches the cache.
 *
 * The two `react-hooks/set-state-in-effect` disables below are
 * intentional and scoped here rather than in the page:
 * - The deep-link effect must read URL state on mount and write
 *   component state once.
 * - The cache-sync effect re-binds `selectedCouple` to the latest
 *   reference from the cache.
 * A future "URL is the source of truth for selection" rewrite could
 * drop both; doing so changes UX (URL flickers on open/close) and
 * is out of scope for Phase 4A.
 *
 * @module app/(dashboard)/couples/use-couple-profile-sync
 */
'use client';

import { useEffect, useState } from 'react';

import type { Couple } from '@/types/couple';

export interface UseCoupleProfileSyncResult {
  selectedCouple: Couple | null;
  setSelectedCouple: (couple: Couple | null) => void;
}

export function useCoupleProfileSync(
  couples: Couple[],
): UseCoupleProfileSyncResult {
  const [selectedCouple, setSelectedCouple] = useState<Couple | null>(null);

  // Deep-link open: read `?openCouple=<id>` once couples are loaded;
  // open the matching couple and strip the param. Uses
  // `window.location.search` directly rather than `useSearchParams()`
  // so we can mutate the URL via `history.replaceState` without a
  // re-render storm.
  useEffect(() => {
    if (!couples.length || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('openCouple');
    if (!openId) return;
    const match = couples.find((c) => c.id === openId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setSelectedCouple(match);
    params.delete('openCouple');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/couples?${qs}` : '/couples');
  }, [couples]);

  // Cache-sync: when `couples` updates (post-mutation), re-bind the
  // open profile to the latest row reference so UI matches cache.
  useEffect(() => {
    if (!selectedCouple) return;
    const fresh = couples.find((c) => c.id === selectedCouple.id);
    if (fresh && fresh !== selectedCouple) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCouple(fresh);
    }
  }, [couples, selectedCouple]);

  return { selectedCouple, setSelectedCouple };
}

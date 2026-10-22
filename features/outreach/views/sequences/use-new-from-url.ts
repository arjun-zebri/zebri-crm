'use client';

/**
 * Opens an editor when the URL asks for one, e.g. `?view=sequences&new=template`
 * from the Today setup guide, or `?view=campaigns&new=1`.
 *
 * The param is read once per value. Closing the editor strips it, so a
 * refresh or a back-forward does not reopen a blank editor the founder
 * already dismissed.
 *
 * @module features/outreach/views/sequences/use-new-from-url
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/** The tab whose URL this hook rewrites when the editor closes. */
export type OutreachTab = 'sequences' | 'campaigns';

/**
 * @param view - The tab the editor belongs to. Used to rebuild the clean URL on close.
 * @param ready - False while the data the editor needs is still loading. Opening earlier would
 *   hand the editor an empty sequence list that never refreshes.
 * @param onNew - Called once with the `new` value (for example `template` or `1`).
 * @returns A function the caller runs when the editor closes. It strips the `new` param.
 */
export function useNewFromUrl(
  view: OutreachTab,
  ready: boolean,
  onNew: (value: string) => void,
): () => void {
  const params = useSearchParams();
  const router = useRouter();
  const value = params.get('new');
  // Why: the value we already acted on. Keeps the effect from reopening the editor on every render.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!value) {
      handled.current = null;
      return;
    }
    if (!ready || handled.current === value) return;
    handled.current = value;
    onNew(value);
  }, [value, ready, onNew]);

  return useCallback(() => {
    // Why: only rewrite when the param is actually there, so closing a normal editor does not push history.
    if (params.get('new')) router.replace(`/admin/outreach?view=${view}`);
  }, [params, router, view]);
}

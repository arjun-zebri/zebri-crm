'use client';

/**
 * The Prospects page's URL contract. Everything the page can show that
 * is not local UI state lives in `?view=prospects` plus these params:
 *
 * - `board=1`   the pipeline board instead of the table
 * - `review=1`  the needs-review queue in place of the table
 * - `import=1`  the import wizard open
 * - `check=1`   the start-a-check modal open
 * - `prospect=` the prospect modal open
 *
 * Params live in the URL so the Today setup guide can deep-link into a
 * modal and so back/forward and a reload land where the founder was.
 *
 * @module features/outreach/views/prospects/use-prospects-url
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/** Patch for {@link useProspectsUrl}.setParams: `null` removes the key. */
export type ProspectsParamPatch = Partial<Record<'board' | 'review' | 'import' | 'check' | 'prospect', string | null>>;

/**
 * Read the Prospects URL params and write changes back.
 *
 * Opening a modal or mode pushes a history entry, so the phone Back button
 * closes it instead of leaving Outreach. Clearing a param replaces, so
 * closing does not add a stray entry on top.
 */
export function useProspectsUrl() {
  const router = useRouter();
  const params = useSearchParams();

  const setParams = useCallback(
    (patch: ProspectsParamPatch) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const opening = Object.values(patch).some((v) => v !== null && v !== undefined);
      const href = `/admin/outreach${qs ? `?${qs}` : ''}`;
      // Why scroll:false: opening a modal must not jump the page to the top.
      if (opening) router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [params, router],
  );

  return {
    setParams,
    board: params.get('board') === '1',
    // Review is a mode of the table, so the board wins if both are present.
    review: params.get('review') === '1' && params.get('board') !== '1',
    importing: params.get('import') === '1',
    checking: params.get('check') === '1',
    openId: params.get('prospect'),
  };
}

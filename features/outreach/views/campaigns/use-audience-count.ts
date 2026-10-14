'use client';

/**
 * Live count of celebrants an audience would reach. Shared by the
 * audience inputs in the editor and the Activate confirmation, so both
 * show the same number.
 *
 * @module features/outreach/views/campaigns/use-audience-count
 */
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/features/outreach/action-result';
import { countAudienceAction } from '@/features/outreach/actions';
import { OUTREACH_KEY } from '@/features/outreach/hooks';

import type { AudiencePayload } from './campaign-draft';

/**
 * @param audience - The audience to count. Compared by value, not identity.
 * @param enabled - Set false to skip the query (for example while a debounce is pending).
 */
export function useAudienceCount(audience: AudiencePayload, enabled = true) {
  // Why: the key is a string so two equal audiences share one cache entry, even when the caller builds a new object each render.
  const key = JSON.stringify(audience);
  return useQuery({
    queryKey: [OUTREACH_KEY, 'audience', key],
    queryFn: async () => unwrap(await countAudienceAction(JSON.parse(key) as AudiencePayload)),
    enabled,
  });
}

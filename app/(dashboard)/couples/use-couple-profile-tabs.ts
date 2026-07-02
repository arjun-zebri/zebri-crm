/**
 * React Query access to the per-user couple-profile tab layout.
 *
 * The layout (hidden tabs, order, default tab) is global across couples and
 * changes rarely, so it is fetched once with an infinite stale time and cached
 * under a single key. Saving updates the cache via `setQueryData` so every open
 * couple profile reflects the change immediately.
 *
 * Co-located with the couple profile (not in `lib/`) because it depends on the
 * profile's server actions and section types.
 *
 * @module app/(dashboard)/couples/use-couple-profile-tabs
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEFAULT_TABS_CONFIG,
  type CoupleProfileTabsConfig,
} from './couple-profile-types';
import {
  readCoupleProfileTabsConfigAction,
  updateCoupleProfileTabsConfigAction,
} from './profile-settings-actions';

/** Shared cache key for the single per-user tab layout. */
const QUERY_KEY = ['couple-profile-tabs-config'] as const;

/**
 * Returns the MC's tab layout (defaulted while loading or on error) plus a
 * `saveConfig` mutation. Consumers treat `config` as always present.
 */
export function useCoupleProfileTabsConfig() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => readCoupleProfileTabsConfigAction(),
    staleTime: Infinity,
  });

  const saveConfig = useMutation({
    mutationFn: async (next: CoupleProfileTabsConfig) => {
      const result = await updateCoupleProfileTabsConfigAction(next);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, { ok: true, data: saved });
    },
  });

  return {
    config: data?.ok ? data.data : DEFAULT_TABS_CONFIG,
    saveConfig,
  };
}

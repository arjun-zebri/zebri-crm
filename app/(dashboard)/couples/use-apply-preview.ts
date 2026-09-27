'use client';

/**
 * The Start preview's data: `previewApplyAction` for one workflow on one
 * couple, fetched only while a workflow is chosen.
 *
 * @module app/(dashboard)/couples/use-apply-preview
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { previewApplyAction } from '@/app/(dashboard)/workflows/instance-actions';
import type { ApplyPreview } from '@/lib/workflows/apply-projection';

/**
 * The preview query for `templateId` on `coupleId`.
 *
 * @param templateId - the chosen workflow, or null for none (no fetch)
 * @param coupleId - the couple it would start on
 */
export function useApplyPreview(
  templateId: string | null,
  coupleId: string,
): UseQueryResult<ApplyPreview> {
  return useQuery({
    enabled: templateId !== null,
    queryKey: ['workflow-apply-preview', templateId, coupleId],
    // Never cached across opens: the dates are "from now", and the
    // couple's wedding date may have changed since the last look.
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const res = await previewApplyAction({ templateId: templateId ?? '', coupleId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });
}

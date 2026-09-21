'use client';

/**
 * The account's proposal templates, as one shared React Query. Every
 * surface that lists templates (`TemplatesGrid` in the /templates hub,
 * the cards on `/proposals`, and the `/proposals` page itself for its
 * empty-state decision) reads through this hook so they share a cache
 * entry and every mutation's invalidation reaches all of them.
 *
 * @module app/(dashboard)/proposals/templates/use-proposal-templates
 */
import { useQuery } from '@tanstack/react-query';

import { ensureDefaultTemplateAction, listTemplatesAction } from '@/features/proposals';

import { TEMPLATES_QUERY_KEY } from './use-template-mutations';

/**
 * Ensures the default template exists (first visit creates or migrates
 * it), then lists every template.
 *
 * @param enabled - `false` keeps the query idle (Layout v2 off: no template surface is shown, so nothing should be created either).
 */
export function useProposalTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const ensured = await ensureDefaultTemplateAction();
      if (!ensured.ok) throw new Error(ensured.error);
      const listed = await listTemplatesAction();
      if (!listed.ok) throw new Error(listed.error);
      return listed.templates;
    },
  });
}

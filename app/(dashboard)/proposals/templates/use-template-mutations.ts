'use client';

/**
 * The Templates tab's write operations (create / set default / duplicate /
 * delete), each wired to the shared `['proposal-templates']`
 * query and a failure toast. Pulled out of `templates-list.tsx` to keep
 * that file an orchestrator - this hook owns nothing about layout or the
 * New template flow's step machine (`use-new-template-flow.ts`).
 *
 * @module app/(dashboard)/proposals/templates/use-template-mutations
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/toast';
import {
  createTemplateAction, deleteTemplateAction, duplicateTemplateAction, setDefaultTemplateAction,
  type ProposalLayout,
} from '@/features/proposals';

/** The React Query key the Templates tab's list and every mutation below invalidate/act through. */
export const TEMPLATES_QUERY_KEY = ['proposal-templates'] as const;

// No hand-written return-shape interface: each `useMutation` call below
// already carries its own precise `TData`/`TVariables` inferred from its
// `mutationFn`, and re-declaring that shape by hand (as an earlier version
// of this file did) drifted from `useMutation`'s actual `TError` default
// and broke under `tsc`. Let inference stand; `UseTemplateMutationsReturn`
// is exported as a type query on the function itself for anyone who needs
// to name the shape.
export type UseTemplateMutationsReturn = ReturnType<typeof useTemplateMutations>;

/**
 * @param onCreated - fired with the new template's id once `create` succeeds (the caller closes the New template flow and navigates to the editor).
 * @param onDeleted - fired once `remove` settles (ok or failed), so the caller can clear its pending-delete confirmation state either way.
 */
export function useTemplateMutations(onCreated: (id: string) => void, onDeleted: () => void) {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const refresh = () => qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
  const fail = (error: string) => toast(error, 'error');
  // A rejected server action resolves with `{ ok: false, error }` (handled
  // by each mutation's onSuccess below) and never throws, but the action
  // itself can still throw (a network failure); that must surface too, or
  // it fails completely silently.
  const failFromError = (e: unknown) => fail(e instanceof Error ? e.message : 'Something went wrong');

  const create = useMutation({
    mutationFn: (input: { name: string; layout: ProposalLayout }) => createTemplateAction(input),
    onSuccess: (r) => {
      if (!r.ok) return fail(r.error);
      void refresh();
      onCreated(r.template.id);
      router.push(`/proposals/templates/${r.template.id}`);
    },
    onError: failFromError,
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultTemplateAction({ id }),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
    onError: failFromError,
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateTemplateAction({ id }),
    onSuccess: (r) => {
      if (!r.ok) return fail(r.error);
      toast('Template duplicated', 'success');
      refresh();
    },
    onError: failFromError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplateAction({ id }),
    onSuccess: (r) => {
      onDeleted();
      if (r.ok) refresh();
      else fail(r.error);
    },
    onError: (e) => {
      onDeleted();
      failFromError(e);
    },
  });

  return { create, setDefault, duplicate, remove };
}

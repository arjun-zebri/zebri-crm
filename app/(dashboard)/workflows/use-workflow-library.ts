'use client';

/**
 * Data hook for the Workflows template library.
 *
 * One batched read behind React Query, plus the mutations the library
 * offers. Every mutation invalidates the same key, so the list is the
 * single source of truth on screen and no component keeps its own copy
 * of a template row.
 *
 * @module app/(dashboard)/workflows/use-workflow-library
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TagColor } from '@/types/workflows';

import {
  createWorkflowTagAction,
  createWorkflowTemplateAction,
  deleteTemplateAction,
  deleteWorkflowTagAction,
  duplicateTemplateAction,
  loadWorkflowsLibraryAction,
  setTemplateStatusAction,
  setTemplateTagsAction,
  updateWorkflowTagAction,
  type TemplateListRow,
  type WorkflowsLibraryPayload,
} from './actions';

const LIBRARY_KEY = ['workflow-library'] as const;

export interface WorkflowLibrary {
  templates: TemplateListRow[];
  tags: { id: string; name: string; color: string; position: number }[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createTemplate: (name: string) => Promise<string | null>;
  duplicateTemplate: (templateId: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  setStatus: (templateId: string, status: 'draft' | 'active' | 'archived') => Promise<void>;
  setTags: (templateId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: TagColor) => Promise<void>;
  updateTag: (tagId: string, patch: { name?: string; color?: TagColor }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
}

/** Load the library and expose its mutations. */
export function useWorkflowLibrary(): WorkflowLibrary {
  const queryClient = useQueryClient();

  const query = useQuery<WorkflowsLibraryPayload>({
    queryKey: LIBRARY_KEY,
    queryFn: async () => {
      const res = await loadWorkflowsLibraryAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
  };

  const createTemplate = useMutation({
    mutationFn: async (name: string) => {
      const res = await createWorkflowTemplateAction({
        name,
        applyRuleType: 'manual',
        applyRuleConfig: {},
      });
      if (!res.ok) throw new Error(res.error);
      return res.data.id;
    },
    onSuccess: invalidate,
  });

  /**
   * Every other mutation shares one hook and dispatches on `op`.
   *
   * One `useMutation` rather than nine: a helper that wrapped
   * `useMutation` would be calling a hook from a plain function, which
   * the rules of hooks forbid, and nine near-identical hook calls is
   * noise. The union keeps each call site type-safe.
   */
  const mutate = useMutation({
    mutationFn: async (input: LibraryMutation) => {
      const res = await runMutation(input);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
  });

  return {
    templates: query.data?.templates ?? [],
    tags: query.data?.tags ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    refetch: () => void query.refetch(),
    createTemplate: async (name) => {
      try {
        return await createTemplate.mutateAsync(name);
      } catch {
        return null;
      }
    },
    duplicateTemplate: (templateId) => mutate.mutateAsync({ op: 'duplicate', templateId }),
    deleteTemplate: (templateId) => mutate.mutateAsync({ op: 'delete', templateId }),
    setStatus: (templateId, status) => mutate.mutateAsync({ op: 'status', templateId, status }),
    setTags: (templateId, tagIds) => mutate.mutateAsync({ op: 'tags', templateId, tagIds }),
    createTag: (name, color) => mutate.mutateAsync({ op: 'createTag', name, color }),
    updateTag: (tagId, patch) => mutate.mutateAsync({ op: 'updateTag', tagId, ...patch }),
    deleteTag: (tagId) => mutate.mutateAsync({ op: 'deleteTag', tagId }),
  };
}

/** Every library mutation other than "create template". */
type LibraryMutation =
  | { op: 'duplicate'; templateId: string }
  | { op: 'delete'; templateId: string }
  | { op: 'status'; templateId: string; status: 'draft' | 'active' | 'archived' }
  | { op: 'tags'; templateId: string; tagIds: string[] }
  | { op: 'createTag'; name: string; color: TagColor }
  | { op: 'updateTag'; tagId: string; name?: string; color?: TagColor }
  | { op: 'deleteTag'; tagId: string };

/** Route one {@link LibraryMutation} to its server action. */
async function runMutation(
  input: LibraryMutation,
): Promise<{ ok: true } | { ok: false; error: string }> {
  switch (input.op) {
    case 'duplicate': {
      const res = await duplicateTemplateAction({ templateId: input.templateId });
      return res.ok ? { ok: true } : res;
    }
    case 'delete':
      return normalise(await deleteTemplateAction({ templateId: input.templateId }));
    case 'status':
      return normalise(
        await setTemplateStatusAction({
          templateId: input.templateId,
          status: input.status,
        }),
      );
    case 'tags':
      return normalise(
        await setTemplateTagsAction({
          templateId: input.templateId,
          tagIds: input.tagIds,
        }),
      );
    case 'createTag': {
      const res = await createWorkflowTagAction({ name: input.name, color: input.color });
      return res.ok ? { ok: true } : res;
    }
    case 'updateTag':
      return normalise(
        await updateWorkflowTagAction({
          tagId: input.tagId,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        }),
      );
    case 'deleteTag':
      return normalise(await deleteWorkflowTagAction({ tagId: input.tagId }));
  }
}

/** Drop an action result's payload, keeping only success or the error. */
function normalise(
  res: { ok: true; data: unknown } | { ok: false; error: string },
): { ok: true } | { ok: false; error: string } {
  return res.ok ? { ok: true } : res;
}

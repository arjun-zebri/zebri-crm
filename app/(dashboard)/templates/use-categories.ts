/**
 * React Query hooks for email-template categories.
 *
 * The list query runs through `listCategoriesAction`, which lazily
 * seeds the six defaults for a first-time account. Mutations keep both
 * the category cache and the template cache fresh (deleting a category
 * changes templates' grouping).
 *
 * @module app/(dashboard)/templates/use-categories
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { EmailTemplateCategory } from '@/types/email-template'

import {
  createCategoryAction,
  deleteCategoryAction,
  listCategoriesAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from './category-actions'

const KEY = ['email-template-categories'] as const
const TEMPLATES_KEY = ['email-templates'] as const

/** Throw on a failed action so React Query routes it to `onError`. */
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

/** The MC's categories, ordered by position (defaults seeded on first load). */
export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => unwrap(await listCategoriesAction()),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) =>
      unwrap(await createCategoryAction(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: string }) =>
      unwrap(await updateCategoryAction(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteCategoryAction(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      // Templates in the deleted category became uncategorised.
      void qc.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}

export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => unwrap(await reorderCategoriesAction(ids)),
    // Optimistic: the manager already shows the new order; snap the
    // cache to it so the list doesn't flicker back while refetching.
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<EmailTemplateCategory[]>(KEY)
      if (prev) {
        const byId = new Map(prev.map((c) => [c.id, c]))
        qc.setQueryData(
          KEY,
          ids.map((id, i) => ({ ...byId.get(id)!, position: i })).filter(Boolean),
        )
      }
      return { prev }
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

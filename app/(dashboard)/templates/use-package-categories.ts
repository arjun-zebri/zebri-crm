/**
 * React Query hooks for package categories.
 *
 * The packages counterpart to `use-categories.ts`. Mutations keep both
 * the category cache and the packages cache fresh (deleting a category
 * changes packages' grouping). No default seeding — the list starts
 * empty for every account.
 *
 * @module app/(dashboard)/templates/use-package-categories
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { PackageCategory } from '@/types/package'

import {
  createPackageCategoryAction,
  deletePackageCategoryAction,
  listPackageCategoriesAction,
  reorderPackageCategoriesAction,
  updatePackageCategoryAction,
} from './package-category-actions'

const KEY = ['package-categories'] as const
const PACKAGES_KEY = ['packages'] as const

/** Throw on a failed action so React Query routes it to `onError`. */
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

/** The MC's package categories, ordered by position. */
export function usePackageCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => unwrap(await listPackageCategoriesAction()),
  })
}

export function useCreatePackageCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) =>
      unwrap(await createPackageCategoryAction(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePackageCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; color: string }) =>
      unwrap(await updatePackageCategoryAction(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePackageCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deletePackageCategoryAction(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      // Packages in the deleted category became uncategorised.
      void qc.invalidateQueries({ queryKey: PACKAGES_KEY })
    },
  })
}

export function useReorderPackageCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => unwrap(await reorderPackageCategoriesAction(ids)),
    // Optimistic: the manager already shows the new order; snap the
    // cache to it so the list doesn't flicker back while refetching.
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<PackageCategory[]>(KEY)
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

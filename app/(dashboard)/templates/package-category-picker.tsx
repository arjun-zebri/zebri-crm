/**
 * Category control for the package edit modal.
 *
 * Thin data wrapper: wires the presentational
 * {@link CategoryPickerBase} to the package category hooks
 * (`use-package-categories.ts`). See the base for the full UI
 * behaviour.
 *
 * @module app/(dashboard)/templates/package-category-picker
 */
'use client'

import { useToast } from '@/components/ui/toast'

import { CategoryPickerBase } from './category-picker-base'
import {
  useCreatePackageCategory,
  useDeletePackageCategory,
  usePackageCategories,
  useReorderPackageCategories,
  useUpdatePackageCategory,
} from './use-package-categories'

interface PackageCategoryPickerProps {
  /** Selected category id (`null` = no category). */
  value: string | null
  onChange: (id: string | null) => void
}

export function PackageCategoryPicker({ value, onChange }: PackageCategoryPickerProps) {
  const { toast } = useToast()
  const { data: categories = [] } = usePackageCategories()
  const create = useCreatePackageCategory()
  const update = useUpdatePackageCategory()
  const remove = useDeletePackageCategory()
  const reorder = useReorderPackageCategories()

  return (
    <CategoryPickerBase
      value={value}
      onChange={onChange}
      categories={categories}
      createPending={create.isPending}
      onCreate={(input) => create.mutateAsync(input)}
      onUpdate={(input) =>
        update.mutate(input, {
          onError: () => toast('Could not save the category', 'error'),
        })
      }
      onDelete={(id) =>
        remove.mutate(id, {
          onError: () => toast('Could not delete the category', 'error'),
        })
      }
      onReorder={(ids) => reorder.mutate(ids)}
    />
  )
}

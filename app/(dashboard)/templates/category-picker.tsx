/**
 * Category control for the email-template editor.
 *
 * Thin data wrapper: wires the presentational
 * {@link CategoryPickerBase} to the email-template category hooks
 * (`use-categories.ts`). See the base for the full UI behaviour.
 *
 * @module app/(dashboard)/templates/category-picker
 */
'use client'

import { useToast } from '@/components/ui/toast'

import { CategoryPickerBase } from './category-picker-base'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from './use-categories'

interface CategoryPickerProps {
  /** Selected category id (`null` = no category). */
  value: string | null
  onChange: (id: string | null) => void
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const { toast } = useToast()
  const { data: categories = [] } = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const reorder = useReorderCategories()

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

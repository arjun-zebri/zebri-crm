'use client'

import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Editor-only chrome for a block that holds a list (testimonials, steps, FAQ,
 * gallery tiles): a remove control on each item and an add button after the
 * list. Both stop propagation so clicking them never selects or deselects
 * the block. The `max` guard is what enforces the gallery's 12-image cap.
 */
export function RemoveItemButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      iconOnly
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onRemove()
      }}
      className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
    >
      <X size={14} strokeWidth={1.5} />
    </Button>
  )
}

/** Appends a new item to the list. Hidden once `count` reaches `max`, when given. */
export function AddItemButton({
  onAdd,
  label,
  count,
  max,
}: {
  onAdd: () => void
  label: string
  count: number
  max?: number
}) {
  if (max !== undefined && count >= max) return null
  return (
    <Button
      variant="secondary"
      onClick={(e) => {
        e.stopPropagation()
        onAdd()
      }}
      className="gap-1.5 mt-3"
    >
      <Plus size={14} strokeWidth={1.5} />
      {label}
    </Button>
  )
}

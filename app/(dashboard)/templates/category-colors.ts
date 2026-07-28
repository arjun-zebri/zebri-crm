/**
 * Category colour-key → Tailwind class map.
 *
 * Categories store a named palette key (see `CATEGORY_COLOR_KEYS`);
 * this maps each key to the chip / dot classes the library and picker
 * render. Named-palette utilities only — never arbitrary hex — so the
 * `zebri/no-off-token-color` rule stays clean.
 *
 * @module app/(dashboard)/templates/category-colors
 */

import type { CategoryColor } from '@/types/email-template'

interface CategoryColorClasses {
  /** Small round swatch (picker rows + colour choices). */
  dot: string
  /** Label chip (library headers + preview chip). */
  chip: string
}

export const CATEGORY_COLOR_CLASSES: Record<CategoryColor, CategoryColorClasses> = {
  slate: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  rose: { dot: 'bg-rose-400', chip: 'bg-rose-100 text-rose-700' },
  amber: { dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-800' },
  emerald: { dot: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
  sky: { dot: 'bg-sky-400', chip: 'bg-sky-100 text-sky-700' },
  violet: { dot: 'bg-violet-400', chip: 'bg-violet-100 text-violet-700' },
  pink: { dot: 'bg-pink-400', chip: 'bg-pink-100 text-pink-700' },
  stone: { dot: 'bg-stone-400', chip: 'bg-stone-100 text-stone-700' },
}

/** Classes for a colour key, tolerating unknown values from old rows. */
export function categoryColorClasses(color: string): CategoryColorClasses {
  return CATEGORY_COLOR_CLASSES[color as CategoryColor] ?? CATEGORY_COLOR_CLASSES.slate
}

import { createIcon } from './icon-base';

/**
 * Family tree glyph: two heads joined by a line, and a line down from it
 * to a third below: someone's parents. For the parents' parts of the
 * couple's BDM form (user, 2026-10-15: a crowd of three read as guests,
 * and two side by side is Clients).
 *
 * @example
 * ```tsx
 * <FamilyTreeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/family-tree
 */
export const FamilyTreeIcon = createIcon(
  'FamilyTreeIcon',
  'glyph',
  <>
    <circle cx="6.5" cy="7" r="2.5" />
    <circle cx="17.5" cy="7" r="2.5" />
    <path d="M9 7h6M12 7v7" />
    <circle cx="12" cy="17" r="2.5" />
  </>,
);

import { createIcon } from './icon-base';

/**
 * Branch glyph: a step node whose path splits into two ends. For a journey branch.
 *
 * @example
 * ```tsx
 * <BranchIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/branch
 */
export const BranchIcon = createIcon(
  'BranchIcon',
  'glyph',
  <>
    <circle cx="5.5" cy="12" r="2" />
    <path d="M7.5 12H9a3 3 0 0 0 3-3 3 3 0 0 1 3-3h1.5M9 12a3 3 0 0 1 3 3 3 3 0 0 0 3 3h1.5" />
    <circle cx="18.5" cy="6" r="2" />
    <circle cx="18.5" cy="18" r="2" />
  </>,
);

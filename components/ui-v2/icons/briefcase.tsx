import { createIcon } from './icon-base';

/**
 * Briefcase glyph: a soft case with an arched handle and a band. For work, business or a role.
 *
 * @example
 * ```tsx
 * <BriefcaseIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/briefcase
 */
export const BriefcaseIcon = createIcon(
  'BriefcaseIcon',
  'glyph',
  <>
    <rect x="3" y="6.5" width="18" height="14" rx="4" />
    <path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" />
    <path d="M3 12.5h18" />
  </>,
);

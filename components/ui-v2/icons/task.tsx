import { createIcon } from './icon-base';

/**
 * Task glyph: a soft square with a tick. For a to-do the MC does themselves.
 *
 * @example
 * ```tsx
 * <TaskIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/task
 */
export const TaskIcon = createIcon(
  'TaskIcon',
  'glyph',
  <>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="m8.5 12.25 2.5 2.5 4.5-5" />
  </>,
);

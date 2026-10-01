import type { ReactNode } from 'react';

/**
 * Design system v2 keyboard key (preview): shows a shortcut, e.g.
 * "Press ⏎ to continue". Semantic `<kbd>`, so assistive tech reads it
 * as keyboard input.
 *
 * @example
 * ```tsx
 * <Kbd>⌘</Kbd><Kbd>⏎</Kbd>
 * ```
 *
 * @module components/ui-v2/kbd
 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-check border border-zebra-200 bg-field px-1 font-sans type-label text-zebra-600 shadow-[0_1px_0_var(--color-zebra-200)]">
      {children}
    </kbd>
  );
}

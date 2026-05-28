/**
 * Keyboard shortcuts for the `/couples` page.
 *
 * - **Esc** clears multi-select (when any couples are selected).
 * - **n** opens the add-couple modal (unless the focus is in a text
 *   input — typing "n" into the search box must not steal focus).
 *
 * Extracted from `page.tsx` so the orchestrator stays composition-
 * only and the shortcut behaviour can be tested in isolation.
 *
 * @module app/(dashboard)/couples/use-couples-shortcuts
 */
'use client';

import { useEffect } from 'react';

export interface UseCouplesShortcutsArgs {
  hasSelection: boolean;
  onClearSelection: () => void;
  onAdd: () => void;
}

export function useCouplesShortcuts({
  hasSelection,
  onClearSelection,
  onAdd,
}: UseCouplesShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasSelection) {
        onClearSelection();
        return;
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onAdd();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSelection, onClearSelection, onAdd]);
}

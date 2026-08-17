/**
 * Keyboard shortcuts for the `/couples` page.
 *
 * - **Esc** clears multi-select (when any couples are selected).
 *
 * The old **n** = add-couple shortcut was removed (2026-08-17): its
 * input guard missed contenteditable surfaces (rich-text editors), so
 * typing "n" mid-sentence could steal focus into the add modal.
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
}

export function useCouplesShortcuts({
  hasSelection,
  onClearSelection,
}: UseCouplesShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasSelection) {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSelection, onClearSelection]);
}

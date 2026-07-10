/**
 * Page-scoped keyboard shortcuts for /payments.
 *
 * - `/` (outside an input/textarea) focuses the search box.
 * - `Escape` while the search box has focus clears all per-tab
 *   searches + blurs the input.
 *
 * Extracted so the orchestrator stays readable + the shortcut
 * surface can be unit-tested in isolation.
 *
 * @module app/(dashboard)/payments/use-payments-shortcut
 */
'use client';

import { type RefObject, useEffect } from 'react';

export type PaymentsTab = 'proposals' | 'quotes' | 'invoices' | 'contracts';

export interface UsePaymentsShortcutOptions {
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Called on Escape inside the search box — used to clear the
   *  active tab's search state in the parent. */
  onClearSearch: () => void;
}

export function usePaymentsShortcut({
  searchInputRef,
  onClearSearch,
}: UsePaymentsShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement;
        // Don't steal focus when the user is already typing in some
        // other input (couple search, modal field, etc.).
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        return;
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onClearSearch();
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchInputRef, onClearSearch]);
}

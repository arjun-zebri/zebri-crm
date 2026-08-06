/**
 * Tiny inline status indicator for the auto-saving settings sections.
 * Replaces the old explicit Save buttons: fields persist on blur /
 * change, and this shows a calm "Saving… / Saved" hint instead of a
 * toast on every edit (errors still toast at the call site).
 *
 * @module app/(dashboard)/settings/auto-save-status
 */
'use client';

import { Check, Loader2 } from 'lucide-react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function AutoSaveStatus({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-subtle">
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-subtle">
        <Check size={13} strokeWidth={1.5} />
        Saved
      </span>
    );
  }
  if (state === 'error') {
    return <span className="text-xs text-red-500">Couldn’t save. Try again</span>;
  }
  return null;
}

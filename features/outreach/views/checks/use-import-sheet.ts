'use client';

/**
 * Mutations behind the import wizard.
 *
 * Parse and preview are reads, so they use plain `useMutation` and do
 * not invalidate every outreach query. Only the final import goes
 * through {@link useOutreachMutation} (it changes data).
 *
 * @module features/outreach/views/checks/use-import-sheet
 */
import { useMutation } from '@tanstack/react-query';

import { useToast } from '@/components/ui/toast';
import { unwrap } from '@/features/outreach/action-result';
import { importSheetAction, parseSheetAction, previewImportAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import type { SheetMapping } from '@/lib/outreach/import/sheet';

/** Input to the preview and import actions: the CSV text plus the mapping. */
export interface ImportInput {
  csv: string;
  mapping: SheetMapping;
}

/**
 * The three import mutations, in wizard order: parse the file, preview
 * the merge, then import for real.
 *
 * @returns `parse`, `preview` and `importer` react-query mutations.
 */
export function useImportSheet() {
  const { toast } = useToast();
  const parse = useMutation({
    mutationFn: async (csv: string) => unwrap(await parseSheetAction(csv)),
    onError: (err: Error) => toast(err.message, 'error'),
  });
  const preview = useMutation({
    mutationFn: async (input: ImportInput) => unwrap(await previewImportAction(input)),
    onError: (err: Error) => toast(err.message, 'error'),
  });
  const importer = useOutreachMutation(importSheetAction, (o) =>
    o.inserted === 0 && o.merged === 0
      ? 'Nothing new to add'
      : `Added ${o.inserted}, updated ${o.merged}`,
  );
  return { parse, preview, importer };
}

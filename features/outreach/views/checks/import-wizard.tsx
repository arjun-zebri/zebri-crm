'use client';

/**
 * Import wizard: choose a CSV, map its columns, preview, then import.
 *
 * Three steps share one fixed-height modal body so the dialog does not
 * jump as the founder moves through it. Step state lives here; each
 * step is a presentational component.
 *
 * @module features/outreach/views/checks/import-wizard
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { SheetMapping } from '@/lib/outreach/import/sheet';

import { ImportFileStep } from './import-file-step';
import { ImportMappingStep } from './import-mapping-step';
import { ImportPreviewStep } from './import-preview-step';
import { hasNameMapping } from './sheet-field-labels';
import { useImportSheet } from './use-import-sheet';

type Step = 'file' | 'map' | 'preview';

/** Shape the parse action returns for a chosen file. */
interface Parsed {
  headers: string[];
  sample: string[][];
  rowCount: number;
  mapping: SheetMapping;
}

/** Preview counts from `previewImportAction`. */
interface Preview {
  newCount: number;
  mergeCount: number;
  skipped: number;
  skippedNoName: number;
}

/**
 * The import modal. Rendered only while open, so every open starts at
 * step one with a clean slate.
 *
 * @param props.onClose - Called on close, cancel, or after a successful import.
 */
export function ImportWizard({ onClose }: { onClose: () => void }) {
  const { parse, preview, importer } = useImportSheet();
  const [step, setStep] = useState<Step>('file');
  const [csv, setCsv] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<SheetMapping | null>(null);
  const [counts, setCounts] = useState<Preview | null>(null);

  async function chooseFile(text: string) {
    try {
      const data = await parse.mutateAsync(text);
      setCsv(text);
      setParsed(data);
      setMapping(data.mapping);
      setStep('map');
    } catch {
      // The mutation's onError already toasted the message.
    }
  }

  async function goToPreview() {
    if (!csv || !mapping) return;
    try {
      setCounts(await preview.mutateAsync({ csv, mapping }));
      setStep('preview');
    } catch {
      // Toasted by the mutation.
    }
  }

  async function runImport() {
    if (!csv || !mapping) return;
    try {
      await importer.mutateAsync({ csv, mapping });
      onClose();
    } catch {
      // Toasted by the mutation; stay on the preview so the founder can retry.
    }
  }

  const mappable = !!mapping && hasNameMapping(mapping);

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title="Import celebrants"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button variant="ghost" onClick={step === 'file' ? onClose : () => setStep(step === 'preview' ? 'map' : 'file')}>
            {step === 'file' ? 'Cancel' : 'Back'}
          </Button>
          {step === 'map' && (
            <Button onClick={goToPreview} disabled={!mappable} loading={preview.isPending}>
              Preview import
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={runImport} loading={importer.isPending}>
              Import
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col h-[min(30rem,70vh)]">
        {step === 'file' && <ImportFileStep onChoose={chooseFile} loading={parse.isPending} />}
        {step === 'map' && parsed && mapping && (
          <ImportMappingStep parsed={parsed} mapping={mapping} onChange={setMapping} />
        )}
        {step === 'preview' && counts && <ImportPreviewStep counts={counts} />}
      </div>
    </Modal>
  );
}

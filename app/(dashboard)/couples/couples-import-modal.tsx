'use client';

import { useMemo, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import {
  applyMapping,
  buildImportPreview,
  guessMapping,
  parseCsvGrid,
  type ColumnMapping,
  type CsvGrid,
  type ImportCoupleValues,
  type ImportPreview,
} from '@/lib/utils/csv-import';
import type { CoupleStatusRecord } from '@/types/couple';

import type { CoupleInput } from './actions';
import { CouplesImportMapping } from './couples-import-mapping';
import { CouplesImportPreview } from './couples-import-preview';
import { CouplesImportUpload } from './couples-import-upload';

interface CouplesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: CoupleStatusRecord[];
  /** Existing couples (name + primary email) for duplicate detection. */
  existing: { name: string; primary_email?: string | null }[];
  /** Slug applied when a row's status is blank or unrecognized. */
  defaultStatusSlug: string;
  importing: boolean;
  /** Hands the chosen rows to the page, which owns the mutation +
   *  toast + cap handling. Resolves once the import settles. */
  onImport: (rows: CoupleInput[]) => Promise<void>;
}

type Step = 'upload' | 'map' | 'preview';

/**
 * Three-step "Import from CSV" modal: upload a file, map its columns to
 * Zebri fields, then confirm a preview of which rows import. Parsing,
 * mapping, validation, and dedup live in `lib/utils/csv-import`; this
 * component drives them and maps the result onto the couple-create
 * input shape.
 *
 * @module app/(dashboard)/couples/couples-import-modal
 */
export function CouplesImportModal({
  isOpen,
  onClose,
  statuses,
  existing,
  defaultStatusSlug,
  importing,
  onImport,
}: CouplesImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | undefined>();
  // The full cell matrix (header row included) so the header toggle can
  // re-slice without re-reading the file.
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [columnCount, setColumnCount] = useState(0);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh state per open is handled by a remount `key` in the parent.

  const statusLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of statuses) {
      map.set(s.slug.toLowerCase(), s.slug);
      map.set(s.name.toLowerCase(), s.slug);
    }
    return map;
  }, [statuses]);

  /** Build a grid view of the current matrix for the chosen header mode. */
  function gridFor(rows: string[][], header: boolean): CsvGrid {
    return header
      ? { headers: rows[0] ?? [], rows: rows.slice(1), columnCount }
      : { headers: null, rows, columnCount };
  }

  async function handleFile(file: File) {
    const grid = parseCsvGrid(await file.text());
    setFileName(file.name);
    if (grid.rows.length === 0 && !grid.headers) {
      setFileError('That file has no rows to import.');
      return;
    }
    const matrix = grid.headers ? [grid.headers, ...grid.rows] : grid.rows;
    const header = grid.headers !== null;
    setAllRows(matrix);
    setColumnCount(grid.columnCount);
    setFirstRowIsHeader(header);
    setMapping(guessMapping(grid));
    setFileError(undefined);
    setStep('map');
  }

  function handleToggleHeader(header: boolean) {
    setFirstRowIsHeader(header);
    setMapping(guessMapping(gridFor(allRows, header)));
  }

  function goToPreview() {
    if (!mapping) return;
    const grid = gridFor(allRows, firstRowIsHeader);
    const result = buildImportPreview(applyMapping(grid.rows, mapping), existing);
    setPreview(result);
    const next = new Set<number>();
    result.entries.forEach((entry, position) => {
      if (entry.kind === 'valid') next.add(position);
    });
    setSelected(next);
    setStep('preview');
  }

  function toCoupleInput(value: ImportCoupleValues): CoupleInput {
    const key = value.status.trim().toLowerCase();
    return {
      name: value.name,
      primary_name: value.primary_name,
      primary_email: value.primary_email,
      primary_phone: value.primary_phone,
      secondary_name: value.secondary_name,
      secondary_email: value.secondary_email,
      secondary_phone: value.secondary_phone,
      event_date: value.event_date,
      venue: value.venue ?? '',
      status: (key && statusLookup.get(key)) || defaultStatusSlug,
    };
  }

  async function handleImport() {
    if (!preview) return;
    const rows = preview.entries
      .filter((entry, position) => selected.has(position) && entry.value)
      .map((entry) => toCoupleInput(entry.value!));
    if (rows.length === 0) return;
    await onImport(rows);
  }

  const canMap =
    mapping !== null &&
    mapping.couple_name !== null &&
    mapping.primary_name !== null;
  const selectedCount = selected.size;

  const footer = (
    <div className="flex items-center justify-end gap-3">
      {step !== 'upload' && (
        <button
          onClick={() => setStep(step === 'preview' ? 'map' : 'upload')}
          disabled={importing}
          className="cursor-pointer rounded-control bg-gray-100 px-3 py-1.5 text-xs text-gray-900 transition hover:bg-gray-200 disabled:opacity-50"
        >
          Back
        </button>
      )}
      <button
        onClick={onClose}
        disabled={importing}
        className="cursor-pointer rounded-control bg-gray-100 px-3 py-1.5 text-xs text-gray-900 transition hover:bg-gray-200 disabled:opacity-50"
      >
        Cancel
      </button>
      {step === 'map' && (
        <button
          onClick={goToPreview}
          disabled={!canMap}
          className="cursor-pointer rounded-control bg-black px-3 py-1.5 text-xs text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          Continue
        </button>
      )}
      {step === 'preview' && (
        <button
          onClick={handleImport}
          disabled={importing || selectedCount === 0}
          className="cursor-pointer rounded-control bg-black px-3 py-1.5 text-xs text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {importing
            ? 'Importing…'
            : `Import ${selectedCount} ${selectedCount === 1 ? 'couple' : 'couples'}`}
        </button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import couples"
      // Widen for the preview table (many columns); compact otherwise.
      size={step === 'preview' ? '2xl' : 'xl'}
      footer={footer}
    >
      {step === 'upload' && (
        <CouplesImportUpload
          fileName={fileName}
          fileError={fileError}
          onChoose={() => inputRef.current?.click()}
        />
      )}

      {step === 'map' && mapping && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Match each Zebri field to a column from your file.
          </p>
          <CouplesImportMapping
            grid={gridFor(allRows, firstRowIsHeader)}
            mapping={mapping}
            firstRowIsHeader={firstRowIsHeader}
            onToggleHeader={handleToggleHeader}
            onChange={setMapping}
          />
          {!canMap && (
            <p className="text-xs text-red-600">
              Map a column to Couple name and Primary contact name to continue.
            </p>
          )}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {selectedCount} of {preview.entries.length} rows will import
          </p>
          <CouplesImportPreview
            entries={preview.entries}
            selected={selected}
            onChange={setSelected}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </Modal>
  );
}

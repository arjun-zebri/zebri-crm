'use client';

import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { ReactNode } from 'react';

import { downloadCsv } from '@/lib/utils/csv';
import { CSV_TEMPLATE_HEADERS } from '@/lib/utils/csv-import';

interface CouplesImportUploadProps {
  /** Name of the currently-chosen file, shown in the dropzone. */
  fileName: string;
  /** Top-level reason the file can't be imported (e.g. missing column). */
  fileError?: string | undefined;
  /** Open the native file picker. */
  onChoose: () => void;
}

/** A single numbered instruction row. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-surface-emphasis text-caption font-medium text-gray-600">
        {n}
      </span>
      <span className="text-body text-gray-600">{children}</span>
    </li>
  );
}

/**
 * Step one of the CSV import: a short numbered walkthrough (download →
 * fill → upload), the dropzone, and the expected-columns hint. Pure
 * presentation; the modal owns the hidden file input and parsing.
 *
 * @module app/(dashboard)/couples/couples-import-upload
 */
export function CouplesImportUpload({
  fileName,
  fileError,
  onChoose,
}: CouplesImportUploadProps) {
  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        <Step n={1}>
          <button
            onClick={() =>
              downloadCsv({
                headers: [...CSV_TEMPLATE_HEADERS],
                rows: [],
                filename: 'couples-template',
              })
            }
            className="cursor-pointer font-medium text-text underline-offset-2 hover:underline"
          >
            <Download
              size={13}
              strokeWidth={1.5}
              className="mr-1 inline align-[-2px]"
            />
            Download the template
          </button>
          , or use your own spreadsheet saved as a{' '}
          <span className="text-text">.csv</span>.
        </Step>
        <Step n={2}>
          Add one couple per row.{' '}
          <span className="text-text">couple_name</span> and{' '}
          <span className="text-text">primary_name</span> are required;
          every other column is optional.
        </Step>
        <Step n={3}>
          Upload the file below. You&apos;ll match your columns to Zebri
          fields and preview the rows before anything is saved.
        </Step>
      </ol>

      <button
        onClick={onChoose}
        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-control border border-dashed border-border-strong px-6 py-8 text-center transition hover:border-gray-400 hover:bg-gray-50"
      >
        <Upload size={22} strokeWidth={1.5} className="text-text-subtle" />
        <span className="text-body text-text">
          {fileName || 'Click to choose a CSV file'}
        </span>
        <span className="text-caption text-text-subtle">CSV files only</span>
      </button>

      {fileError && <p className="text-body text-red-600">{fileError}</p>}

      <p className="flex items-start gap-1.5 text-caption text-text-subtle">
        <FileSpreadsheet
          size={13}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0"
        />
        <span>Columns: {CSV_TEMPLATE_HEADERS.join(', ')}</span>
      </p>
    </div>
  );
}

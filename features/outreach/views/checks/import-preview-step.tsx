'use client';

/**
 * Import wizard step 3: what the import will do, before anything is saved.
 *
 * Each count says what it means and how rows are matched, so the founder
 * can judge the import without reading the code. The wording follows the
 * server rules in lib/outreach/import (planMerge, mergeFill, buildProspects).
 *
 * @module features/outreach/views/checks/import-preview-step
 */

/** Counts from the preview action. */
export interface ImportPreviewCounts {
  newCount: number;
  mergeCount: number;
  /** Every row that will not be imported: no name, or a repeat within the sheet. */
  skipped: number;
  skippedNoName: number;
}

/** One labelled number with a plain explanation under it. */
function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-body font-medium text-text">{label}</dt>
      <dd className="text-section font-semibold text-text">{value}</dd>
      <dd className="text-body text-text-muted">{help}</dd>
    </div>
  );
}

/** @param props.counts - Preview counts for the chosen mapping. */
export function ImportPreviewStep({ counts }: { counts: ImportPreviewCounts }) {
  // Why: `skipped` covers both reasons; the rest are repeats of a row earlier in the same sheet.
  const duplicates = Math.max(counts.skipped - counts.skippedNoName, 0);
  return (
    <div className="flex flex-col gap-5 py-2 overflow-y-auto min-h-0">
      <p className="text-body text-text-muted">Here is what will happen. Nothing is saved until you press Import.</p>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat label="New celebrants" value={counts.newCount} help="Not in your list yet. They will be added." />
        <Stat
          label="Already here"
          value={counts.mergeCount}
          help="Matched to a celebrant already in the list. Only blank fields are filled in, so some may not change."
        />
        <Stat
          label="Skipped"
          value={counts.skipped}
          help="Rows with no name, or a repeat of a celebrant earlier in the same sheet."
        />
      </dl>
      <div className="space-y-2 text-body text-text-muted">
        <p>
          Rows are matched by registration number when they have one. Otherwise they are matched by name and suburb.
        </p>
        <p>
          On a match, existing values are never overwritten. A blank field such as email, phone or website is filled from
          the sheet.
        </p>
        {counts.skippedNoName > 0 && (
          <p>
            {counts.skippedNoName} {counts.skippedNoName === 1 ? 'row has' : 'rows have'} no name
            {duplicates > 0 ? `, and ${duplicates} ${duplicates === 1 ? 'is a repeat' : 'are repeats'}` : ''}.
          </p>
        )}
        {counts.skippedNoName === 0 && duplicates > 0 && (
          <p>
            {duplicates} {duplicates === 1 ? 'row is a repeat' : 'rows are repeats'} of a celebrant earlier in the sheet.
          </p>
        )}
      </div>
    </div>
  );
}

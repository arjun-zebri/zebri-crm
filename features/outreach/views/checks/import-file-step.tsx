'use client';

/**
 * Import wizard step 1: choose the CSV export of the celebrant sheet.
 *
 * Lists the columns up front so the founder can check the sheet before
 * choosing it. The native file input is hidden and opened by a
 * {@link Button}, so the control stays on the design system. The input
 * resets after each pick so choosing the same file again still fires
 * `onChange`.
 *
 * @module features/outreach/views/checks/import-file-step
 */
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/** Columns the importer understands. Only a name is required. */
const REQUIRED_COLUMNS = 'Required: a Full name column, or both First name and Last name.';
const OPTIONAL_COLUMNS = [
  'Registration number',
  'State',
  'Suburb',
  'Postcode',
  'Email',
  'Phone',
  'Website',
  'Instagram',
  'Facebook',
  'Notes',
  'Status',
];

/**
 * @param props.onChoose - Receives the file's text once read.
 * @param props.loading - True while the file is being parsed.
 */
export function ImportFileStep({ onChoose, loading }: { onChoose: (text: string) => void; loading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReadError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      // Why: the browser can fail to read a file that was moved or revoked after picking; the raw error means nothing to the founder.
      setReadError("We couldn't read that file. Try choosing it again, or export the sheet as CSV once more.");
      return;
    }
    onChoose(text);
  }

  return (
    <div className="flex flex-col gap-5 py-2 overflow-y-auto min-h-0">
      <div className="space-y-2">
        <h3 className="text-section font-semibold text-text">Choose your sheet</h3>
        <p className="text-body text-text-muted">
          In Google Sheets, choose File &gt; Download &gt; CSV, then choose that file here. Nothing is imported yet.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-body font-medium text-text">Columns the import reads</p>
        <p className="text-body text-text-muted">{REQUIRED_COLUMNS}</p>
        <p className="text-body text-text-muted">
          Optional: {OPTIONAL_COLUMNS.join(', ')}. In the next step you match each one to a column, so the headers can say anything.
        </p>
      </div>
      {readError && <Callout tone="danger">{readError}</Callout>}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose CSV file"
        className="hidden"
        onChange={handleChange}
      />
      <div>
        <Button variant="outline" onClick={() => inputRef.current?.click()} loading={loading}>
          Choose CSV file
        </Button>
      </div>
    </div>
  );
}

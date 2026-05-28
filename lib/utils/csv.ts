/**
 * CSV download helper.
 *
 * Generic shape so any list surface can call it — the `/couples`
 * "Export selected" button is the first consumer (Phase 4A).
 *
 * Quoting rule: every cell wrapped in `"..."` with embedded quotes
 * doubled (`"` → `""`). That covers commas, newlines, and quotes in
 * the data without needing a CSV parser library.
 *
 * @module lib/utils/csv
 */

export interface CsvDownloadInput {
  /** Column headers in order. */
  headers: string[];
  /** Row values in the same order as `headers`. `null` / `undefined`
   *  cells render as empty strings. */
  rows: Array<Array<string | number | null | undefined>>;
  /** File name (no extension — `.csv` is appended). */
  filename: string;
}

/**
 * Build a CSV blob from the given rows and trigger a browser
 * download. Client-only — relies on `document` + `URL.createObjectURL`.
 */
export function downloadCsv({ headers, rows, filename }: CsvDownloadInput): void {
  const escape = (cell: string | number | null | undefined): string => {
    const value = cell == null ? '' : String(cell);
    return `"${value.replace(/"/g, '""')}"`;
  };

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

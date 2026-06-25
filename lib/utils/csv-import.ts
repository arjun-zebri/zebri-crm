/**
 * Couples CSV import helpers.
 *
 * Pure, React-free building blocks behind the `/couples` "Import from
 * CSV" flow. The modal is a thin shell over these; the server action
 * (`bulkCreateCouplesAction`) re-validates everything, so nothing here
 * is a trust boundary — it exists to give the user a fast, readable
 * preview before they commit.
 *
 * Pipeline: {@link parseCouplesCsv} (file text → typed rows) →
 * {@link validateRow} (one row → value or reasons) →
 * {@link findDuplicates} (flag rows that collide with existing couples
 * or earlier rows). {@link buildTemplateCsv} produces the downloadable
 * starter file.
 *
 * @module lib/utils/csv-import
 */

import Papa from 'papaparse';

/**
 * The fixed template columns, in display order. Headers are matched by
 * field. The file's own column order and header names don't have to
 * match — {@link guessMapping} proposes a column→field mapping the user
 * can adjust, and {@link applyMapping} turns the grid into these rows.
 */
export const CSV_TEMPLATE_HEADERS = [
  'couple_name',
  'primary_name',
  'primary_email',
  'primary_phone',
  'secondary_name',
  'secondary_email',
  'secondary_phone',
  'event_date',
  'venue',
  'status',
] as const;

export type CsvHeader = (typeof CSV_TEMPLATE_HEADERS)[number];

/** A mapped CSV row: every known field as a trimmed string ('' when unmapped/blank). */
export type RawCoupleRow = Record<CsvHeader, string>;

/** A field → source-column-index mapping. `null` means "not mapped". */
export type ColumnMapping = Record<CsvHeader, number | null>;

export interface CsvGrid {
  /** The header labels when the first row looks like headers, else null. */
  headers: string[] | null;
  /** Data rows (the header row is excluded when `headers` is set). */
  rows: string[][];
  /** Widest row — the number of selectable source columns. */
  columnCount: number;
}

/**
 * The validated, insert-ready shape for one couple. Empty optional
 * cells become `null` (not `''`) so they map cleanly onto the nullable
 * Postgres columns. `status` stays a raw string ('' when blank); the
 * caller resolves it against the user's `couple_statuses` because the
 * valid set is per-user and not known here.
 */
export interface ImportCoupleValues {
  name: string;
  primary_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  secondary_name: string | null;
  secondary_email: string | null;
  secondary_phone: string | null;
  event_date: string | null;
  venue: string | null;
  status: string;
}

export type RowValidation =
  | { ok: true; value: ImportCoupleValues }
  | { ok: false; errors: string[] };

/** Minimal existing-couple shape needed to detect duplicates. */
export interface ExistingCoupleRef {
  name: string;
  primary_email?: string | null;
}

// Deliberately permissive: we want to catch obvious typos ("no @",
// "no dot") without rejecting unusual-but-valid addresses. The server
// (and ultimately the couple record) treats email as free text.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when (y, m, d) is a real calendar date (no JS Date rollover). */
function isRealYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Normalize a raw date cell to ISO `YYYY-MM-DD`, leniently. Accepts the
 * three numeric parts separated by `/`, `-`, or `.`, in either order:
 * - **Year-first** when the first part is 4 digits (`2026-9-1`,
 *   `2026/09/01`).
 * - **Day-first** otherwise — the Australian convention (`1/9/2026`,
 *   `01-09-2026`, `1.9.26`). A 2-digit year is read as `20YY`.
 * Single-digit day/month are fine. Returns:
 * - `''` → `{ value: null }` (no date is valid)
 * - a real calendar date → `{ value: iso }`
 * - anything else → `{ invalid: true }`
 */
function normalizeDate(
  raw: string,
): { value: string | null } | { invalid: true } {
  const s = raw.trim();
  if (s === '') return { value: null };

  const parts = s.split(/[/.-]/).map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    return { invalid: true };
  }
  const [a, b, c] = parts as [string, string, string];

  let y: number;
  let m: number;
  let d: number;
  if (a.length === 4) {
    y = Number(a);
    m = Number(b);
    d = Number(c);
  } else {
    d = Number(a);
    m = Number(b);
    y = c.length === 2 ? 2000 + Number(c) : Number(c);
  }

  if (!isRealYmd(y, m, d)) return { invalid: true };
  return { value: `${y}-${pad2(m)}-${pad2(d)}` };
}

/** `''` for an empty/whitespace cell, otherwise the trimmed value. */
function orNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** Normalize a header label for matching: lower-case, separators → spaces. */
function normHeader(label: string): string {
  return label.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

// Common header variants we recognize per field, so a file that says
// "Bride", "Email", or "Wedding Date" still auto-maps. The user can
// override anything we get wrong.
const HEADER_ALIASES: Record<CsvHeader, string[]> = {
  couple_name: ['couple name', 'couple', 'couples', 'name'],
  primary_name: ['primary name', 'primary', 'partner 1', 'partner one', 'bride', 'contact name', 'client name'],
  primary_email: ['primary email', 'email', 'email address', 'bride email'],
  primary_phone: ['primary phone', 'phone', 'phone number', 'mobile', 'contact number'],
  secondary_name: ['secondary name', 'secondary', 'partner 2', 'partner two', 'groom'],
  secondary_email: ['secondary email', 'groom email'],
  secondary_phone: ['secondary phone', 'groom phone'],
  event_date: ['event date', 'date', 'wedding date', 'wedding', 'event'],
  venue: ['venue', 'location', 'venue name'],
  status: ['status', 'stage', 'lead status'],
};

/**
 * Parse uploaded CSV text into a grid of raw cells. The first row is
 * treated as a header row when at least two of its cells look like
 * known field names (or aliases); otherwise the file is treated as
 * header-less and every row is data. Blank lines are skipped.
 */
export function parseCsvGrid(text: string): CsvGrid {
  // Strip a leading UTF-8 BOM (Excel adds one); otherwise it sticks to
  // the first header cell and stops it auto-mapping (e.g. couple_name).
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    header: false,
    skipEmptyLines: 'greedy',
  });
  const grid = parsed.data.map((row) => row.map((cell) => cell.trim()));
  const columnCount = grid.reduce((max, row) => Math.max(max, row.length), 0);

  const first = grid[0] ?? [];
  const knownHits = first.filter((cell) => {
    const n = normHeader(cell);
    return CSV_TEMPLATE_HEADERS.some(
      (h) => normHeader(h) === n || HEADER_ALIASES[h].includes(n),
    );
  }).length;

  if (knownHits >= 2) {
    return { headers: first, rows: grid.slice(1), columnCount };
  }
  return { headers: null, rows: grid, columnCount };
}

/**
 * Propose a field → column mapping for a grid. With headers, each field
 * claims the first unused column whose header matches its name/aliases.
 * Without headers, fields map to columns by position (template order).
 * Unmatched fields are `null` and the user can assign them.
 */
export function guessMapping(grid: CsvGrid): ColumnMapping {
  const mapping = Object.fromEntries(
    CSV_TEMPLATE_HEADERS.map((h) => [h, null]),
  ) as ColumnMapping;

  if (!grid.headers) {
    CSV_TEMPLATE_HEADERS.forEach((field, i) => {
      mapping[field] = i < grid.columnCount ? i : null;
    });
    return mapping;
  }

  const used = new Set<number>();
  const normalized = grid.headers.map(normHeader);
  for (const field of CSV_TEMPLATE_HEADERS) {
    const candidates = [normHeader(field), ...HEADER_ALIASES[field]];
    const col = normalized.findIndex(
      (h, i) => !used.has(i) && candidates.includes(h),
    );
    if (col !== -1) {
      mapping[field] = col;
      used.add(col);
    }
  }
  return mapping;
}

/** Turn a grid's data rows into mapped {@link RawCoupleRow}s. */
export function applyMapping(
  rows: string[][],
  mapping: ColumnMapping,
): RawCoupleRow[] {
  return rows.map((cells) => {
    const row = {} as RawCoupleRow;
    for (const field of CSV_TEMPLATE_HEADERS) {
      const col = mapping[field];
      row[field] = col === null ? '' : (cells[col] ?? '').trim();
    }
    return row;
  });
}

/** A non-empty email or `null`. An unparseable address is dropped
 *  (returned as `null`) rather than treated as fatal — see
 *  {@link validateRow}. */
function emailOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validate and coerce one raw row.
 *
 * Only the **required** fields block an import: a row with no
 * `couple_name` or no `primary_name` is invalid. Everything else is
 * optional, so a bad value (an unreadable `event_date`, a malformed
 * email) is **dropped to `null`** and the couple still imports — the
 * preview table flags the affected cell so the loss is visible, not
 * silent. This keeps a single typo from blocking a whole row.
 */
export function validateRow(row: RawCoupleRow): RowValidation {
  const errors: string[] = [];

  const name = row.couple_name.trim();
  if (name === '') errors.push('Missing couple name');
  else if (name.length > 200) errors.push('Couple name is too long');

  if (row.primary_name.trim() === '')
    errors.push('Missing primary contact name');

  if (errors.length > 0) return { ok: false, errors };

  const date = normalizeDate(row.event_date);

  return {
    ok: true,
    value: {
      name,
      primary_name: orNull(row.primary_name),
      primary_email: emailOrNull(row.primary_email),
      primary_phone: orNull(row.primary_phone),
      secondary_name: orNull(row.secondary_name),
      secondary_email: emailOrNull(row.secondary_email),
      secondary_phone: orNull(row.secondary_phone),
      // Unreadable dates are dropped (not fatal) — event_date is optional.
      event_date: 'invalid' in date ? null : date.value,
      venue: orNull(row.venue),
      status: row.status.trim(),
    },
  };
}

const norm = (v: string | null | undefined): string =>
  (v ?? '').trim().toLowerCase();

/**
 * Return the indices of rows that look like duplicates — matching an
 * existing couple, or an earlier row in the same file, by primary
 * email or couple name (both compared case-insensitively). The first
 * occurrence within the file is never flagged; later repeats are.
 */
export function findDuplicates(
  rows: ImportCoupleValues[],
  existing: ExistingCoupleRef[],
): Set<number> {
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  for (const e of existing) {
    if (e.primary_email) seenEmails.add(norm(e.primary_email));
    seenNames.add(norm(e.name));
  }

  const duplicates = new Set<number>();
  rows.forEach((row, index) => {
    const email = norm(row.primary_email);
    const nameKey = norm(row.name);
    const emailHit = email !== '' && seenEmails.has(email);
    const nameHit = nameKey !== '' && seenNames.has(nameKey);
    if (emailHit || nameHit) duplicates.add(index);
    // Record after checking so the file's first occurrence is the
    // "original" and only subsequent repeats get flagged.
    if (email !== '') seenEmails.add(email);
    if (nameKey !== '') seenNames.add(nameKey);
  });

  return duplicates;
}

/** One preview row: the raw cells (for the table), its classification,
 *  and (for importable rows) the validated value. */
export interface PreviewEntry {
  /** 1-based position among the file's data rows (for display). */
  rowNumber: number;
  /** The raw parsed cells, shown verbatim in the preview table. */
  raw: RawCoupleRow;
  kind: 'valid' | 'duplicate' | 'invalid';
  /** Why the row can't be imported (invalid rows only). */
  reason?: string;
  /** Validated value (valid + duplicate rows only). A field is `null`
   *  here when its raw cell was empty or dropped as unreadable. */
  value?: ImportCoupleValues;
}

export interface ImportPreview {
  entries: PreviewEntry[];
}

/**
 * Validate mapped rows and flag duplicates in one pass so the modal
 * stays a thin shell. Entries keep source order. Duplicate detection
 * runs over the valid rows only (an invalid row has no comparable
 * value yet).
 */
export function buildImportPreview(
  rows: RawCoupleRow[],
  existing: ExistingCoupleRef[],
): ImportPreview {
  // First pass: validate. Remember where each valid value came from so
  // we can map duplicate positions back to source rows.
  const validations = rows.map(validateRow);
  const validValues: ImportCoupleValues[] = [];
  const validSourceIndex: number[] = [];
  validations.forEach((v, i) => {
    if (v.ok) {
      validValues.push(v.value);
      validSourceIndex.push(i);
    }
  });

  const dupePositions = findDuplicates(validValues, existing);
  const duplicateSourceRows = new Set(
    [...dupePositions].map((pos) => validSourceIndex[pos]),
  );

  const entries: PreviewEntry[] = rows.map((row, i) => {
    const rowNumber = i + 1;
    const validation = validations[i]!;
    if (!validation.ok) {
      return {
        rowNumber,
        raw: row,
        kind: 'invalid',
        reason: validation.errors[0] ?? 'Invalid row',
      };
    }
    return {
      rowNumber,
      raw: row,
      kind: duplicateSourceRows.has(i) ? 'duplicate' : 'valid',
      value: validation.value,
    };
  });

  return { entries };
}

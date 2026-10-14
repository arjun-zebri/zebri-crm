/**
 * Turn the founder's celebrant sheet (exported as CSV) into prospect rows.
 *
 * Pipeline: {@link parseSheet} (text → header + rows) →
 * {@link guessColumns} (header → field mapping the admin can correct) →
 * {@link buildProspects} (rows + mapping → normalised prospect inputs,
 * deduped within the file) → {@link planMerge} (against existing keys →
 * inserts vs updates).
 *
 * Pure: the server action does the I/O and re-runs all of this, so the
 * browser preview is never a trust boundary.
 *
 * @module lib/outreach/import/sheet
 */
import Papa from 'papaparse';

import {
  clean,
  dedupeKey,
  normaliseEmail,
  normaliseFacebook,
  normaliseInstagram,
  normaliseState,
  normaliseWebsite,
  parseName,
} from './normalise';

/** Fields a sheet column can map onto. */
export const SHEET_FIELDS = [
  'full_name',
  'first_name',
  'last_name',
  'registration_no',
  'state',
  'suburb',
  'postcode',
  'email',
  'phone',
  'website',
  'instagram',
  'facebook',
  'notes',
  'status',
] as const;

/** One of {@link SHEET_FIELDS}. */
export type SheetField = (typeof SHEET_FIELDS)[number];

/** Field → column index; `null` when unmapped. */
export type SheetMapping = Record<SheetField, number | null>;

/** A parsed sheet: header labels and data rows (cells trimmed). */
export interface SheetGrid {
  headers: string[];
  rows: string[][];
}

/** Hard ceiling so a wrong file can't stall the import. */
export const MAX_SHEET_ROWS = 20_000;

const ALIASES: Record<SheetField, string[]> = {
  full_name: ['name', 'full name', 'celebrant', 'celebrant name', 'marriage celebrant'],
  first_name: ['first name', 'given name', 'firstname'],
  last_name: ['last name', 'surname', 'family name', 'lastname'],
  registration_no: ['registration', 'registration no', 'registration number', 'reg no', 'reg number', 'celebrant id', 'id'],
  state: ['state', 'state territory', 'state/territory'],
  suburb: ['suburb', 'town', 'city', 'locality', 'location'],
  postcode: ['postcode', 'post code', 'zip'],
  email: ['email', 'email address', 'e mail'],
  phone: ['phone', 'phone number', 'mobile', 'telephone', 'contact number'],
  website: ['website', 'web', 'url', 'site', 'web site'],
  instagram: ['instagram', 'ig', 'insta', 'instagram handle'],
  facebook: ['facebook', 'fb'],
  notes: ['notes', 'note', 'comments'],
  status: ['status', 'contacted', 'stage'],
};

function normHeader(label: string): string {
  return label.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Parse CSV text. The first non-empty row is always the header row. */
export function parseSheet(text: string): SheetGrid {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    header: false,
    skipEmptyLines: 'greedy',
  });
  const grid = parsed.data.map((row) => row.map((c) => (c ?? '').trim()));
  const [headers = [], ...rows] = grid;
  return { headers, rows: rows.slice(0, MAX_SHEET_ROWS) };
}

/** Propose a mapping from header labels; each column is claimed at most once. */
export function guessColumns(headers: string[]): SheetMapping {
  const mapping = Object.fromEntries(SHEET_FIELDS.map((f) => [f, null])) as SheetMapping;
  const normalised = headers.map(normHeader);
  const used = new Set<number>();
  for (const field of SHEET_FIELDS) {
    const candidates = [normHeader(field), ...ALIASES[field]];
    const col = normalised.findIndex((h, i) => !used.has(i) && candidates.includes(h));
    if (col !== -1) {
      mapping[field] = col;
      used.add(col);
    }
  }
  return mapping;
}

/** A normalised prospect ready to insert or merge. */
export interface ProspectInput {
  registration_no: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  state: string | null;
  suburb: string | null;
  postcode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  sheet_notes: string | null;
  sheet_status: string | null;
  sheet_raw: Record<string, string>;
  dedupe_key: string;
}

/** Why a sheet row was dropped. */
export type SkipReason = 'no_name' | 'duplicate_in_file';

/** Output of {@link buildProspects}. */
export interface BuildResult {
  prospects: ProspectInput[];
  skipped: { row: number; reason: SkipReason }[];
}

/** Identity used to merge: registration number when present, else the dedupe key. */
export function mergeKey(p: Pick<ProspectInput, 'registration_no' | 'dedupe_key'>): string {
  return p.registration_no ? `reg:${p.registration_no}` : `key:${p.dedupe_key}`;
}

/** Map + normalise every row; later duplicates of the same celebrant are skipped. */
export function buildProspects(grid: SheetGrid, mapping: SheetMapping): BuildResult {
  const prospects: ProspectInput[] = [];
  const skipped: BuildResult['skipped'] = [];
  const seen = new Set<string>();

  grid.rows.forEach((row, index) => {
    const cell = (f: SheetField) => {
      const col = mapping[f];
      return col == null ? null : clean(row[col]);
    };
    const first = cell('first_name');
    const last = cell('last_name');
    const fullName = cell('full_name') ?? clean([first, last].filter(Boolean).join(' '));
    if (!fullName) {
      skipped.push({ row: index + 2, reason: 'no_name' });
      return;
    }
    const parsed = parseName(fullName);
    const suburb = cell('suburb');
    const raw: Record<string, string> = {};
    grid.headers.forEach((h, i) => {
      if (row[i]) raw[h || `column_${i + 1}`] = row[i]!;
    });

    const p: ProspectInput = {
      registration_no: cell('registration_no'),
      full_name: fullName,
      first_name: first ?? parsed.first,
      last_name: last ?? parsed.last,
      state: normaliseState(cell('state')),
      suburb,
      postcode: cell('postcode'),
      email: normaliseEmail(cell('email')),
      phone: cell('phone'),
      website: normaliseWebsite(cell('website')),
      instagram_handle: normaliseInstagram(cell('instagram')),
      facebook_url: normaliseFacebook(cell('facebook')),
      sheet_notes: cell('notes'),
      sheet_status: cell('status'),
      sheet_raw: raw,
      dedupe_key: dedupeKey(fullName, suburb),
    };

    const key = mergeKey(p);
    if (seen.has(key)) {
      skipped.push({ row: index + 2, reason: 'duplicate_in_file' });
      return;
    }
    seen.add(key);
    prospects.push(p);
  });

  return { prospects, skipped };
}

/** Inserts vs merges once the existing prospects' keys are known. */
export interface MergePlan {
  inserts: ProspectInput[];
  updates: { existingId: string; input: ProspectInput }[];
}

/**
 * Split incoming prospects into new rows and merges. `existing` maps
 * {@link mergeKey} → prospect id for everything already in the table.
 */
export function planMerge(incoming: ProspectInput[], existing: Map<string, string>): MergePlan {
  const plan: MergePlan = { inserts: [], updates: [] };
  for (const input of incoming) {
    const id = existing.get(mergeKey(input));
    if (id) plan.updates.push({ existingId: id, input });
    else plan.inserts.push(input);
  }
  return plan;
}

/**
 * Fields a re-import may change on an existing prospect: only blanks are
 * filled, so nothing the admin edited (or Zebri found) is overwritten.
 */
export function mergeFill(
  current: Partial<Record<keyof ProspectInput, unknown>>,
  input: ProspectInput,
): Partial<ProspectInput> {
  const patch: Partial<ProspectInput> = {};
  const fillable = [
    'first_name', 'last_name', 'state', 'suburb', 'postcode', 'email', 'phone',
    'website', 'instagram_handle', 'facebook_url', 'sheet_notes', 'sheet_status',
  ] as const;
  for (const k of fillable) {
    if ((current[k] == null || current[k] === '') && input[k] != null) {
      (patch as Record<string, unknown>)[k] = input[k];
    }
  }
  return patch;
}

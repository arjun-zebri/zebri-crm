/**
 * Unit coverage for the couples CSV import helpers.
 *
 * These pure functions back the `/couples` "Import from CSV" flow:
 * parse the file into a grid, guess (and let the user adjust) which
 * column maps to which field, apply that mapping, then validate each
 * row and flag duplicates. The UI is a thin shell over them, and the
 * server action re-validates, so this is where the contract is pinned.
 */

import { describe, expect, it } from 'vitest'

import {
  CSV_TEMPLATE_HEADERS,
  applyMapping,
  buildImportPreview,
  findDuplicates,
  guessMapping,
  parseCsvGrid,
  validateRow,
  type ColumnMapping,
  type CsvGrid,
  type ImportCoupleValues,
  type RawCoupleRow,
} from '@/lib/utils/csv-import'

/** Build a RawCoupleRow with empty defaults, overriding a few fields. */
function rawRow(overrides: Partial<RawCoupleRow> = {}): RawCoupleRow {
  const base = Object.fromEntries(
    CSV_TEMPLATE_HEADERS.map((h) => [h, '']),
  ) as RawCoupleRow
  return { ...base, ...overrides }
}

/** A full mapping from a header-named grid (field -> its own column). */
function identityMapping(headers: readonly string[]): ColumnMapping {
  const map = Object.fromEntries(
    CSV_TEMPLATE_HEADERS.map((h) => [h, null]),
  ) as ColumnMapping
  headers.forEach((h, i) => {
    if ((CSV_TEMPLATE_HEADERS as readonly string[]).includes(h)) {
      map[h as keyof ColumnMapping] = i
    }
  })
  return map
}

describe('parseCsvGrid', () => {
  it('detects a header row and returns data rows separately', () => {
    const text = ['couple_name,primary_name', 'Sam & Alex,Sam'].join('\n')
    const grid = parseCsvGrid(text)
    expect(grid.headers).toEqual(['couple_name', 'primary_name'])
    expect(grid.rows).toEqual([['Sam & Alex', 'Sam']])
    expect(grid.columnCount).toBe(2)
  })

  it('treats a file with no recognizable headers as all data', () => {
    const text = ['Sam & Alex,Sam,sam@example.com'].join('\n')
    const grid = parseCsvGrid(text)
    expect(grid.headers).toBeNull()
    expect(grid.rows).toEqual([['Sam & Alex', 'Sam', 'sam@example.com']])
  })

  it('handles quoted fields containing commas', () => {
    const text = ['couple_name,venue', '"Smith, Jones","The Grand, Sydney"'].join(
      '\n',
    )
    const grid = parseCsvGrid(text)
    expect(grid.rows[0]).toEqual(['Smith, Jones', 'The Grand, Sydney'])
  })

  it('skips fully blank lines', () => {
    const text = ['couple_name,primary_name', 'Sam & Alex,Sam', '', '   '].join(
      '\n',
    )
    const grid = parseCsvGrid(text)
    expect(grid.rows).toHaveLength(1)
  })

  it('strips a leading UTF-8 BOM so the first header still matches', () => {
    const text = '﻿couple_name,primary_name\nSam & Alex,Sam'
    const grid = parseCsvGrid(text)
    expect(grid.headers).toEqual(['couple_name', 'primary_name'])
    // The BOM-stripped header auto-maps, not "Skip".
    expect(guessMapping(grid).couple_name).toBe(0)
  })
})

describe('guessMapping', () => {
  it('maps columns by header name, including common aliases', () => {
    const grid: CsvGrid = {
      headers: ['Couple', 'Bride', 'Email', 'Wedding Date'],
      rows: [],
      columnCount: 4,
    }
    const mapping = guessMapping(grid)
    expect(mapping.couple_name).toBe(0)
    expect(mapping.primary_name).toBe(1)
    expect(mapping.primary_email).toBe(2)
    expect(mapping.event_date).toBe(3)
  })

  it('maps by position when there are no headers', () => {
    const grid: CsvGrid = { headers: null, rows: [['a', 'b']], columnCount: 2 }
    const mapping = guessMapping(grid)
    // Template order: couple_name, primary_name, ...
    expect(mapping.couple_name).toBe(0)
    expect(mapping.primary_name).toBe(1)
    expect(mapping.primary_email).toBeNull()
  })

  it('leaves a field unmapped when nothing matches', () => {
    const grid: CsvGrid = {
      headers: ['couple_name'],
      rows: [],
      columnCount: 1,
    }
    expect(guessMapping(grid).venue).toBeNull()
  })
})

describe('applyMapping', () => {
  it('builds rows from the mapping, blank for unmapped fields', () => {
    const rows = [['Sam & Alex', 'sam@example.com', 'Sam']]
    const mapping: ColumnMapping = {
      ...identityMapping([]),
      couple_name: 0,
      primary_email: 1,
      primary_name: 2,
    }
    const [row] = applyMapping(rows, mapping)
    expect(row!.couple_name).toBe('Sam & Alex')
    expect(row!.primary_email).toBe('sam@example.com')
    expect(row!.primary_name).toBe('Sam')
    expect(row!.venue).toBe('')
  })
})

describe('validateRow', () => {
  it('accepts a complete valid row and normalizes empties to null', () => {
    const result = validateRow(
      rawRow({
        couple_name: 'Sam & Alex',
        primary_name: 'Sam',
        primary_email: 'sam@example.com',
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      name: 'Sam & Alex',
      primary_name: 'Sam',
      primary_email: 'sam@example.com',
      primary_phone: null,
      secondary_name: null,
      event_date: null,
      venue: null,
      status: '',
    })
  })

  it('rejects a row missing the couple name', () => {
    const result = validateRow(rawRow({ primary_name: 'Sam' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Missing couple name')
  })

  it('rejects a row missing the primary contact name', () => {
    const result = validateRow(rawRow({ couple_name: 'Sam & Alex' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Missing primary contact name')
  })

  it('drops an invalid primary email but keeps the row importable', () => {
    const result = validateRow(
      rawRow({ couple_name: 'C', primary_name: 'P', primary_email: 'not-an-email' }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.primary_email).toBeNull()
  })

  it('passes through an ISO date unchanged', () => {
    const result = validateRow(
      rawRow({ couple_name: 'C', primary_name: 'P', event_date: '2026-09-01' }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.event_date).toBe('2026-09-01')
  })

  it.each([
    ['01/09/2026', '2026-09-01'],
    ['1/9/2026', '2026-09-01'],
    ['1/9/26', '2026-09-01'],
    ['01-09-2026', '2026-09-01'],
    ['1.9.2026', '2026-09-01'],
    ['2026-9-1', '2026-09-01'],
  ])('normalizes "%s" to %s', (input, expected) => {
    const result = validateRow(
      rawRow({ couple_name: 'C', primary_name: 'P', event_date: input }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.event_date).toBe(expected)
  })

  it('drops an unreadable date but keeps the row importable', () => {
    const result = validateRow(
      rawRow({ couple_name: 'C', primary_name: 'P', event_date: 'next spring' }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.event_date).toBeNull()
  })
})

describe('findDuplicates', () => {
  const values = (over: Partial<ImportCoupleValues>): ImportCoupleValues => ({
    name: 'Couple',
    primary_name: null,
    primary_email: null,
    primary_phone: null,
    secondary_name: null,
    secondary_email: null,
    secondary_phone: null,
    event_date: null,
    venue: null,
    status: '',
    ...over,
  })

  it('flags a row whose primary email matches an existing couple (case-insensitive)', () => {
    const rows = [values({ name: 'New', primary_email: 'SAM@example.com' })]
    const dupes = findDuplicates(rows, [
      { name: 'Old', primary_email: 'sam@example.com' },
    ])
    expect(dupes.has(0)).toBe(true)
  })

  it('flags a row whose couple name matches an existing couple', () => {
    const rows = [values({ name: 'Sam & Alex' })]
    const dupes = findDuplicates(rows, [{ name: 'sam & alex' }])
    expect(dupes.has(0)).toBe(true)
  })

  it('flags a row duplicated earlier within the same file', () => {
    const rows = [
      values({ name: 'Sam & Alex' }),
      values({ name: 'Sam & Alex' }),
    ]
    const dupes = findDuplicates(rows, [])
    expect(dupes.has(0)).toBe(false)
    expect(dupes.has(1)).toBe(true)
  })

  it('does not flag distinct rows', () => {
    const rows = [values({ name: 'A' }), values({ name: 'B' })]
    expect(findDuplicates(rows, [{ name: 'C' }]).size).toBe(0)
  })
})

describe('buildImportPreview', () => {
  it('classifies rows as valid, invalid, and duplicate in source order', () => {
    const rows: RawCoupleRow[] = [
      rawRow({ couple_name: 'Sam & Alex', primary_name: 'Sam' }), // valid
      rawRow({ primary_name: 'Nobody' }), // invalid (missing couple name)
      rawRow({ couple_name: 'Existing Pair', primary_name: 'Pat' }), // duplicate
    ]

    const preview = buildImportPreview(rows, [{ name: 'Existing Pair' }])
    expect(preview.entries.map((e) => e.kind)).toEqual([
      'valid',
      'invalid',
      'duplicate',
    ])
    expect(preview.entries[0]!.rowNumber).toBe(1)
    expect(preview.entries[1]!.reason).toBe('Missing couple name')
    expect(preview.entries[0]!.value?.name).toBe('Sam & Alex')
  })

  it('carries the raw cell values on every entry for the preview table', () => {
    const rows: RawCoupleRow[] = [
      rawRow({ couple_name: 'Sam & Alex', primary_email: 'sam@example.com' }),
    ]
    const preview = buildImportPreview(rows, [])
    expect(preview.entries[0]!.raw.couple_name).toBe('Sam & Alex')
    expect(preview.entries[0]!.raw.primary_email).toBe('sam@example.com')
    expect(preview.entries[0]!.raw.venue).toBe('')
  })
})

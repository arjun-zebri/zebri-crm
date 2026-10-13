import { describe, expect, it } from 'vitest';

import { buildProspects, guessColumns, mergeFill, mergeKey, parseSheet, planMerge } from '@/lib/outreach/import/sheet';

const CSV = [
  '﻿Celebrant Name,Reg No,State,Suburb,Email,Website,Instagram,Notes',
  'MRS JANE SMITH,A123,Victoria,Fitzroy,Jane@Example.com,janesmith.com.au,@janesmith,met at expo',
  'Bob Jones,,NSW,Bondi,,,,',
  ',,NSW,Bondi,x@y.com,,,',
  'Jane Smith (dup),A123,VIC,Fitzroy,,,,',
].join('\n');

describe('parseSheet + guessColumns', () => {
  it('reads headers (BOM stripped) and guesses the mapping', () => {
    const grid = parseSheet(CSV);
    expect(grid.headers[0]).toBe('Celebrant Name');
    expect(grid.rows).toHaveLength(4);
    const m = guessColumns(grid.headers);
    expect(m.full_name).toBe(0);
    expect(m.registration_no).toBe(1);
    expect(m.state).toBe(2);
    expect(m.instagram).toBe(6);
    expect(m.notes).toBe(7);
    expect(m.phone).toBeNull();
  });
});

describe('buildProspects', () => {
  it('normalises rows, skips nameless rows and in-file duplicates', () => {
    const grid = parseSheet(CSV);
    const { prospects, skipped } = buildProspects(grid, guessColumns(grid.headers));
    expect(prospects).toHaveLength(2);
    const jane = prospects[0]!;
    expect(jane).toMatchObject({
      registration_no: 'A123',
      first_name: 'Jane',
      last_name: 'Smith',
      state: 'VIC',
      email: 'jane@example.com',
      website: 'https://janesmith.com.au',
      instagram_handle: 'janesmith',
      sheet_notes: 'met at expo',
    });
    expect(jane.sheet_raw['Celebrant Name']).toBe('MRS JANE SMITH');
    expect(skipped).toEqual([
      { row: 4, reason: 'no_name' },
      { row: 5, reason: 'duplicate_in_file' },
    ]);
  });
});

describe('planMerge + mergeFill', () => {
  it('splits inserts from merges by registration number or name+suburb', () => {
    const grid = parseSheet(CSV);
    const { prospects } = buildProspects(grid, guessColumns(grid.headers));
    const existing = new Map([[mergeKey(prospects[1]!), 'existing-bob']]);
    const plan = planMerge(prospects, existing);
    expect(plan.inserts.map((p) => p.full_name)).toEqual(['MRS JANE SMITH']);
    expect(plan.updates[0]!.existingId).toBe('existing-bob');
  });

  it('only fills blanks, never overwrites', () => {
    const grid = parseSheet(CSV);
    const jane = buildProspects(grid, guessColumns(grid.headers)).prospects[0]!;
    const patch = mergeFill({ email: 'kept@x.com', website: null, instagram_handle: '' }, jane);
    expect(patch.email).toBeUndefined();
    expect(patch.website).toBe('https://janesmith.com.au');
    expect(patch.instagram_handle).toBe('janesmith');
  });
});

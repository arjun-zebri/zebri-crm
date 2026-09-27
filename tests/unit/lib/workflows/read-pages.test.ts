import { describe, expect, it } from 'vitest';

import { PAGE_SIZE, readAllPages, TooManyRowsError } from '@/lib/workflows/read-pages';

const OPTS = { maxRows: PAGE_SIZE * 5, tooMany: 'Too many.' };

/** A table of `total` rows served a page at a time, as PostgREST does. */
function table(total: number) {
  const ranges: [number, number][] = [];
  const page = async (from: number, to: number) => {
    ranges.push([from, to]);
    const end = Math.min(to + 1, total);
    return {
      data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i),
      error: null,
    };
  };
  return { page, ranges };
}

describe('readAllPages', () => {
  it('reads past the per-request cap until a page comes back short', async () => {
    const { page, ranges } = table(PAGE_SIZE * 2 + 7);
    const rows = await readAllPages(page, OPTS);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 7);
    expect(new Set(rows).size).toBe(rows.length);
    expect(ranges).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
  });

  it('reads an exact multiple of the page size with one empty page after', async () => {
    const { page } = table(PAGE_SIZE);
    expect(await readAllPages(page, OPTS)).toHaveLength(PAGE_SIZE);
  });

  it('throws at the safety cap rather than returning a short list', async () => {
    const { page } = table(PAGE_SIZE * 50);
    await expect(readAllPages(page, OPTS)).rejects.toBeInstanceOf(TooManyRowsError);
    await expect(readAllPages(page, OPTS)).rejects.toThrow('Too many.');
  });

  it('throws on a failed page', async () => {
    const page = async () => ({ data: null, error: { message: 'connection reset' } });
    await expect(readAllPages(page, OPTS)).rejects.toThrow('connection reset');
  });
});

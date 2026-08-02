import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CATEGORY_COLORS,
  UNCATEGORISED_COLOR,
  isCategoryColor,
  nextCategoryColor,
  normalizeCategoryColor,
} from '@/lib/time-tracking/colors';

describe('DEFAULT_CATEGORY_COLORS', () => {
  it('is the eight validated slots, stored in the shape the column accepts', () => {
    expect(DEFAULT_CATEGORY_COLORS).toHaveLength(8);
    for (const color of DEFAULT_CATEGORY_COLORS) {
      expect(isCategoryColor(color)).toBe(true);
    }
  });

  it('holds no duplicates', () => {
    expect(new Set(DEFAULT_CATEGORY_COLORS).size).toBe(
      DEFAULT_CATEGORY_COLORS.length,
    );
  });

  it('keeps uncategorised out of the categorical set', () => {
    expect(DEFAULT_CATEGORY_COLORS).not.toContain(UNCATEGORISED_COLOR);
  });
});

describe('nextCategoryColor', () => {
  it('starts at the first slot', () => {
    expect(nextCategoryColor([])).toBe(DEFAULT_CATEGORY_COLORS[0]);
  });

  it('takes the first slot not already in use', () => {
    const used = [DEFAULT_CATEGORY_COLORS[0], DEFAULT_CATEGORY_COLORS[1]];
    expect(nextCategoryColor(used)).toBe(DEFAULT_CATEGORY_COLORS[2]);
  });

  it('fills a gap left by a deleted category rather than skipping past it', () => {
    const used = [DEFAULT_CATEGORY_COLORS[0], DEFAULT_CATEGORY_COLORS[2]];
    expect(nextCategoryColor(used)).toBe(DEFAULT_CATEGORY_COLORS[1]);
  });

  it('ignores categories that have no colour yet', () => {
    expect(nextCategoryColor([null, null])).toBe(DEFAULT_CATEGORY_COLORS[0]);
  });

  it('matches case-insensitively, since a picker may hand back lowercase', () => {
    const used = [DEFAULT_CATEGORY_COLORS[0].toLowerCase()];
    expect(nextCategoryColor(used)).toBe(DEFAULT_CATEGORY_COLORS[1]);
  });

  it('wraps once every slot is taken instead of inventing a ninth hue', () => {
    const next = nextCategoryColor([...DEFAULT_CATEGORY_COLORS]);
    expect(DEFAULT_CATEGORY_COLORS).toContain(next);
  });
});

describe('normalizeCategoryColor', () => {
  it('uppercases, which is the shape the column stores', () => {
    expect(normalizeCategoryColor('#2a78d6')).toBe('#2A78D6');
  });

  it('expands three-digit hex', () => {
    expect(normalizeCategoryColor('#abc')).toBe('#AABBCC');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCategoryColor('  #2A78D6  ')).toBe('#2A78D6');
  });

  it('rejects anything the CHECK constraint would reject', () => {
    expect(normalizeCategoryColor('')).toBeNull();
    expect(normalizeCategoryColor(null)).toBeNull();
    expect(normalizeCategoryColor(undefined)).toBeNull();
    expect(normalizeCategoryColor('red')).toBeNull();
    expect(normalizeCategoryColor('#12345')).toBeNull();
    expect(normalizeCategoryColor('#GGGGGG')).toBeNull();
    expect(normalizeCategoryColor('rgb(1,2,3)')).toBeNull();
  });
});

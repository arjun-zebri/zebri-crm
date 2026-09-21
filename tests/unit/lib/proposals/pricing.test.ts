import { describe, expect, it } from 'vitest';

import {
  depositAmount,
  optionBaseSubtotal,
  optionTotal,
  weekendLoadingAmount,
} from '@/lib/proposals/pricing';

const items = [
  { id: 'a', description: 'Ceremony', amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true },
  { id: 'b', description: 'Extra hour', amount: 150, quantity: 2, isAddon: false, defaultIncluded: true },
  { id: 'c', description: 'Late finish', amount: 500, quantity: 1, isAddon: true, defaultIncluded: false },
];

describe('proposal pricing', () => {
  it('base subtotal multiplies quantity and ignores add-ons', () => {
    expect(optionBaseSubtotal(items)).toBe(1300);
  });

  it('single-price options use fixed_price, not items', () => {
    const total = optionTotal(
      { pricingMode: 'single', fixedPrice: 2500, weekendLoadingPercent: null, items },
      [],
    );
    expect(total).toBe(2500);
  });

  it('adds selected add-ons and weekend loading on the base', () => {
    const total = optionTotal(
      { pricingMode: 'itemised', fixedPrice: null, weekendLoadingPercent: 10, items },
      ['c'],
    );
    // base 1300 + loading 130 + add-on 500
    expect(total).toBe(1930);
  });

  it('rounds to cents', () => {
    expect(weekendLoadingAmount(333.33, 15)).toBe(50);
    expect(depositAmount(1930, 30)).toBe(579);
    expect(depositAmount(1001, 33.33)).toBe(333.63);
  });

  it('deposit is zero when percent is null', () => {
    expect(depositAmount(1000, null)).toBe(0);
  });

  it('weekend loading is zero when percent is null', () => {
    expect(weekendLoadingAmount(100, null)).toBe(0);
  });

  it('base subtotal is zero for empty items', () => {
    expect(optionBaseSubtotal([])).toBe(0);
  });
});

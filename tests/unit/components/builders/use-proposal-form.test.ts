import { describe, expect, it } from 'vitest';

import { applyPackageToOption, emptyForm } from '@/lib/proposals/form-factories';
import { toInput } from '@/lib/proposals/form-mapping';
import type { ProposalItemInput, ProposalOptionInput } from '@/lib/proposals/types';

describe('applyPackageToOption', () => {
  it('snapshots items, add-ons, and package terms', () => {
    const option = applyPackageToOption(
      {
        notes: 'Everything for the day',
        items: [{ description: 'Ceremony', note: null, amount: 1000 }],
        addOns: [{ description: 'Late finish', note: null, amount: 500 }],
        package: { id: 'pkg1', gstInclusive: false, weekendLoadingPercent: 10, isPopular: true },
      },
      'Full day',
      2,
      false,
    );
    expect(option.title).toBe('Full day');
    expect(option.position).toBe(2);
    expect(option.sourcePackageId).toBe('pkg1');
    expect(option.gstInclusive).toBe(false);
    expect(option.weekendLoadingPercent).toBe(10);
    expect(option.isPopular).toBe(true);
    expect(option.items.map((i) => [i.description, i.isAddon, i.defaultIncluded])).toEqual([
      ['Ceremony', false, true],
      ['Late finish', true, false],
    ]);
    expect(option.items.every((i) => i.id.startsWith('new-'))).toBe(true);
  });

  it('clears isPopular when another option is already popular', () => {
    const option = applyPackageToOption(
      {
        notes: null,
        items: [{ description: 'Ceremony', note: null, amount: 1000 }],
        addOns: [],
        package: { id: 'pkg1', gstInclusive: true, weekendLoadingPercent: null, isPopular: true },
      },
      'Full day',
      2,
      true,
    );
    expect(option.isPopular).toBe(false);
  });
});

function makeItem(overrides: Partial<ProposalItemInput> = {}): ProposalItemInput {
  return {
    id: 'item-1',
    description: 'Ceremony',
    note: null,
    amount: 100,
    quantity: 1,
    isAddon: false,
    defaultIncluded: true,
    position: 1,
    ...overrides,
  };
}

function makeOption(overrides: Partial<ProposalOptionInput> = {}): ProposalOptionInput {
  return {
    id: 'option-1',
    position: 1,
    title: 'Full day',
    description: null,
    sourcePackageId: null,
    pricingMode: 'itemised',
    fixedPrice: null,
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: false,
    items: [],
    ...overrides,
  };
}

describe('toInput', () => {
  it('drops add-on items whose description is blank or whitespace-only', () => {
    const form = emptyForm('couple-1');
    form.options = [
      makeOption({
        items: [
          makeItem({ id: 'keep-base', description: 'Ceremony', isAddon: false }),
          makeItem({ id: 'drop-1', description: '', isAddon: true }),
          makeItem({ id: 'drop-2', description: '   ', isAddon: true }),
          makeItem({ id: 'keep-addon', description: 'Late finish', isAddon: true }),
        ],
      }),
    ];

    const input = toInput(form);

    expect(input.options[0]?.items.map((i) => i.id)).toEqual(['keep-base', 'keep-addon']);
  });

  it('does not drop a blank-description base (non-add-on) item', () => {
    const form = emptyForm('couple-1');
    form.options = [makeOption({ items: [makeItem({ id: 'base-blank', description: '', isAddon: false })] })];

    const input = toInput(form);

    expect(input.options[0]?.items.map((i) => i.id)).toEqual(['base-blank']);
  });

  it('maps a blank or whitespace-only option title to "Untitled option"', () => {
    const form = emptyForm('couple-1');
    form.options = [makeOption({ id: 'a', title: '' }), makeOption({ id: 'b', title: '   ' })];

    const input = toInput(form);

    expect(input.options.map((o) => o.title)).toEqual(['Untitled option', 'Untitled option']);
  });

  it('leaves a non-blank option title untouched', () => {
    const form = emptyForm('couple-1');
    form.options = [makeOption({ title: 'Full day' })];

    const input = toInput(form);

    expect(input.options[0]?.title).toBe('Full day');
  });
});

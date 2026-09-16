import { describe, expect, it } from 'vitest';

import { MAX_OPTIONS, saveProposalSchema } from '@/lib/proposals/schemas';

const option = (position: number) => ({
  id: `new-${position}`,
  position,
  title: `Option ${position}`,
  description: null,
  sourcePackageId: null,
  pricingMode: 'itemised' as const,
  fixedPrice: null,
  gstInclusive: true,
  weekendLoadingPercent: null,
  isPopular: false,
  items: [
    { id: 'new-i1', description: 'Ceremony', note: null, amount: 1000, quantity: 1, isAddon: false, defaultIncluded: true, position: 1 },
  ],
});

const base = {
  proposalId: null,
  coupleId: '11111111-1111-4111-8111-111111111111',
  eventId: null,
  title: 'Your day',
  introNote: null,
  heroOverride: null,
  expiresAt: null,
  depositPercent: 30,
  paymentScheduleId: null,
  contractTemplateId: null,
  options: [option(1)],
};

describe('saveProposalSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(saveProposalSchema.safeParse(base).success).toBe(true);
  });

  it('rejects more than MAX_OPTIONS options', () => {
    const options = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => option(i + 1));
    expect(saveProposalSchema.safeParse({ ...base, options }).success).toBe(false);
  });

  it('rejects a deposit outside 0-100', () => {
    expect(saveProposalSchema.safeParse({ ...base, depositPercent: 101 }).success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(saveProposalSchema.safeParse({ ...base, title: '' }).success).toBe(false);
  });

  it('allows zero options (a draft in progress)', () => {
    expect(saveProposalSchema.safeParse({ ...base, options: [] }).success).toBe(true);
  });
});

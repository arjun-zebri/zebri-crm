/**
 * `lib/proposals/template-preview-doc`: the couple-facing payload the Send
 * a proposal modal previews a template as, before any proposal row exists.
 *
 * @module tests/unit/proposals/template-preview-doc
 */
import { describe, expect, it } from 'vitest';

import type { PackageOption, ProposalLayout, Section } from '@/features/proposals';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import { templatePreviewDoc } from '@/lib/proposals/template-preview-doc';

const BRANDING = buildPublicBranding({});

/** One fully specified package card, so each assertion overrides only the field it is about. */
function card(overrides: Partial<PackageOption> = {}): PackageOption {
  return {
    id: 'pk-1',
    title: 'Reception MC',
    description: 'Five hours of hosting',
    pricingMode: 'single',
    fixedPrice: 1400,
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: false,
    items: [],
    ...overrides,
  };
}

/** A layout whose one packages section carries `options`. */
function layoutWith(options: PackageOption[]): ProposalLayout {
  const section: Section = {
    id: 'sec-packages',
    kind: 'packages',
    style: { height: 'fit' },
    data: { kind: 'packages', packages: { layout: 'cards', showInclusions: true, ctaLabel: 'Choose this', options } },
  };
  return { version: 2, sections: [section] };
}

/** The input every case starts from: a one-card template and a real couple. */
function input(overrides: Partial<Parameters<typeof templatePreviewDoc>[0]> = {}): Parameters<typeof templatePreviewDoc>[0] {
  return {
    layout: layoutWith([card()]),
    templateName: 'My proposal',
    branding: BRANDING,
    coupleName: 'Anna & Jake',
    eventDate: '2027-03-20',
    venue: 'Stones of the Yarra Valley',
    expiresAt: '2099-01-01',
    depositPercent: 25,
    ...overrides,
  };
}

describe('templatePreviewDoc', () => {
  it("fills in the couple's own name, date and venue", () => {
    const doc = templatePreviewDoc(input());
    expect(doc.coupleName).toBe('Anna & Jake');
    expect(doc.eventDate).toBe('2027-03-20');
    expect(doc.venue).toBe('Stones of the Yarra Valley');
    expect(doc.expiresAt).toBe('2099-01-01');
  });

  it('titles the preview the way the create action will title the proposal', () => {
    expect(templatePreviewDoc(input()).title).toBe('Anna & Jake, your wedding');
  });

  it('falls back to the placeholder wording when no couple is chosen yet', () => {
    const doc = templatePreviewDoc(input({ coupleName: null, eventDate: null, venue: null }));
    expect(doc.coupleName).toBe('Your couple');
    expect(doc.eventDate).toBeNull();
    expect(doc.venue).toBeNull();
    // The template's own name stands in rather than a half-written sentence.
    expect(doc.title).toBe('My proposal');
    expect(doc.refNumber).toBe('Draft');
  });

  it('treats a whitespace-only couple name as no couple at all', () => {
    expect(templatePreviewDoc(input({ coupleName: '   ' })).coupleName).toBe('Your couple');
  });

  it("carries the template's package cards through as the couple's options, in canvas order", () => {
    const doc = templatePreviewDoc(
      input({ layout: layoutWith([card({ id: 'pk-1', title: 'Reception' }), card({ id: 'pk-2', title: 'Full day', fixedPrice: 2400 })]) }),
    );
    expect(doc.proposal?.options.map((o) => [o.id, o.title, o.position, o.subtotal])).toEqual([
      ['pk-1', 'Reception', 0, 1400],
      ['pk-2', 'Full day', 1, 2400],
    ]);
  });

  it('carries the deposit the proposal would be created with, for the variable', () => {
    expect(templatePreviewDoc(input()).proposal?.depositPercent).toBe(25);
    expect(templatePreviewDoc(input({ depositPercent: null })).proposal?.depositPercent).toBeNull();
  });

  it('shows the open chooser for a template with no packages section', () => {
    const doc = templatePreviewDoc(input({ layout: { version: 2, sections: [] } }));
    expect(doc.proposal?.options).toEqual([]);
    expect(doc.proposal?.state).toBe('open');
  });

  it('shows the expired page when the chosen expiry is already past', () => {
    const doc = templatePreviewDoc(input({ expiresAt: '2000-01-01' }));
    expect(doc.proposal?.expired).toBe(true);
    expect(doc.proposal?.state).toBe('expired');
  });

  it('never previews an accepted or signing state: nothing has been created yet', () => {
    const doc = templatePreviewDoc(input());
    expect(doc.proposal?.state).toBe('open');
    expect(doc.proposal?.acceptedOptionId).toBeNull();
    expect(doc.proposal?.acceptedAt).toBeNull();
    // The note and hero come from the layout in v2, never from the send.
    expect(doc.proposal?.introNote).toBeNull();
    expect(doc.proposal?.heroOverride).toBeNull();
  });
});

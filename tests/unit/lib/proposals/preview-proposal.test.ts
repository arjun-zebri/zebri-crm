/**
 * Unit tests for `previewProposal`: maps the builder's live form state into
 * the public payload the preview pane renders, field by field, plus the
 * expiry check and the unsaved-draft placeholder fallbacks.
 */
import { describe, expect, it } from 'vitest';

import { buildPublicBranding } from '@/lib/branding/public-branding';
import { emptyForm } from '@/lib/proposals/form-factories';
import { type ProposalFormState } from '@/lib/proposals/form-mapping';
import { previewProposal } from '@/lib/proposals/preview-proposal';
import type { ProposalOptionInput } from '@/lib/proposals/types';

const branding = buildPublicBranding({});

function form(overrides: Partial<ProposalFormState> = {}): ProposalFormState {
  return { ...emptyForm(null), ...overrides };
}

function option(overrides: Partial<ProposalOptionInput> = {}): ProposalOptionInput {
  return {
    id: 'opt-1',
    position: 0,
    title: 'Reception MC',
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

describe('previewProposal', () => {
  it('maps every camelCase form field to its snake_case public field', () => {
    const f = form({
      proposalId: 'p1',
      title: 'Anna & Jake, your wedding',
      proposalNumber: 'PR-014',
      status: 'sent',
      version: 3,
      introNote: { type: 'doc', content: [] },
      heroOverride: { imagePath: 'x.jpg' },
      expiresAt: '2999-01-01',
      depositPercent: 25,
    });
    const p = previewProposal(f, branding, 'Anna & Jake');

    expect(p.id).toBe('p1');
    expect(p.title).toBe('Anna & Jake, your wedding');
    expect(p.proposal_number).toBe('PR-014');
    expect(p.status).toBe('sent');
    expect(p.version).toBe(3);
    expect(p.intro_note).toEqual({ type: 'doc', content: [] });
    expect(p.hero_override).toEqual({ imagePath: 'x.jpg' });
    expect(p.expires_at).toBe('2999-01-01');
    expect(p.deposit_percent).toBe(25);
    expect(p.couple_name).toBe('Anna & Jake');
  });

  it('maps an itemised option: pricing_mode, gst_inclusive, weekend_loading_percent, is_popular, subtotal from base items only', () => {
    const f = form({
      options: [
        option({
          pricingMode: 'itemised',
          gstInclusive: false,
          weekendLoadingPercent: 15,
          isPopular: true,
          items: [
            { id: 'i-1', description: 'Base line', note: null, amount: 100, quantity: 2, isAddon: false, defaultIncluded: true, position: 0 },
            { id: 'i-2', description: 'Add-on', note: null, amount: 50, quantity: 1, isAddon: true, defaultIncluded: false, position: 1 },
          ],
        }),
      ],
    });
    const p = previewProposal(f, branding, 'Anna & Jake');
    const o = p.options[0]!;

    expect(o.pricing_mode).toBe('itemised');
    expect(o.gst_inclusive).toBe(false);
    expect(o.weekend_loading_percent).toBe(15);
    expect(o.is_popular).toBe(true);
    // Base subtotal excludes the add-on line: 100 * 2 = 200.
    expect(o.subtotal).toBe(200);
  });

  it('maps a single-priced option: subtotal is the fixed price, not the items sum', () => {
    const f = form({
      options: [
        option({
          pricingMode: 'single',
          fixedPrice: 1800,
          items: [{ id: 'i-1', description: 'Inclusion', note: null, amount: 999, quantity: 1, isAddon: false, defaultIncluded: true, position: 0 }],
        }),
      ],
    });
    const p = previewProposal(f, branding, 'Anna & Jake');
    expect(p.options[0]?.pricing_mode).toBe('single');
    expect(p.options[0]?.fixed_price).toBe(1800);
    expect(p.options[0]?.subtotal).toBe(1800);
  });

  it('maps item fields: is_addon and default_included from isAddon and defaultIncluded', () => {
    const f = form({
      options: [
        option({
          items: [
            { id: 'i-1', description: 'Required', note: 'a note', amount: 100, quantity: 1, isAddon: false, defaultIncluded: true, position: 0 },
            { id: 'i-2', description: 'Optional', note: null, amount: 50, quantity: 1, isAddon: true, defaultIncluded: false, position: 1 },
          ],
        }),
      ],
    });
    const [required, optional] = previewProposal(f, branding, null).options[0]!.items;
    expect(required).toMatchObject({ id: 'i-1', note: 'a note', is_addon: false, default_included: true });
    expect(optional).toMatchObject({ id: 'i-2', is_addon: true, default_included: false });
  });

  it('sorts options and items by position regardless of array order', () => {
    const f = form({
      options: [
        option({ id: 'opt-b', position: 1, items: [
          { id: 'i-2', description: 'Second', note: null, amount: 1, quantity: 1, isAddon: false, defaultIncluded: true, position: 1 },
          { id: 'i-1', description: 'First', note: null, amount: 1, quantity: 1, isAddon: false, defaultIncluded: true, position: 0 },
        ] }),
        option({ id: 'opt-a', position: 0 }),
      ],
    });
    const p = previewProposal(f, branding, null);
    expect(p.options.map((o) => o.id)).toEqual(['opt-a', 'opt-b']);
    expect(p.options[1]?.items.map((i) => i.id)).toEqual(['i-1', 'i-2']);
  });

  it('derives expired from a past expiresAt', () => {
    expect(previewProposal(form({ expiresAt: '2000-01-01' }), branding, null).expired).toBe(true);
  });

  it('is not expired with a future expiresAt', () => {
    expect(previewProposal(form({ expiresAt: '2999-01-01' }), branding, null).expired).toBe(false);
  });

  it('is not expired with no expiresAt set', () => {
    expect(previewProposal(form({ expiresAt: null }), branding, null).expired).toBe(false);
  });

  it('falls back to placeholder copy for an unsaved draft: no title, number, or couple', () => {
    const p = previewProposal(form({ title: '', proposalNumber: null }), branding, null);
    expect(p.title).toBe('Untitled proposal');
    expect(p.proposal_number).toBe('Draft');
    expect(p.couple_name).toBe('Your couple');
  });

  it('uses the real couple name when one is selected', () => {
    expect(previewProposal(form(), branding, 'Anna & Jake').couple_name).toBe('Anna & Jake');
  });

  it('never carries acceptance/decline state, even for a sent proposal', () => {
    const p = previewProposal(form({ status: 'sent', proposalNumber: 'PR-014' }), branding, 'Anna & Jake');
    expect(p.accepted_option_id).toBeNull();
    expect(p.accepted_addon_selection).toBeNull();
    expect(p.accepted_at).toBeNull();
    expect(p.declined_at).toBeNull();
  });

  it('is never a live close session: no pending contract, invoice, or Connect', () => {
    const p = previewProposal(form(), branding, null);
    expect(p.pending_contract).toBeNull();
    expect(p.invoice).toBeNull();
    expect(p.stripe_connect_enabled).toBe(false);
  });
});

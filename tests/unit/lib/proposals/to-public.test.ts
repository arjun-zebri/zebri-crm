/**
 * Unit tests for `toPublicProposal`: maps the dashboard's full print row
 * into the public payload `/proposal/[token]` renders, ordering options
 * and items by position, keeping branding fields, and deriving `expired`
 * exactly like `get_public_proposal`.
 */
import { describe, expect, it } from 'vitest';

import type { ProposalPrintRow } from '@/app/(dashboard)/proposals/use-proposals';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import { deriveState } from '@/lib/proposals/public-types';
import { toPublicProposal } from '@/lib/proposals/to-public';

const branding = buildPublicBranding({});

function row(overrides: Partial<ProposalPrintRow> = {}): ProposalPrintRow {
  return {
    id: 'p1',
    proposal_number: 'PR-001',
    title: 'A proposal',
    status: 'sent',
    expires_at: null,
    email_sent_at: null,
    last_viewed_at: null,
    created_at: '2026-01-01',
    version: 1,
    share_token: 'tok',
    share_token_enabled: true,
    first_viewed_at: null,
    view_count: 0,
    declined_reason: null,
    declined_message: null,
    contract_id: null,
    invoice_id: null,
    intro_note: null,
    hero_override: null,
    deposit_percent: 20,
    accepted_option_id: null,
    accepted_addon_selection: null,
    accepted_at: null,
    declined_at: null,
    couple: { id: 'c1', name: 'Anna & Jake', event_date: '2027-01-01', venue: 'The Barn' },
    proposal_options: [
      {
        id: 'opt-2', proposal_id: 'p1', user_id: 'u1', created_at: '2026-01-01', position: 1,
        title: 'Full day', description: null, pricing_mode: 'itemised', fixed_price: null,
        gst_inclusive: true, weekend_loading_percent: null, is_popular: true, subtotal: 2000,
        source_package_id: null,
        proposal_option_items: [
          { id: 'i-2', option_id: 'opt-2', user_id: 'u1', created_at: '2026-01-01', description: 'Second item', note: null, amount: 500, quantity: 1, is_addon: false, default_included: true, position: 1 },
          { id: 'i-1', option_id: 'opt-2', user_id: 'u1', created_at: '2026-01-01', description: 'First item', note: null, amount: 1500, quantity: 1, is_addon: false, default_included: true, position: 0 },
        ],
      },
      {
        id: 'opt-1', proposal_id: 'p1', user_id: 'u1', created_at: '2026-01-01', position: 0,
        title: 'Reception MC', description: null, pricing_mode: 'itemised', fixed_price: null,
        gst_inclusive: true, weekend_loading_percent: null, is_popular: false, subtotal: 1650,
        source_package_id: null, proposal_option_items: [],
      },
    ],
    ...overrides,
  } as ProposalPrintRow;
}

describe('toPublicProposal', () => {
  it('sorts options and items by position and keeps branding + couple fields', () => {
    const p = toPublicProposal(row(), branding, []);
    expect(p.options.map((o) => o.id)).toEqual(['opt-1', 'opt-2']);
    expect(p.options[1]?.items.map((i) => i.id)).toEqual(['i-1', 'i-2']);
    expect(p.brand_color).toBe(branding.brand_color);
    expect(p.couple_name).toBe('Anna & Jake');
    expect(p.event_date).toBe('2027-01-01');
    expect(p.venue).toBe('The Barn');
    expect(p.deposit_percent).toBe(20);
  });

  it('has no pending contract or invoice, and no Connect, for the PDF print path', () => {
    const p = toPublicProposal(row(), branding, []);
    expect(p.pending_contract).toBeNull();
    expect(p.invoice).toBeNull();
    expect(p.stripe_connect_enabled).toBe(false);
  });

  it('derives expired from a past expires_at', () => {
    const p = toPublicProposal(row({ expires_at: '2000-01-01' }), branding, []);
    expect(p.expired).toBe(true);
  });

  it('is not expired with a future expires_at', () => {
    const p = toPublicProposal(row({ expires_at: '2999-01-01' }), branding, []);
    expect(p.expired).toBe(false);
  });

  it('never expires an accepted proposal, even with a past expires_at', () => {
    const p = toPublicProposal(
      row({ expires_at: '2000-01-01', status: 'accepted', accepted_at: '2026-01-05T00:00:00Z' }),
      branding,
      [],
    );
    // `expired` still mirrors the RPC (true), but deriveState ranks
    // accepted above expired, so the couple never sees this as lapsed.
    expect(deriveState(p)).toBe('accepted');
  });
});

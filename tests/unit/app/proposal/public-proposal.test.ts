import { describe, expect, it } from 'vitest';

import { deriveState, type PublicProposal } from '@/app/proposal/[token]/_components/public-proposal';

const base = {
  id: 'p', title: 't', proposal_number: 'PR-001', status: 'sent', version: 1, intro_note: null,
  hero_override: null, expires_at: null, expired: false, deposit_percent: 30, accepted_option_id: null,
  accepted_addon_selection: null, accepted_at: null, declined_at: null, couple_name: 'A & B',
  event_date: null, venue: null, options: [], branding_blocks: null,
  pending_contract: null, invoice: null, stripe_connect_enabled: false,
} as unknown as PublicProposal;

describe('deriveState', () => {
  it('is active by default', () => expect(deriveState(base)).toBe('active'));
  it('expired wins over sent', () => expect(deriveState({ ...base, expired: true })).toBe('expired'));
  it('accepted wins over expired', () => expect(deriveState({ ...base, expired: true, accepted_at: 'x' })).toBe('accepted'));
  it('declined', () => expect(deriveState({ ...base, declined_at: 'x' })).toBe('declined'));

  it('is signing when a pending contract is awaiting signature', () => {
    expect(deriveState({ ...base, pending_contract: { sign_token: 't', contract_number: 'C-1', title: null, locked_content_html: null, signed_at: null } })).toBe(
      'signing',
    );
  });

  it('declined wins over a pending contract', () => {
    expect(
      deriveState({
        ...base,
        declined_at: 'x',
        pending_contract: { sign_token: 't', contract_number: 'C-1', title: null, locked_content_html: null, signed_at: null },
      }),
    ).toBe('declined');
  });

  it('is paying when accepted with an unpaid first invoice stage', () => {
    expect(
      deriveState({
        ...base,
        accepted_at: 'x',
        invoice: {
          id: 'inv-1', share_token: 'tok', invoice_number: 'INV-1', stripe_payment_enabled: true, paid_at: null,
          first_stage: { id: 's1', label: 'Deposit', amount_cents: 5000, due_date: null, paid_at: null },
        },
      }),
    ).toBe('paying');
  });

  it('is accepted (not paying) once the first invoice stage is paid', () => {
    expect(
      deriveState({
        ...base,
        accepted_at: 'x',
        invoice: {
          id: 'inv-1', share_token: 'tok', invoice_number: 'INV-1', stripe_payment_enabled: true, paid_at: null,
          first_stage: { id: 's1', label: 'Deposit', amount_cents: 5000, due_date: null, paid_at: 'x' },
        },
      }),
    ).toBe('accepted');
  });

  it('is accepted (not paying) when there is no invoice yet', () => {
    expect(deriveState({ ...base, accepted_at: 'x', invoice: null })).toBe('accepted');
  });
});

/**
 * Resume rules for the accept stepper (ruling W3b + the publish-failed
 * case): which pane a reload mid-flow opens on.
 *
 * @module tests/unit/app/proposal/resume-flow.test
 */
import { describe, expect, it } from 'vitest';

import { initialFlow } from '@/app/proposal/[token]/_components/resume-flow';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import type { PendingContract } from '@/lib/proposals/close-types';
import type { PublicProposal } from '@/lib/proposals/public-types';
import { sampleProposal } from '@/lib/proposals/sample-proposal';

const proposal: PublicProposal = sampleProposal(buildPublicBranding({ id: 'u1', user_metadata: {} } as never));
const option = proposal.options[0]!;
const pending: PendingContract = { sign_token: 'tok', contract_number: 'C-1', title: 'Agreement', locked_content_html: '<p>Body</p>', signed_at: null };

describe('initialFlow', () => {
  it('opens on choose for an untouched proposal', () => {
    expect(initialFlow(proposal)).toEqual({ step: 'choose', contract: null, invoice: null });
  });

  it('resumes on sign with the pending contract and recomputed totals', () => {
    const flow = initialFlow({ ...proposal, accepted_option_id: option.id, accepted_addon_selection: [], pending_contract: pending });
    expect(flow.step).toBe('sign');
    expect(flow.contract).toMatchObject({ sign_token: 'tok', contract: { contract_number: 'C-1', locked_content_html: '<p>Body</p>' } });
    expect(flow.contract!.total).toBeGreaterThan(0);
  });

  it('resumes on choose when the accept route published nothing (locked_content_html null)', () => {
    const flow = initialFlow({
      ...proposal,
      accepted_option_id: option.id,
      accepted_addon_selection: [],
      pending_contract: { ...pending, locked_content_html: null },
    });
    expect(flow).toEqual({ step: 'choose', contract: null, invoice: null });
  });

  it('never reopens the sign step on a signed contract the page could not finalize', () => {
    const flow = initialFlow({
      ...proposal,
      accepted_option_id: option.id,
      accepted_addon_selection: [],
      pending_contract: { ...pending, signed_at: '2026-09-14T00:00:00Z' },
    });
    expect(flow.step).toBe('done');
    expect(flow.contract).toBeNull();
  });

  it('resumes on pay once accepted with an unpaid first stage, and on done once paid', () => {
    const invoice = { id: 'i1', share_token: 't', invoice_number: 'INV-1', stripe_payment_enabled: true, paid_at: null, first_stage: { id: 's1', label: 'Deposit', amount_cents: 5000, due_date: null, paid_at: null } };
    expect(initialFlow({ ...proposal, accepted_at: 'x', invoice }).step).toBe('pay');
    expect(initialFlow({ ...proposal, accepted_at: 'x', invoice: { ...invoice, first_stage: { ...invoice.first_stage, paid_at: 'y' } } }).step).toBe('done');
  });
});

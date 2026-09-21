/**
 * Unit tests for `AcceptStepper`: the public proposal's Choose -> Sign ->
 * Pay -> Done dialog. Fetch is stubbed per test; `PayWithCardButton` is
 * mocked to a plain labelled button since its own Stripe wiring is covered
 * by its own tests.
 *
 * @module tests/unit/app/proposal/accept-stepper.test
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AcceptStepper } from '@/app/proposal/[token]/_components/accept-stepper';
import { priced } from '@/lib/branding/public-blocks/proposal/package-card';
import { fmt } from '@/lib/branding/public-blocks/shared';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import type { AcceptResponse, PublicProposalInvoice } from '@/lib/proposals/close-types';
import { depositAmount, optionTotal } from '@/lib/proposals/pricing';
import type { PublicProposal } from '@/lib/proposals/public-types';
import { sampleProposal } from '@/lib/proposals/sample-proposal';

vi.mock('@/app/invoice/[token]/pay-with-card-button', () => ({
  PayWithCardButton: () => <button type="button">Pay with card</button>,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const bankBranding = buildPublicBranding({ bank_account_name: 'MC Co', bank_bsb: '063-000', bank_account_number: '12345678' });
const plainBranding = buildPublicBranding({});
const proposal: PublicProposal = sampleProposal(plainBranding);

const acceptResponse: AcceptResponse = {
  ok: true,
  sign_token: 'sign-token-abc',
  contract: { contract_number: 'C-100', title: 'Agreement', locked_content_html: '<p>Sign this agreement</p>' },
  total: optionTotal(priced(proposal.options[1]!), ['i-7']),
  deposit: depositAmount(optionTotal(priced(proposal.options[1]!), ['i-7']), proposal.deposit_percent),
};

function invoiceWith(stripePaymentEnabled: boolean): PublicProposalInvoice {
  return {
    id: 'inv-1',
    share_token: 'inv-share',
    invoice_number: 'INV-1',
    stripe_payment_enabled: stripePaymentEnabled,
    paid_at: null,
    first_stage: { id: 'stage-1', label: 'Deposit', amount_cents: 67500, due_date: '2026-10-01', paid_at: null },
  };
}

function baseProps() {
  return {
    open: true,
    onClose: vi.fn(),
    token: 'tok-1',
    proposal,
    selectedOptionId: 'opt-2',
    selectedAddonIds: ['i-7'] as readonly string[],
    onSelectOption: vi.fn(),
    onToggleAddon: vi.fn(),
  };
}

async function fillAndSign(name = 'Anna Smith') {
  fireEvent.change(screen.getByLabelText('Your full legal name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign and confirm' }));
}

describe('AcceptStepper', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. opens on choose with the popular option, shows the total + deposit, and Continue moves to sign', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, acceptResponse));
    render(<AcceptStepper {...baseProps()} />);

    const total = optionTotal(priced(proposal.options[1]!), ['i-7']);
    const deposit = depositAmount(total, proposal.deposit_percent);
    expect(screen.getByText(`Total ${fmt(total)}`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(fmt(deposit).replace('$', '\\$')))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to sign' }));

    expect(fetch).toHaveBeenCalledWith(
      '/api/proposal/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'tok-1', optionId: 'opt-2', addonIds: ['i-7'] }),
      }),
    );

    await screen.findByText('Sign this agreement');
    expect(screen.getByLabelText('Your full legal name')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I agree/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign and confirm' })).toBeInTheDocument();
  });

  it('2. signing posts to /api/contract/sign and moves to pay when stripe is enabled; skipping moves to done', async () => {
    const pendingProposal: PublicProposal = {
      ...proposal,
      ...bankBranding,
      stripe_connect_enabled: true,
      accepted_option_id: 'opt-2',
      accepted_addon_selection: ['i-7'],
      pending_contract: { sign_token: 'sign-token-abc', contract_number: 'C-100', title: 'Agreement', locked_content_html: '<p>Sign this agreement</p>', signed_at: null },
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true, proposal_invoice: invoiceWith(true) }));
    render(<AcceptStepper {...baseProps()} proposal={pendingProposal} />);

    await fillAndSign();

    expect(fetch).toHaveBeenCalledWith(
      '/api/contract/sign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'sign-token-abc', signer_name: 'Anna Smith', signature_mode: 'typed' }),
      }),
    );

    await screen.findByText('Pay with card');
    expect(screen.getByText(/Bank transfer/)).toBeInTheDocument();
    expect(screen.getByText(/Reference: INV-1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pay by bank transfer later' }));
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
  });

  it('3. only bank details show when stripe_payment_enabled is false', async () => {
    const pendingProposal: PublicProposal = {
      ...proposal,
      ...bankBranding,
      accepted_option_id: 'opt-2',
      accepted_addon_selection: ['i-7'],
      pending_contract: { sign_token: 'sign-token-abc', contract_number: 'C-100', title: 'Agreement', locked_content_html: '<p>Sign this agreement</p>', signed_at: null },
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true, proposal_invoice: invoiceWith(false) }));
    render(<AcceptStepper {...baseProps()} proposal={pendingProposal} />);

    await fillAndSign();

    await screen.findByText(/Bank transfer/);
    expect(screen.queryByRole('button', { name: 'Pay with card' })).toBeNull();
  });

  it('4. an accept error shows copy and stays on choose', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { error: 'expired' }));
    render(<AcceptStepper {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue to sign' }));

    await screen.findByText('This proposal has expired.');
    expect(screen.getByRole('button', { name: 'Continue to sign' })).toBeInTheDocument();
  });

  it('5. resumes on sign when pending_contract is set, and on pay when accepted with an unpaid first stage', () => {
    const signingProposal: PublicProposal = {
      ...proposal,
      accepted_option_id: 'opt-2',
      accepted_addon_selection: ['i-7'],
      pending_contract: { sign_token: 'sign-token-abc', contract_number: 'C-100', title: 'Agreement', locked_content_html: '<p>Sign this agreement</p>', signed_at: null },
    };
    const { unmount } = render(<AcceptStepper {...baseProps()} proposal={signingProposal} />);
    expect(screen.getByText('Sign this agreement')).toBeInTheDocument();
    unmount();

    const payingProposal: PublicProposal = {
      ...proposal,
      accepted_option_id: 'opt-2',
      accepted_addon_selection: ['i-7'],
      accepted_at: '2026-09-01T00:00:00Z',
      invoice: invoiceWith(true),
    };
    render(<AcceptStepper {...baseProps()} proposal={payingProposal} />);
    expect(screen.getByText(/Deposit: /)).toBeInTheDocument();
  });

  it('6. is named "Confirm your booking"; Escape closes it, but not while a request is in flight', async () => {
    const onClose = vi.fn();
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    render(<AcceptStepper {...baseProps()} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Confirm your booking' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to sign' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to sign' })).toBeDisabled());

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveFetch?.(jsonResponse(200, acceptResponse));
    await screen.findByText('Sign this agreement');
  });

  it('7. names the current step and its position, and advances as the flow does', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, acceptResponse));
    const { container } = render(<AcceptStepper {...baseProps()} />);

    expect(screen.getAllByText('Step 1 of 4: Choose').length).toBeGreaterThan(0);
    expect(container.querySelector('li[aria-current="step"]')?.textContent).toContain('Choose');

    fireEvent.click(screen.getByRole('button', { name: 'Continue to sign' }));
    await screen.findByText('Sign this agreement');

    expect(screen.getAllByText('Step 2 of 4: Sign').length).toBeGreaterThan(0);
    expect(container.querySelector('li[aria-current="step"]')?.textContent).toContain('Sign');
  });
});

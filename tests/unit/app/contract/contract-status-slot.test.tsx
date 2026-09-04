/**
 * Unit tests for ContractStatusSlot.
 *
 * The slot is the ONE place a document-level status banner comes from: the
 * live page and `contractPrintElement` both render it, and the page passes it
 * straight back in as `statusBanner`, so what these tests assert is also what
 * the downloaded PDF contains.
 *
 * The signed case is a regression guard. A green box reading "Signed by X on
 * <date>" with the signer's IP under it used to sit above the signature
 * panels that already say the same thing, and it survived on the printed
 * document after being taken off the screen once before.
 *
 * @module tests/unit/app/contract/contract-status-slot.test
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContractStatusSlot } from '@/app/contract/[token]/_components/contract-status-slot';
import type { PublicContract } from '@/app/contract/[token]/_components/public-contract';

function contractWith(overrides: Partial<PublicContract> = {}): PublicContract {
  return {
    signer_name: 'Yoohoo',
    signed_at: '2026-09-04T00:56:00Z',
    signer_ip: '::1',
    declined_at: '2026-09-04T00:56:00Z',
    declined_reason: 'Changed our mind',
    expires_at: '2026-09-01',
    business_name: 'Acme Weddings',
    corner_radius: 8,
    vendor_role: 'MC',
    ...overrides,
  } as unknown as PublicContract;
}

describe('ContractStatusSlot', () => {
  it('renders nothing at all for a signed contract', () => {
    const { container } = render(
      <ContractStatusSlot contract={contractWith()} pageState="signed" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('never leaks the signer name, sign date or IP into a banner', () => {
    render(<ContractStatusSlot contract={contractWith()} pageState="signed" />);
    expect(screen.queryByText(/Signed by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Yoohoo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/IP/)).not.toBeInTheDocument();
  });

  it('renders nothing for an active contract', () => {
    const { container } = render(
      <ContractStatusSlot contract={contractWith()} pageState="active" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('still announces a decline, with the reason', () => {
    render(<ContractStatusSlot contract={contractWith()} pageState="declined" />);
    expect(screen.getByText(/was declined/i)).toBeInTheDocument();
    expect(screen.getByText(/Changed our mind/)).toBeInTheDocument();
  });

  it('still announces an expiry', () => {
    render(<ContractStatusSlot contract={contractWith()} pageState="expired" />);
    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  });
});

/**
 * Unit tests for ContractDeclineNotice — the decline panel surfaced on a
 * contract the couple turned down.
 *
 * The signed counterpart was removed: the Activity panel is the single place
 * the signed event is reported. These tests cover what is left, which is the
 * reason text, the one fact about a decline that lives nowhere else.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContractDeclineNotice } from '@/components/builders/parts/contract-decline-notice';

describe('ContractDeclineNotice', () => {
  it('renders the Declined header', () => {
    render(<ContractDeclineNotice declinedReason={null} />);
    expect(screen.getByText(/^Declined$/)).toBeInTheDocument();
  });

  it('renders the reason when present', () => {
    render(<ContractDeclineNotice declinedReason="Changed our mind" />);
    expect(screen.getByText(/Changed our mind/)).toBeInTheDocument();
  });

  it('omits the reason block when null', () => {
    render(<ContractDeclineNotice declinedReason={null} />);
    expect(screen.queryByText(/Reason:/i)).not.toBeInTheDocument();
  });
});

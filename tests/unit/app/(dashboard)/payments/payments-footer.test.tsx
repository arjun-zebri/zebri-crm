/**
 * Unit tests for `PaymentsFooter`.
 *
 * Confirms the count + noun pluralisation per tab and that the total
 * cell is omitted on the Contracts tab.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PaymentsFooter } from '@/app/(dashboard)/payments/payments-footer';

describe('PaymentsFooter', () => {
  it.each([
    ['quotes', 1, '1 quote'],
    ['quotes', 5, '5 quotes'],
    ['invoices', 1, '1 invoice'],
    ['invoices', 0, '0 invoices'],
    ['contracts', 1, '1 contract'],
    ['contracts', 3, '3 contracts'],
  ] as const)('renders %s count=%i as "%s"', (tab, count, expected) => {
    render(<PaymentsFooter tab={tab} count={count} total={0} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders the money total for quotes', () => {
    render(<PaymentsFooter tab="quotes" count={2} total={4900} />);
    expect(screen.getByText(/\$4,900/)).toBeInTheDocument();
  });

  it('omits the money total when undefined (contracts tab)', () => {
    const { container } = render(
      <PaymentsFooter tab="contracts" count={2} />,
    );
    // Only the count <p>, no second <p> with money.
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});

/**
 * Unit tests for TotalsPanel — pure presentation.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TotalsPanel } from '@/components/builders/parts/totals-panel';

describe('TotalsPanel', () => {
  it('always renders Subtotal + Total', () => {
    render(<TotalsPanel subtotal={1000} total={1000} />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThanOrEqual(2);
  });

  it('omits Discount + GST lines when both are undefined', () => {
    render(<TotalsPanel subtotal={1000} total={1000} />);
    expect(screen.queryByText('Discount')).toBeNull();
    expect(screen.queryByText('GST 10%')).toBeNull();
  });

  it('renders Discount with negative sign', () => {
    render(<TotalsPanel subtotal={1000} discount={100} total={900} />);
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-$100.00')).toBeInTheDocument();
  });

  it('renders GST line', () => {
    render(<TotalsPanel subtotal={1000} tax={100} total={1100} />);
    expect(screen.getByText('GST 10%')).toBeInTheDocument();
  });

  it('supports a custom tax label', () => {
    render(<TotalsPanel subtotal={1000} tax={50} taxLabel="VAT 5%" total={1050} />);
    expect(screen.getByText('VAT 5%')).toBeInTheDocument();
  });
});

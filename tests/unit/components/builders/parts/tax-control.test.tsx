/**
 * Unit tests for TaxControl — popover-driven chip with configurable
 * tax rate. The trigger flips between "Tax" (neutral) and "GST X%"
 * (success tone) based on the `rate` prop.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TaxControl } from '@/components/builders/parts/tax-control';

const noop = () => undefined;

describe('TaxControl', () => {
  it('renders the neutral "Tax" trigger when rate is null', () => {
    render(<TaxControl rate={null} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Add tax/i })).toHaveTextContent('Tax');
  });

  it('renders the applied "GST 10%" trigger when rate is 10', () => {
    render(<TaxControl rate={10} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Edit tax rate/i })).toHaveTextContent('GST 10%');
  });

  it('renders a custom rate label when rate differs from default', () => {
    render(<TaxControl rate={5} canEdit onChange={noop} />);
    expect(screen.getByRole('button', { name: /Edit tax rate/i })).toHaveTextContent('GST 5%');
  });

  it('seeds the default rate when the trigger is clicked in unapplied state', async () => {
    const onChange = vi.fn();
    render(<TaxControl rate={null} canEdit onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Add tax/i }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('disables the trigger when canEdit=false', () => {
    render(<TaxControl rate={null} canEdit={false} onChange={noop} />);
    expect(screen.getByRole('button', { name: /Add tax/i })).toBeDisabled();
  });
});

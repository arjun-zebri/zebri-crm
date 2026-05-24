/**
 * Unit tests for TaxControl — "+ Apply 10% GST" / "Remove GST" link.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TaxControl } from '@/components/builders/parts/tax-control';

const noop = () => undefined;

describe('TaxControl', () => {
  it('renders "Apply 10% GST" when not applied', () => {
    render(<TaxControl applied={false} canEdit onApply={vi.fn()} onRemove={noop} />);
    expect(screen.getByRole('button', { name: /Apply 10% GST/i })).toBeInTheDocument();
  });

  it('renders the applied-state "GST 10%" pill when applied', () => {
    render(<TaxControl applied canEdit onApply={noop} onRemove={vi.fn()} />);
    // The applied state shows the GST 10% label as a removable pill.
    expect(screen.getByRole('button', { name: /GST 10%/i })).toBeInTheDocument();
  });

  it('calls onApply when applying', async () => {
    const onApply = vi.fn();
    render(<TaxControl applied={false} canEdit onApply={onApply} onRemove={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /Apply 10% GST/i }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('calls onRemove when removing', async () => {
    const onRemove = vi.fn();
    render(<TaxControl applied canEdit onApply={noop} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /GST 10%/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('disables editing when canEdit=false', () => {
    render(<TaxControl applied={false} canEdit={false} onApply={noop} onRemove={noop} />);
    expect(screen.getByRole('button', { name: /Apply 10% GST/i })).toBeDisabled();
  });
});

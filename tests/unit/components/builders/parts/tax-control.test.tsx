/**
 * Unit tests for TaxControl — "+ GST 10%" / "× GST 10%" chip states.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TaxControl } from '@/components/builders/parts/tax-control';

const noop = () => undefined;

describe('TaxControl', () => {
  it('renders the "GST 10%" chip when not applied', () => {
    render(<TaxControl applied={false} canEdit onApply={vi.fn()} onRemove={noop} />);
    expect(screen.getByRole('button', { name: /GST 10%/i })).toBeInTheDocument();
  });

  it('renders the applied-state "GST 10%" chip when applied', () => {
    render(<TaxControl applied canEdit onApply={noop} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /GST 10%/i })).toBeInTheDocument();
  });

  it('calls onApply when clicked in the unapplied state', async () => {
    const onApply = vi.fn();
    render(<TaxControl applied={false} canEdit onApply={onApply} onRemove={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /GST 10%/i }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('calls onRemove when clicked in the applied state', async () => {
    const onRemove = vi.fn();
    render(<TaxControl applied canEdit onApply={noop} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /GST 10%/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('disables the chip when canEdit=false', () => {
    render(<TaxControl applied={false} canEdit={false} onApply={noop} onRemove={noop} />);
    expect(screen.getByRole('button', { name: /GST 10%/i })).toBeDisabled();
  });
});

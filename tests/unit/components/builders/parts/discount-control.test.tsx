/**
 * Unit tests for DiscountControl — collapsed chip + expanded pill.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscountControl } from '@/components/builders/parts/discount-control';

const noop = () => undefined;

describe('DiscountControl', () => {
  it('renders the collapsed chip when type is null', () => {
    render(
      <DiscountControl
        type={null}
        value={null}
        canEdit
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onTypeChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^Discount$/i })).toBeInTheDocument();
  });

  it('calls onAdd when the collapsed chip is clicked', async () => {
    const onAdd = vi.fn();
    render(
      <DiscountControl
        type={null}
        value={null}
        canEdit
        onAdd={onAdd}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Discount$/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders the expanded pill with label + value input + type toggle', () => {
    render(
      <DiscountControl
        type="percentage"
        value={10}
        canEdit
        onAdd={noop}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    // Single toggle button cycles between % and $ — shows current type as label.
    expect(screen.getByRole('button', { name: /Switch to fixed amount/i })).toBeInTheDocument();
  });

  it('cycles type when the toggle is clicked', async () => {
    const onTypeChange = vi.fn();
    render(
      <DiscountControl
        type="percentage"
        value={10}
        canEdit
        onAdd={noop}
        onRemove={noop}
        onTypeChange={onTypeChange}
        onValueChange={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Switch to fixed amount/i }));
    expect(onTypeChange).toHaveBeenCalledWith('fixed');
  });

  it('cycles back from fixed to percentage', async () => {
    const onTypeChange = vi.fn();
    render(
      <DiscountControl
        type="fixed"
        value={100}
        canEdit
        onAdd={noop}
        onRemove={noop}
        onTypeChange={onTypeChange}
        onValueChange={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Switch to percentage/i }));
    expect(onTypeChange).toHaveBeenCalledWith('percentage');
  });

  it('calls onRemove when the × button is clicked', async () => {
    const onRemove = vi.fn();
    render(
      <DiscountControl
        type="percentage"
        value={10}
        canEdit
        onAdd={noop}
        onRemove={onRemove}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Remove discount/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('disables the value input when canEdit=false', () => {
    render(
      <DiscountControl
        type="percentage"
        value={10}
        canEdit={false}
        onAdd={noop}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    expect(screen.getByDisplayValue('10')).toBeDisabled();
  });
});

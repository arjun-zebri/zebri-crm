/**
 * Unit tests for DiscountControl — collapsed link + expanded editor.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscountControl } from '@/components/builders/parts/discount-control';

const noop = () => undefined;

describe('DiscountControl', () => {
  it('renders the collapsed link when type is null', () => {
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

  it('calls onAdd when the link is clicked', async () => {
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

  it('renders the expanded editor when type is set', () => {
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
    expect(screen.getByRole('button', { name: '%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '$' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('calls onTypeChange when the type toggle is clicked', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: '$' }));
    expect(onTypeChange).toHaveBeenCalledWith('fixed');
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

  it('disables editing when canEdit=false', () => {
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

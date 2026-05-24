/**
 * Unit tests for DiscountControl — popover-driven chip with segmented
 * type switcher + value input + Remove/Done buttons.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscountControl } from '@/components/builders/parts/discount-control';

const noop = () => undefined;

describe('DiscountControl', () => {
  it('renders the bare "Discount" trigger when nothing is configured', () => {
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
    expect(screen.getByRole('button', { name: /Add discount/i })).toHaveTextContent('Discount');
  });

  it('renders the configured value in the trigger when type=percentage', () => {
    render(
      <DiscountControl
        type="percentage"
        value={15}
        canEdit
        onAdd={noop}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Edit discount/i })).toHaveTextContent('Discount 15%');
  });

  it('renders a fixed dollar value in the trigger when type=fixed', () => {
    render(
      <DiscountControl
        type="fixed"
        value={250}
        canEdit
        onAdd={noop}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Edit discount/i })).toHaveTextContent('Discount $250.00');
  });

  it('seeds a default discount when the trigger is clicked in the empty state', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /Add discount/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('disables the trigger when canEdit=false', () => {
    render(
      <DiscountControl
        type={null}
        value={null}
        canEdit={false}
        onAdd={noop}
        onRemove={noop}
        onTypeChange={noop}
        onValueChange={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Add discount/i })).toBeDisabled();
  });
});

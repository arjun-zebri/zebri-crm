/**
 * Unit tests for LineItemsTable — empty state + populated + callbacks.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  LineItemsTable,
  type LineItem,
} from '@/components/builders/parts/line-items-table';

function makeItem(over: Partial<LineItem> = {}): LineItem {
  return {
    id: over.id ?? 'i1',
    description: over.description ?? 'Ceremony',
    amount: over.amount ?? 5000,
    position: over.position ?? 0,
  };
}

describe('LineItemsTable', () => {
  it('renders the empty-state CTA when no items', () => {
    render(
      <LineItemsTable
        items={[]}
        canEdit
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add your first line item/i)).toBeInTheDocument();
  });

  it('fires onAdd from the empty-state CTA', async () => {
    const onAdd = vi.fn();
    render(
      <LineItemsTable
        items={[]}
        canEdit
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Add your first line item/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders rows for each item with description + amount inputs', () => {
    render(
      <LineItemsTable
        items={[makeItem(), makeItem({ id: 'i2', description: 'Reception', amount: 3500 })]}
        canEdit
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Ceremony')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Reception')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
  });

  it('fires onUpdate when description changes', async () => {
    const onUpdate = vi.fn();
    render(
      <LineItemsTable
        items={[makeItem()]}
        canEdit
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const input = screen.getByDisplayValue('Ceremony');
    await userEvent.type(input, '!');
    expect(onUpdate).toHaveBeenLastCalledWith('i1', 'description', 'Ceremony!');
  });

  it('fires onRemove when the trash icon is clicked', async () => {
    const onRemove = vi.fn();
    render(
      <LineItemsTable
        items={[makeItem()]}
        canEdit
        onUpdate={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    expect(onRemove).toHaveBeenCalledWith('i1');
  });

  it('locks inputs + hides delete when canEdit=false', () => {
    render(
      <LineItemsTable
        items={[makeItem()]}
        canEdit={false}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onReorder={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Ceremony')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove item' })).toBeNull();
  });
});

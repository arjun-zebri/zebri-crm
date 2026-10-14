/**
 * Unit tests for RowActionsMenu: the trigger's accessible name and the
 * menu's actions. Behaviour is unchanged apart from the optional label.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RowActionsMenu } from '@/components/ui/row-actions-menu';

describe('RowActionsMenu', () => {
  it('keeps "Row actions" as the default trigger name', () => {
    render(<RowActionsMenu actions={[{ label: 'Finish', onSelect: vi.fn() }]} />);
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('names the trigger for the row when a label is given', () => {
    render(<RowActionsMenu label="More actions for Jo Smith" actions={[{ label: 'Finish', onSelect: vi.fn() }]} />);
    expect(screen.getByRole('button', { name: 'More actions for Jo Smith' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
  });

  it('runs the chosen action', () => {
    const onSelect = vi.fn();
    render(<RowActionsMenu label="More actions for Jo Smith" actions={[{ label: 'Finish', onSelect }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Jo Smith' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

/**
 * The Prospects page's first-run and everyday controls: the empty state,
 * the toolbar's disabled check, the stats strip as a filter, and the
 * needs-review line.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProspectsEmpty } from '@/features/outreach/views/prospects/prospects-empty';
import { ALL } from '@/features/outreach/views/prospects/prospects-filters';
import { ProspectsStats } from '@/features/outreach/views/prospects/prospects-stats';
import { ProspectsToolbar } from '@/features/outreach/views/prospects/prospects-toolbar';
import { ReviewCallout } from '@/features/outreach/views/prospects/review-callout';

const counts = { unchecked: 4, active: 2, inactive: 1, needsReview: 3 };

describe('ProspectsEmpty', () => {
  it('offers an import, or adding someone by hand', () => {
    const onImport = vi.fn();
    const onAdd = vi.fn();
    render(<ProspectsEmpty onImport={onImport} onAdd={onAdd} />);
    expect(screen.getByText('No prospects yet')).toBeInTheDocument();
    expect(screen.getByText('Import your celebrant sheet, or add someone by hand.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import sheet' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('ProspectsToolbar', () => {
  it('offers Table and Board, and reports the layout picked', () => {
    const onLayout = vi.fn();
    render(<ProspectsToolbar board={false} unchecked={2} onLayout={onLayout} onImport={vi.fn()} onAdd={vi.fn()} onCheck={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(onLayout).toHaveBeenCalledWith('board');
  });

  it('enables Run activity check while someone is unchecked', () => {
    const onCheck = vi.fn();
    render(<ProspectsToolbar board={false} unchecked={2} onLayout={vi.fn()} onImport={vi.fn()} onAdd={vi.fn()} onCheck={onCheck} />);
    const run = screen.getByRole('button', { name: 'Run activity check' });
    expect(run).toBeEnabled();
    fireEvent.click(run);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('opens the Add prospect form', () => {
    const onAdd = vi.fn();
    render(<ProspectsToolbar board={false} unchecked={0} onLayout={vi.fn()} onImport={vi.fn()} onAdd={onAdd} onCheck={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add prospect' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('disables Run activity check when nobody is unchecked', () => {
    render(<ProspectsToolbar board={false} unchecked={0} onLayout={vi.fn()} onImport={vi.fn()} onAdd={vi.fn()} onCheck={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Run activity check' })).toBeDisabled();
  });
});

describe('ProspectsStats', () => {
  it('shows each status count and the month\'s Instagram spend, with no needs-review chip', () => {
    render(<ProspectsStats counts={counts} spentCentsThisMonth={250} budgetCents={1000} verdict={ALL} onVerdict={vi.fn()} />);
    expect(screen.getByRole('button', { name: /4\s+Not checked yet/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\s+Not active/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Needs/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Instagram lookups this month/)).toBeInTheDocument();
  });

  it('narrows the table to a verdict when a count is clicked', () => {
    const onVerdict = vi.fn();
    render(<ProspectsStats counts={counts} spentCentsThisMonth={0} budgetCents={1000} verdict={ALL} onVerdict={onVerdict} />);
    fireEvent.click(screen.getByRole('button', { name: /1\s+Not active/ }));
    expect(onVerdict).toHaveBeenCalledWith('inactive');
  });

  it('clears the filter when the active count is clicked again', () => {
    const onVerdict = vi.fn();
    render(<ProspectsStats counts={counts} spentCentsThisMonth={0} budgetCents={1000} verdict="active" onVerdict={onVerdict} />);
    const active = screen.getByRole('button', { name: /2\s+Active/ });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(active);
    expect(onVerdict).toHaveBeenCalledWith(ALL);
  });
});

describe('ReviewCallout', () => {
  it('uses singular and plural copy correctly', () => {
    const { rerender } = render(<ReviewCallout count={1} onReview={vi.fn()} />);
    expect(screen.getByText('1 prospect needs review')).toBeInTheDocument();
    rerender(<ReviewCallout count={3} onReview={vi.fn()} />);
    expect(screen.getByText('3 prospects need review')).toBeInTheDocument();
  });

  it('opens the review queue from Review now', () => {
    const onReview = vi.fn();
    render(<ReviewCallout count={3} onReview={onReview} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review now' }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});

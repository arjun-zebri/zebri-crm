/**
 * The dashboard's Outstanding To-Dos card.
 *
 * Regression cover for the tasks-to-steps swap: the card's date helpers
 * take a date-only string, and `workflow_steps.due_at` is a timestamptz.
 * Handing one over raw rendered "Invalid Date" on every row.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardSteps } from '@/app/(dashboard)/dashboard-steps';

const couple = { id: 'c1', name: 'Sam & Priya' };

/** Midday local on the given offset from today, as a timestamptz string. */
function dueIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe('DashboardSteps', () => {
  it('renders a timestamptz due date as a day, never "Invalid Date"', () => {
    render(
      <DashboardSteps
        steps={[{ id: 's1', title: 'Call the venue', due_at: dueIn(0), couple }]}
        isLoading={false}
        onCoupleClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('marks a past step overdue rather than silently failing the comparison', () => {
    render(
      <DashboardSteps
        steps={[{ id: 's1', title: 'Chase the deposit', due_at: dueIn(-3), couple }]}
        isLoading={false}
        onCoupleClick={vi.fn()}
      />,
    );

    const label = screen.getByText('3 days ago');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-danger');
  });

  it('renders no date at all when a step has none', () => {
    render(
      <DashboardSteps
        steps={[{ id: 's1', title: 'Write the run sheet', due_at: null, couple }]}
        isLoading={false}
        onCoupleClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Write the run sheet')).toBeInTheDocument();
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });
});

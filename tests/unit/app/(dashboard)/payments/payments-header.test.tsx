/**
 * Unit tests for `PaymentsHeader`.
 *
 * Covers tab switching, search clearing, and that all tabs
 * (Invoices / Contracts) are always rendered — the Starter-plan cap
 * is enforced at contract create time, not by hiding the tab
 * (2026-06-03 policy change).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PaymentsHeader } from '@/app/(dashboard)/payments/payments-header';

function Harness(overrides: Partial<React.ComponentProps<typeof PaymentsHeader>> = {}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <PaymentsHeader
      activeTab="invoices"
      onTabChange={vi.fn()}
      count={3}
      search=""
      onSearchChange={vi.fn()}
      searchInputRef={ref}
      onNew={vi.fn()}
      {...overrides}
    />
  );
}

describe('PaymentsHeader', () => {
  it('renders the count next to the title', () => {
    render(<Harness count={7} />);
    expect(screen.getByText('7 total')).toBeInTheDocument();
  });

  it('always renders all tabs (no plan gate)', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Contracts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invoices/i })).toBeInTheDocument();
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const onTabChange = vi.fn();
    render(<Harness onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Contracts/i }));
    expect(onTabChange).toHaveBeenCalledWith('contracts');
  });

  it('calls onSearchChange on typing', async () => {
    const onSearchChange = vi.fn();
    render(<Harness onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('Search invoices...');
    await userEvent.type(input, 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('renders one New button per breakpoint slot by default', () => {
    render(<Harness />);
    // Mobile is the round icon-only `+`, desktop the labelled button.
    // Both sit in the DOM at all times, hidden by responsive classes, so
    // they share an accessible name and are told apart by their slot.
    const newButtons = screen.getAllByRole('button', { name: /New invoice/ });
    expect(newButtons).toHaveLength(2);
    expect(newButtons.some((b) => b.className.includes('sm:hidden'))).toBe(true);
    expect(newButtons.some((b) => b.className.includes('sm:inline-flex'))).toBe(true);
  });

  it('wires both New button slots to onNew on the Contracts tab', async () => {
    // Regression: Contracts used to swap in a popover-anchored button
    // here, which mounted twice (once per slot) and left the New button
    // doing nothing at all. Every tab now calls plain `onNew`.
    const onNew = vi.fn();
    render(<Harness activeTab="contracts" onNew={onNew} />);
    const newButtons = screen.getAllByRole('button', { name: /New contract/ });
    expect(newButtons).toHaveLength(2);
    for (const button of newButtons) await userEvent.click(button);
    expect(onNew).toHaveBeenCalledTimes(2);
  });

  it('shows the X-clear button when search has a value', () => {
    render(<Harness search="ceremony" />);
    // The clear X is the only icon button next to the search input.
    const buttons = screen.getAllByRole('button');
    // At least one button must be the clear (svg-only, no accessible name).
    const clear = buttons.find((b) => b.querySelector('svg.lucide-x'));
    expect(clear).toBeDefined();
  });
});

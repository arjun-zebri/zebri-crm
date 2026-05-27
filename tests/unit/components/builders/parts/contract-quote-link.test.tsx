/**
 * Unit tests for ContractQuoteLink — the Popover quote picker on
 * the contract builder. Covers placeholder vs selected display,
 * disabled state, and onSelect callback for both "pick a quote"
 * and "unlink" paths.
 *
 * Radix Popover content only mounts after the trigger is clicked,
 * so each list/search test opens the popover first.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ContractQuoteLink,
  type ContractQuoteLinkOption,
} from '@/components/builders/parts/contract-quote-link';

const options: ContractQuoteLinkOption[] = [
  { id: 'q1', quote_number: 'QT-001', title: 'Wedding day', status: 'accepted', subtotal: 4500 },
  { id: 'q2', quote_number: 'QT-002', title: 'Extras', status: 'sent', subtotal: 1200 },
];

describe('ContractQuoteLink', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(
      <ContractQuoteLink
        selectedQuoteId={null}
        options={options}
        canEdit
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/Link to quote/i)).toBeInTheDocument();
  });

  it('shows the linked quote number + title when selected', () => {
    render(
      <ContractQuoteLink
        selectedQuoteId="q1"
        options={options}
        canEdit
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/QT-001/)).toBeInTheDocument();
    expect(screen.getByText(/Wedding day/)).toBeInTheDocument();
  });

  it('disables the trigger when canEdit is false', () => {
    render(
      <ContractQuoteLink
        selectedQuoteId={null}
        options={options}
        canEdit={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onSelect(id) when a quote is picked from the list', async () => {
    const onSelect = vi.fn();
    render(
      <ContractQuoteLink
        selectedQuoteId={null}
        options={options}
        canEdit
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Link to quote/i }));
    await userEvent.click(screen.getByRole('button', { name: /QT-002/ }));
    expect(onSelect).toHaveBeenCalledWith('q2');
  });

  it('calls onSelect(null) when "None" is clicked to unlink', async () => {
    const onSelect = vi.fn();
    render(
      <ContractQuoteLink
        selectedQuoteId="q1"
        options={options}
        canEdit
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /QT-001/ }));
    await userEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { headlineTotal, ProposalsList, type ProposalListRow } from '@/app/(dashboard)/proposals/proposals-list';

const row = (over: Partial<ProposalListRow> = {}): ProposalListRow => ({
  id: 'p1',
  proposal_number: 'PR-001',
  title: 'Anna & Jake',
  status: 'sent',
  expires_at: '2027-01-01',
  email_sent_at: '2026-09-01T00:00:00Z',
  last_viewed_at: null,
  view_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [
    { subtotal: 900, is_popular: false, position: 1 },
    { subtotal: 1500, is_popular: true, position: 2 },
  ],
  ...over,
});

describe('proposals list', () => {
  it('headlineTotal prefers the popular option, then the first', () => {
    expect(headlineTotal(row())).toBe(1500);
    expect(headlineTotal(row({ proposal_options: [{ subtotal: 900, is_popular: false, position: 1 }] }))).toBe(900);
    expect(headlineTotal(row({ proposal_options: [] }))).toBe(0);
  });

  it('renders number, couple, status pill and total', () => {
    render(<ProposalsList loading={false} proposals={[row()]} searching={false} onOpen={vi.fn()} onNew={vi.fn()} />);
    // PaymentsTable renders both the desktop table and the mobile card list
    // at once (CSS toggles which is visible), so the number appears twice.
    expect(screen.getAllByText('PR-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anna & Jake').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$1,500').length).toBeGreaterThan(0);
  });

  it('shows the empty state with a New proposal button', () => {
    const onNew = vi.fn();
    render(<ProposalsList loading={false} proposals={[]} searching={false} onOpen={vi.fn()} onNew={onNew} />);
    expect(screen.getByText(/No proposals yet/)).toBeInTheDocument();
    screen.getByRole('button', { name: 'New proposal' }).click();
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('does not show the New proposal button when searching turned up nothing', () => {
    render(<ProposalsList loading={false} proposals={[]} searching onOpen={vi.fn()} onNew={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'New proposal' })).not.toBeInTheDocument();
  });

  it('shows a view count next to the status pill once the proposal has been viewed', () => {
    render(
      <ProposalsList loading={false} proposals={[row({ view_count: 3 })]} searching={false} onOpen={vi.fn()} onNew={vi.fn()} />,
    );
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('renders no view count when the proposal has never been viewed', () => {
    render(
      <ProposalsList loading={false} proposals={[row({ view_count: 0 })]} searching={false} onOpen={vi.fn()} onNew={vi.fn()} />,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

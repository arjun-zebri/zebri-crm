/**
 * The drafts strip under the `/proposals` stats. A draft that survives
 * the create-on-first-change rule is one the MC deliberately started, and
 * until this existed the page counted it and offered no way to reach it
 * (founder, 2026-09-23: "you cant see it in the templates - this should
 * not be the case").
 *
 * What has to hold: silence on an account with nothing in progress, the
 * freshest drafts named and openable, and a delete that asks first.
 *
 * @module tests/unit/app/proposals/proposal-drafts-strip
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposalDraftsStrip } from '@/app/(dashboard)/proposals/proposal-drafts-strip';
import type { ProposalListRow } from '@/app/(dashboard)/proposals/use-proposals';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const toast = vi.fn();
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast }) }));

const deleteProposalAction = vi.fn();
vi.mock('@/app/(dashboard)/proposals/actions', () => ({
  deleteProposalAction: (id: string) => deleteProposalAction(id),
}));

const row = (over: Partial<ProposalListRow> = {}): ProposalListRow => ({
  id: 'p1',
  proposal_number: 'PR-001',
  title: 'Anna & Jake, your wedding',
  status: 'draft',
  expires_at: null,
  email_sent_at: null,
  last_viewed_at: null,
  view_count: 0,
  created_at: '2026-09-20T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
  couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [],
  ...over,
});

const onRetry = vi.fn();
const onDeleted = vi.fn();

function renderStrip(rows: ProposalListRow[], over: { loading?: boolean; error?: Error | null } = {}) {
  return render(
    <ProposalDraftsStrip
      rows={rows}
      loading={over.loading ?? false}
      error={over.error ?? null}
      onRetry={onRetry}
      onDeleted={onDeleted}
    />,
  );
}

beforeEach(() => {
  push.mockReset();
  toast.mockReset();
  onDeleted.mockReset();
  deleteProposalAction.mockReset();
  deleteProposalAction.mockResolvedValue({ ok: true, data: undefined });
});

describe('ProposalDraftsStrip', () => {
  it('shows nothing at all on an account with no drafts', () => {
    const { container } = renderStrip([row({ status: 'sent' }), row({ id: 'p2', status: 'accepted' })]);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays out of the way while the list is still loading', () => {
    const { container } = renderStrip([row()], { loading: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('names the drafts freshest first and opens one in the design editor', async () => {
    const user = userEvent.setup();
    renderStrip([
      row({ id: 'old', couple: { id: 'c1', name: 'Older couple' }, updated_at: '2026-09-01T00:00:00Z' }),
      row({ id: 'new', couple: { id: 'c2', name: 'Newer couple' }, updated_at: '2026-09-22T00:00:00Z' }),
    ]);

    expect(screen.getByText('2 drafts in progress')).toBeInTheDocument();
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Newer couple');
    expect(names[1]).toContain('Older couple');

    await user.click(screen.getAllByRole('button', { name: 'Open' })[0]!);
    expect(push).toHaveBeenCalledWith('/proposals/new/design');
  });

  it('counts the rest rather than listing every draft', () => {
    renderStrip(['a', 'b', 'c', 'd', 'e'].map((id) => row({ id, couple: { id, name: `Couple ${id}` } })));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/2 more drafts/)).toBeInTheDocument();
  });

  it('asks before deleting, then deletes and refreshes the list', async () => {
    const user = userEvent.setup();
    renderStrip([row()]);

    await user.click(screen.getByRole('button', { name: 'Delete draft for Anna & Jake' }));
    expect(screen.getByText('Delete this draft?')).toBeInTheDocument();
    // The reassurance the whole feature turns on.
    expect(screen.getByText(/template it came from is not affected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(deleteProposalAction).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith('Draft deleted', 'success');
  });

  it('reports a failed delete and keeps the draft on screen', async () => {
    const user = userEvent.setup();
    deleteProposalAction.mockResolvedValue({ ok: false, error: 'Could not delete the proposal.' });
    renderStrip([row()]);

    await user.click(screen.getByRole('button', { name: 'Delete draft for Anna & Jake' }));
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Could not delete the proposal.', 'error'));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText('Anna & Jake')).toBeInTheDocument();
  });

  it('offers a way back when the list itself failed to load', () => {
    renderStrip([], { error: new Error('offline') });
    expect(screen.getByText('Could not load your drafts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

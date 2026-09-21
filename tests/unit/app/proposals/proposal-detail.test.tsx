import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProposalDetail } from '@/app/(dashboard)/proposals/[id]/proposal-detail';
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';

vi.mock('@/app/(dashboard)/proposals/actions', () => ({
  revertProposalToDraftAction: vi.fn(),
  deleteProposalAction: vi.fn(),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// `ProposalDetail` now mounts `ProposalPdfButton`, which creates a Supabase
// client on mount (via `useProposalForPrint`) even though these tests never
// trigger a download. A bare mock avoids the real client's env-var check;
// its own query is `enabled: false`, so nothing here ever calls into it.
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

// `useCurrentBranding` fetches eagerly on mount (no `enabled` gate), which
// would otherwise fire a real Supabase call through the bare client mock
// above and reject. These tests never exercise the PDF path, so a static
// "not loaded yet" result is all `ProposalPdfButton` needs to render.
vi.mock('@/lib/branding/use-current-branding', () => ({
  useCurrentBranding: () => ({ branding: null, blocks: [], loading: false }),
}));

// `ProposalDetail` now mounts `ProposalEngagement`, which fetches raw
// engagement rows via `useProposalEvents`. These tests never exercise
// engagement, so a static empty result keeps them isolated from that
// query the same way the mocks above isolate the PDF path.
vi.mock('@/app/(dashboard)/proposals/use-proposal-events', () => ({
  useProposalEvents: () => ({ data: [], isLoading: false, error: null }),
}));

const proposal: ProposalDetailRow = {
  id: 'p1', proposal_number: 'PR-001', title: 'Anna & Jake', status: 'viewed', version: 2,
  expires_at: '2027-01-31', email_sent_at: '2026-09-01T00:00:00Z', first_viewed_at: '2026-09-02T00:00:00Z',
  last_viewed_at: '2026-09-03T00:00:00Z', view_count: 4, created_at: '2026-09-01T00:00:00Z',
  share_token: 'tok', share_token_enabled: true, declined_reason: null, declined_message: null,
  contract_id: null, invoice_id: null, couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [{ id: 'opt1', subtotal: 1500, is_popular: true, position: 1, title: 'Full day' }],
};

// `ProposalDetail` reverts through a `useMutation`, which needs a query
// client in the tree even though these tests never trigger it.
function renderDetail(over: Partial<ProposalDetailRow> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProposalDetail proposal={{ ...proposal, ...over }} onEdit={vi.fn()} onChanged={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ProposalDetail', () => {
  it('shows number, status, version, views, and the share link', () => {
    renderDetail();
    expect(screen.getByText('PR-001')).toBeInTheDocument();
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(screen.getByText(/4 views/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });

  it('shows the decline note when declined', () => {
    renderDetail({ status: 'declined', declined_reason: 'price', declined_message: 'Over budget' });
    expect(screen.getByText('Over budget')).toBeInTheDocument();
  });
});

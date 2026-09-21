/**
 * Unit tests for ProposalPreviewPane: branding label, Update branding link,
 * and the loading skeleton while branding is still fetching.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ProposalPreviewPane } from '@/components/builders/parts/proposal-preview-pane';
import { emptyForm } from '@/lib/proposals/form-factories';

// Stub the supabase client (the actual hook hits the network; for unit
// tests we mock the layer), mirroring builder-preview-pane.test.tsx.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { user_metadata: { business_name: 'Acme Weddings' } } },
      }),
    },
    from: () => ({
      select: () => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  }),
}));

// The real ProposalPage renders the full block tree; stub it so this test
// only checks the pane's own chrome (header, branding line, loading gate).
vi.mock('@/app/proposal/[token]/_components/proposal-page', () => ({
  ProposalPage: () => <div data-testid="proposal-page" />,
}));

function render(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProposalPreviewPane', () => {
  it('renders the loading skeleton before branding resolves', () => {
    render(<ProposalPreviewPane form={emptyForm(null)} coupleName={null} />);
    expect(screen.queryByTestId('proposal-page')).toBeNull();
  });

  it('renders the preview once branding resolves', async () => {
    render(<ProposalPreviewPane form={emptyForm(null)} coupleName="Anna & Jake" />);
    expect(await screen.findByTestId('proposal-page')).toBeInTheDocument();
  });

  it('falls back to the business name when no brand-kit is named', async () => {
    render(<ProposalPreviewPane form={emptyForm(null)} coupleName={null} />);
    expect(await screen.findByText('Acme Weddings')).toBeInTheDocument();
  });

  it('renders the "Update branding" link pointing at /branding', async () => {
    render(<ProposalPreviewPane form={emptyForm(null)} coupleName={null} />);
    const link = await screen.findByRole('link', { name: /Update branding/i });
    expect(link).toHaveAttribute('href', '/branding');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

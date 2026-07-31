/**
 * Unit tests for BuilderPreviewPane — tab switching, branding label,
 * Update branding link.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BuilderPreviewPane } from '@/components/builders/parts/builder-preview-pane';
import type { PreviewDoc } from '@/components/builders/parts/preview-shared';

// Stub the supabase client (the actual hook hits the network; for
// unit tests we mock the layer).
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

// Stub the heavy preview components — we only test the orchestrator.
vi.mock('@/components/builders/parts/preview-pdf', () => ({
  PreviewPdf: () => <div data-testid="preview-pdf" />,
}));
vi.mock('@/components/builders/parts/preview-email', () => ({
  PreviewEmail: () => <div data-testid="preview-email" />,
}));
vi.mock('@/components/builders/parts/preview-payment-page', () => ({
  PreviewPaymentPage: () => <div data-testid="preview-payment-page" />,
}));

// The pane reads its brand label through `useCurrentBranding`, which is a
// React Query hook, so every render needs a client. A fresh one per test
// keeps the cache from leaking between cases.
function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function baseDoc(): PreviewDoc {
  return {
    kind: 'invoice',
    documentNumber: 'INV-001',
    title: 'Wedding Invoice',
    status: 'draft',
    coupleName: 'Anna & Jake',
    businessName: null,
    items: [],
    taxRate: 10,
    discount: null,
    notes: null,
    dueDate: null,
    shareUrl: 'https://example.com/invoice/abc',
  };
}

describe('BuilderPreviewPane', () => {
  it('defaults to the Payment page tab', () => {
    render(<BuilderPreviewPane doc={baseDoc()} surface="invoice" />);
    expect(screen.getByTestId('preview-payment-page')).toBeInTheDocument();
  });

  it('switches to PDF tab when clicked', async () => {
    render(<BuilderPreviewPane doc={baseDoc()} surface="invoice" />);
    await userEvent.click(screen.getByRole('button', { name: /PDF/i }));
    expect(screen.getByTestId('preview-pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-payment-page')).toBeNull();
  });

  it('switches to Email tab when clicked', async () => {
    render(<BuilderPreviewPane doc={baseDoc()} surface="invoice" />);
    await userEvent.click(screen.getByRole('button', { name: /Email/i }));
    expect(screen.getByTestId('preview-email')).toBeInTheDocument();
  });

  it('falls back to the business name when no brand-kit is named', async () => {
    render(<BuilderPreviewPane doc={baseDoc()} surface="invoice" />);
    await waitFor(() => expect(screen.getByText('Acme Weddings')).toBeInTheDocument());
  });

  it('renders the "Update branding" link pointing at /branding', () => {
    render(<BuilderPreviewPane doc={baseDoc()} surface="invoice" />);
    const link = screen.getByRole('link', { name: /Update branding/i });
    expect(link).toHaveAttribute('href', '/branding');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

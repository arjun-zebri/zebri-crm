/**
 * Unit tests for BuilderPreviewPane — tab switching, branding label,
 * Update branding link, collapse/expand.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BuilderPreviewPane } from '@/components/builders/parts/builder-preview-pane';
import type { PreviewDoc } from '@/components/builders/parts/preview-shared';

// Stub the supabase client + branding hook (the actual hook hits
// the network; for unit tests we mock the layer).
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

function baseDoc(): PreviewDoc {
  return {
    kind: 'quote',
    documentNumber: 'Q-001',
    title: 'Wedding Quote',
    status: 'draft',
    coupleName: 'Anna & Jake',
    businessName: null,
    items: [],
    taxRate: 10,
    discount: null,
    notes: null,
    expiresAt: null,
    shareUrl: 'https://example.com/quote/abc',
  };
}

describe('BuilderPreviewPane', () => {
  it('defaults to the Payment page tab', () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    expect(screen.getByTestId('preview-payment-page')).toBeInTheDocument();
  });

  it('switches to PDF tab when clicked', async () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /PDF/i }));
    expect(screen.getByTestId('preview-pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-payment-page')).toBeNull();
  });

  it('switches to Email tab when clicked', async () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Email/i }));
    expect(screen.getByTestId('preview-email')).toBeInTheDocument();
  });

  it('shows the business name fetched from user_metadata', async () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Acme Weddings')).toBeInTheDocument());
  });

  it('renders the "Update branding" link pointing at /branding', () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: /Update branding/i });
    expect(link).toHaveAttribute('href', '/branding');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onToggleCollapsed when the collapse chevron is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed={false}
        onToggleCollapsed={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide preview' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('renders only the expand chevron when collapsed', () => {
    render(
      <BuilderPreviewPane
        doc={baseDoc()}
        surface="quote"
        collapsed
        onToggleCollapsed={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show preview' })).toBeInTheDocument();
    expect(screen.queryByText('Preview')).toBeNull();
  });
});

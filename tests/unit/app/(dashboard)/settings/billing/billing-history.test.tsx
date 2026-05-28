/**
 * Unit tests for `BillingHistory`.
 *
 * - Skeleton renders during the initial fetch.
 * - Populated state renders invoices + upcoming charge.
 * - Empty state renders nothing (returns `null`).
 * - Fetch error renders nothing (defensive — empty is preferable to
 *   a broken-looking placeholder).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingHistory } from '@/app/(dashboard)/settings/billing/billing-history';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function mockResponse(body: unknown) {
  fetchMock.mockResolvedValueOnce({
    json: async () => body,
  });
}

describe('BillingHistory', () => {
  it('renders skeleton rows on initial load', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<BillingHistory />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders invoices once the fetch resolves', async () => {
    mockResponse({
      invoices: [
        {
          id: 'in_1',
          number: 'INV-001',
          status: 'paid',
          amount: 4900,
          created: 1735689600,
          hostedUrl: 'https://stripe/invoice/in_1',
          pdfUrl: 'https://stripe/invoice/in_1.pdf',
        },
      ],
      upcoming: { amount: 4900, nextChargeAt: 1738368000 },
    });

    render(<BillingHistory />);

    await waitFor(() => expect(screen.getAllByText('$49.00').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View/i })).toHaveAttribute(
      'href',
      'https://stripe/invoice/in_1',
    );
    expect(screen.getByRole('link', { name: /PDF/i })).toHaveAttribute(
      'href',
      'https://stripe/invoice/in_1.pdf',
    );
    expect(screen.getByText(/Next charge/i)).toBeInTheDocument();
  });

  it('renders nothing when there are no invoices + no upcoming charge', async () => {
    mockResponse({ invoices: [], upcoming: null });
    const { container } = render(<BillingHistory />);
    // Wait one tick for the fetch to resolve and the component to
    // settle on its empty state.
    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeNull());
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the API returns an error envelope', async () => {
    mockResponse({ error: 'boom' });
    const { container } = render(<BillingHistory />);
    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeNull());
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when fetch rejects outright', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const { container } = render(<BillingHistory />);
    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeNull());
    expect(container.firstChild).toBeNull();
  });
});

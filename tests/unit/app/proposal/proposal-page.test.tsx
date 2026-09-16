/**
 * Unit tests for `ProposalPage`: the popular option starts selected,
 * package selection and add-ons drive the displayed total, the accept
 * button opens the accept stepper, a successful decline calls
 * `router.refresh()`, the print frame never shows a dialog or plays video,
 * and `embedded` never touches the host document's favicon.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults';
import { ProposalPage, ProposalPageClient } from '@/app/proposal/[token]/_components/proposal-page';
import { priced } from '@/lib/branding/public-blocks/proposal/package-card';
import { fmt } from '@/lib/branding/public-blocks/shared';
import { buildPublicBranding } from '@/lib/branding/public-branding';
import { optionTotal } from '@/lib/proposals/pricing';
import { sampleProposal } from '@/lib/proposals/sample-proposal';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const branding = buildPublicBranding({});
const proposal = sampleProposal(branding);
const blocks = defaultBlocksFor('proposal');

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** opt-1 "Reception MC" (not popular), opt-2 "Full day" (popular). */
function totalFor(optionId: string, addonIds: readonly string[]): string {
  const option = proposal.options.find((o) => o.id === optionId)!;
  return fmt(optionTotal(priced(option), addonIds));
}

describe('ProposalPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    refresh.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with the popular option selected', () => {
    render(<ProposalPage proposal={proposal} blocks={blocks} frame="page" token="tok-1" />);
    const articles = screen.getAllByRole('article');
    expect(articles[0]).toHaveAttribute('aria-pressed', 'false');
    expect(articles[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking the first option CTA moves aria-pressed to it', () => {
    render(<ProposalPage proposal={proposal} blocks={blocks} frame="page" token="tok-1" />);
    const articles = screen.getAllByRole('article');
    fireEvent.click(within(articles[0] as HTMLElement).getByRole('button', { name: 'Choose this package' }));
    expect(articles[0]).toHaveAttribute('aria-pressed', 'true');
    expect(articles[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('ticking an add-on raises the displayed total', () => {
    render(<ProposalPage proposal={proposal} blocks={blocks} frame="page" token="tok-1" />);
    const selected = screen.getAllByRole('article')[1] as HTMLElement; // Full day, default add-on i-7 ticked
    expect(within(selected).getByText(totalFor('opt-2', ['i-7']))).toBeInTheDocument();
    fireEvent.click(within(selected).getByRole('checkbox', { name: /Travel outside Melbourne/ }));
    expect(within(selected).getByText(totalFor('opt-2', ['i-7', 'i-8']))).toBeInTheDocument();
  });

  it('clicking the accept button opens the accept stepper, and Close hides it', () => {
    render(<ProposalPage proposal={proposal} blocks={blocks} frame="page" token="tok-1" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept and sign' }));
    expect(screen.getByRole('dialog', { name: 'Confirm your booking' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('declining successfully calls router.refresh() via ProposalPageClient', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }));
    render(<ProposalPageClient proposal={proposal} blocks={blocks} token="tok-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Not the right fit? Let us know' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Price' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('renders no dialog and no video in the print frame', () => {
    render(<ProposalPage proposal={proposal} blocks={blocks} frame="print" />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept and sign' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
  });

  // Seam bug caught in review: the in-modal preview pane mounts ProposalPage
  // with no token inside the dashboard's own document, so it must never
  // swap the app's tab favicon for the MC's branded one, unlike the real
  // public token page and the standalone /branding/preview route.
  it('embedded does not touch the document favicon', () => {
    const brandedProposal = sampleProposal(buildPublicBranding({ favicon_url: 'https://example.com/favicon.ico' }));
    const beforeHref = document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null;

    render(<ProposalPage proposal={brandedProposal} blocks={blocks} frame="page" embedded />);

    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null).toBe(beforeHref);
    expect(document.getElementById('zebri-public-branding-favicon')).toBeNull();
  });
});

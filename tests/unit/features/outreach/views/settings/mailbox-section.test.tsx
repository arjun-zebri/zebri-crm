// tests/unit/features/outreach/views/settings/mailbox-section.test.tsx
/**
 * Settings > Mailbox states. One card when Google OAuth is not configured
 * (no disabled button, no env var names), a Connect button when it is, and
 * the connected account otherwise.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/toast';
import { MailboxSection } from '@/features/outreach/views/settings/mailbox-section';
import type { MailboxInfo } from '@/lib/outreach/services/settings';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/features/outreach/actions', () => ({ disconnectMailboxAction: vi.fn() }));
vi.mock('@/features/outreach/hooks', () => ({
  useOutreachMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const connected: MailboxInfo = {
  email: 'founder@example.com',
  connectedAt: '2026-10-01T00:00:00Z',
  lastPolledAt: null,
  lastError: null,
} as unknown as MailboxInfo;

function renderMailbox(props: Parameters<typeof MailboxSection>[0]) {
  return render(
    <ToastProvider>
      <MailboxSection {...props} />
    </ToastProvider>,
  );
}

describe('Settings mailbox states', () => {
  it('shows one setup card when OAuth is not configured, with no disabled Connect button', () => {
    const { container } = renderMailbox({ mailbox: null, oauthConfigured: false });
    expect(screen.getByText("Gmail isn't set up on the server yet")).toBeInTheDocument();
    expect(screen.getByText(/Add the Google OAuth client in Vercel/)).toBeInTheDocument();
    expect(screen.getByText(/docs\/outreach-guide\.md/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Gmail' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/OUTREACH_|APIFY_|GOOGLE_CLIENT/);
  });

  it('offers an enabled Connect Gmail button when configured and not connected', () => {
    renderMailbox({ mailbox: null, oauthConfigured: true });
    expect(screen.getByText('No Gmail account connected. Sending and replies need one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeEnabled();
    expect(screen.queryByText("Gmail isn't set up on the server yet")).not.toBeInTheDocument();
  });

  it('shows the connected account, last check and a Disconnect action', () => {
    renderMailbox({ mailbox: connected, oauthConfigured: true });
    expect(screen.getByText('founder@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Not checked yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Gmail' })).not.toBeInTheDocument();
  });

  it('keeps Disconnect available when connected but the OAuth client is no longer configured', () => {
    renderMailbox({ mailbox: connected, oauthConfigured: false });
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.queryByText("Gmail isn't set up on the server yet")).not.toBeInTheDocument();
  });

  it('uses the quiet section heading with a muted description', () => {
    renderMailbox({ mailbox: null, oauthConfigured: true });
    expect(screen.getByRole('heading', { name: 'Mailbox' })).toHaveClass('text-body', 'font-semibold');
  });
});

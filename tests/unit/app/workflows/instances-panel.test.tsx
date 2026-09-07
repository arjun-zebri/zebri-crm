/**
 * Unit tests for RunHistoryPanel - the "Applied to" drawer that answers
 * whether a workflow is running anywhere and where it broke.
 *
 * The supabase client is stubbed so the component's react-query fetch
 * resolves to canned instances; we assert the closed / empty / running /
 * failed renders. The failure case matters most: an instance stays
 * `active` with a broken step inside it, so the drawer has to read the
 * failure off the steps rather than off the instance status.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunHistoryPanel } from '@/app/(dashboard)/workflows/[id]/instances-panel';

// Mutable per-test fixture the stubbed query resolves to.
let instancesFixture: unknown[] = [];

vi.mock('@/lib/supabase/client', () => {
  const result = () => Promise.resolve({ data: instancesFixture, error: null });
  const chain = () => ({
    eq: () => chain(),
    order: () => ({ limit: result }),
  });
  return { createClient: () => ({ from: () => ({ select: () => chain() }) }) };
});

function renderPanel(open = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RunHistoryPanel templateId="tpl-1" open={open} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('RunHistoryPanel', () => {
  beforeEach(() => {
    instancesFixture = [];
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderPanel(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when the workflow has not been applied', async () => {
    instancesFixture = [];
    renderPanel();
    expect(await screen.findByText(/Not applied yet/i)).toBeInTheDocument();
  });

  it('surfaces a failed step with its message and couple', async () => {
    instancesFixture = [
      {
        id: 'i1',
        status: 'active',
        applied_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        couples: { name: 'Anna & Jake' },
        workflow_steps: [
          {
            title: 'Email the couple',
            status: 'errored',
            error_message: 'Resend rejected: no recipient email',
          },
        ],
      },
    ];
    renderPanel();

    expect(await screen.findByText(/Failed at: Email the couple/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Resend rejected: no recipient email/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Anna & Jake')).toBeInTheDocument();
    // The instance is still `active`, but a broken step is what the MC
    // needs to see, so the pill reads Failed rather than Running.
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('does not render an error box for a finished instance', async () => {
    instancesFixture = [
      {
        id: 'i2',
        status: 'completed',
        applied_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null,
        couples: null,
        workflow_steps: [],
      },
    ];
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText(/No couple linked/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Failed at/i)).toBeNull();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('labels a still-running instance', async () => {
    instancesFixture = [
      {
        id: 'i3',
        status: 'active',
        applied_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        couples: { name: 'Mia & Sam' },
        workflow_steps: [],
      },
    ];
    renderPanel();
    expect(await screen.findByText('Running')).toBeInTheDocument();
  });
});

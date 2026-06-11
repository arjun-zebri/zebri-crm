/**
 * Unit tests for RunHistoryPanel — the run-history drawer that surfaces
 * whether an automation ran and, crucially, where it errored.
 *
 * The supabase client is stubbed so the component's react-query fetch
 * resolves to canned runs; we assert the loading / empty / populated /
 * errored renders and that an errored run names the failed step.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunHistoryPanel } from '@/app/(dashboard)/automations/[id]/runs-panel';
import type { AutomationActionRow } from '@/types/automations';

// Mutable per-test fixture the stubbed query resolves to.
let runsFixture: unknown[] = [];

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: runsFixture, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

const actions = [
  { id: 'a1', type: 'send_email', label: 'Email the couple' },
] as unknown as AutomationActionRow[];

function renderPanel(open = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RunHistoryPanel
        automationId="auto-1"
        actions={actions}
        open={open}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('RunHistoryPanel', () => {
  beforeEach(() => {
    runsFixture = [];
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderPanel(false);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when there are no runs', async () => {
    runsFixture = [];
    renderPanel();
    expect(await screen.findByText(/No runs yet/i)).toBeInTheDocument();
  });

  it('surfaces an errored run with the failed step and message', async () => {
    runsFixture = [
      {
        id: 'r1',
        status: 'errored',
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: 'Resend rejected: no recipient email',
        current_action_id: 'a1',
        couples: { name: 'Anna & Jake' },
      },
    ];
    renderPanel();

    expect(await screen.findByText(/Failed at: Email the couple/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Resend rejected: no recipient email/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Anna & Jake')).toBeInTheDocument();
  });

  it('does not render an error box for a completed run', async () => {
    runsFixture = [
      {
        id: 'r2',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: null,
        current_action_id: null,
        couples: null,
      },
    ];
    renderPanel();

    await waitFor(() =>
      expect(screen.getByText(/No couple linked/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Failed at/i)).toBeNull();
  });
});

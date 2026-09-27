/**
 * The account-wide stop on the Workflows page header (Phase 3, Task 18).
 *
 * Reachable from the header while running, a persistent banner with a
 * one-click resume while stopped, and both directions confirm with copy
 * that cannot be mistaken for turning one workflow off.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowsHeader } from '@/app/(dashboard)/workflows/workflows-header';
import { ToastProvider } from '@/components/ui/toast';

const getMock = vi.fn();
const pauseMock = vi.fn();
const resumeMock = vi.fn();

vi.mock('@/app/(dashboard)/workflows/account-pause-actions', () => ({
  getAccountPauseAction: (...a: unknown[]) => getMock(...a),
  pauseAccountWorkflowsAction: (...a: unknown[]) => pauseMock(...a),
  resumeAccountWorkflowsAction: (...a: unknown[]) => resumeMock(...a),
}));

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WorkflowsHeader />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

let paused = false;
beforeEach(() => {
  paused = false;
  getMock.mockReset();
  getMock.mockImplementation(async () => ({
    ok: true,
    data: { paused, pausedAt: paused ? '2026-09-24T01:00:00.000Z' : null },
  }));
  pauseMock.mockReset();
  pauseMock.mockImplementation(async () => {
    paused = true;
    return { ok: true, data: null };
  });
  resumeMock.mockReset();
  resumeMock.mockImplementation(async () => {
    paused = false;
    return { ok: true, data: null };
  });
});

describe('the Workflows header while running', () => {
  it('offers the stop, which confirms in account-wide words before it pauses', async () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Pause all workflows' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Pause all workflows?');
    expect(dialog).toHaveAccessibleDescription(
      /Pause all automated workflow emails and actions for your account/,
    );
    expect(dialog).toHaveAccessibleDescription(/Invoices and contracts you send yourself still go/);
    expect(pauseMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pause all' }));
    await waitFor(() => expect(pauseMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/All workflows are paused/)).toBeInTheDocument();
  });

  it('shows no banner', async () => {
    renderHeader();
    await screen.findByRole('button', { name: 'Pause all workflows' });
    expect(screen.queryByText(/All workflows are paused/)).not.toBeInTheDocument();
  });
});

describe('the Workflows header while stopped', () => {
  beforeEach(() => {
    paused = true;
  });

  it('keeps a banner up with a one-click resume that warns the backlog is skipped', async () => {
    renderHeader();
    expect(await screen.findByText(/All workflows are paused/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause all workflows' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resume all' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Resume all workflows?');
    expect(dialog).toHaveAccessibleDescription(/came due while paused will be skipped, not sent/);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(resumeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText(/All workflows are paused/)).not.toBeInTheDocument());
  });

  it('does nothing when the MC cancels', async () => {
    renderHeader();
    await userEvent.click(await screen.findByRole('button', { name: 'Resume all' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(resumeMock).not.toHaveBeenCalled();
    expect(screen.getByText(/All workflows are paused/)).toBeInTheDocument();
  });
});

describe('the Workflows header when the stop cannot be read (fix round 1)', () => {
  it('says so instead of offering Pause all as if the account were running', async () => {
    getMock.mockResolvedValue({ ok: false, error: 'db down' });
    renderHeader();
    expect(await screen.findByText(/Could not check whether workflows are paused/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause all workflows' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

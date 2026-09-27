/**
 * Settings: the account-wide workflow stop (Phase 3, Task 18).
 *
 * A switch that shows the real state, and never flips it on a bare
 * click: both directions confirm first.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowPauseCard } from '@/app/(dashboard)/settings/workflow-pause-card';
import { ToastProvider } from '@/components/ui/toast';

const getMock = vi.fn();
const pauseMock = vi.fn();
const resumeMock = vi.fn();

vi.mock('@/app/(dashboard)/workflows/account-pause-actions', () => ({
  getAccountPauseAction: (...a: unknown[]) => getMock(...a),
  pauseAccountWorkflowsAction: (...a: unknown[]) => pauseMock(...a),
  resumeAccountWorkflowsAction: (...a: unknown[]) => resumeMock(...a),
}));

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WorkflowPauseCard />
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

describe('WorkflowPauseCard', () => {
  it('pauses only after the MC confirms', async () => {
    renderCard();
    const toggle = await screen.findByRole('switch', {
      name: 'Pause all automated workflow emails and actions',
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Pause all workflows?');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Pause all' }));
    await waitFor(() => expect(pauseMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('says resuming skips the backlog, and resumes on confirm', async () => {
    paused = true;
    renderCard();
    const toggle = await screen.findByRole('switch', {
      name: 'Pause all automated workflow emails and actions',
    });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));

    await userEvent.click(toggle);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Resume all workflows?');
    expect(dialog).toHaveAccessibleDescription(/skipped, not sent/);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(resumeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  it('keeps the switch where it was when the server refuses', async () => {
    pauseMock.mockResolvedValueOnce({ ok: false, error: 'nope' });
    renderCard();
    const toggle = await screen.findByRole('switch', {
      name: 'Pause all automated workflow emails and actions',
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pause all' }));
    await waitFor(() => expect(pauseMock).toHaveBeenCalled());
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

describe('WorkflowPauseCard when the stop cannot be read (fix round 1)', () => {
  it('shows an error with a retry, not a switch reading "not paused"', async () => {
    getMock.mockResolvedValue({ ok: false, error: 'db down' });
    renderCard();
    expect(await screen.findByText(/Could not check whether workflows are paused/)).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Pause all automated workflow emails and actions' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says invoices and contracts the MC sends by hand still go', async () => {
    renderCard();
    expect(
      await screen.findByText(/Invoices and contracts you send yourself still go|Invoices and contracts you send yourself are not affected/),
    ).toBeInTheDocument();
  });
});

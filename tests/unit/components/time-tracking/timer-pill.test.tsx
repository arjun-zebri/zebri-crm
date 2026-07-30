import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimerProvider } from '@/components/time-tracking/timer-provider';

const getRunningMock = vi.fn();
const stopMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  getRunningTimerAction: () => getRunningMock(),
  startCoupleTimerAction: vi.fn(),
  stopCoupleTimerAction: () => stopMock(),
  updateCoupleTimeEntryAction: (input: unknown) => updateMock(input),
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
  setTimeCategoryColorAction: vi.fn(),
}));

const START = '2026-07-30T02:00:00.000Z';
const NOW = '2026-07-30T02:12:47.000Z';

function runningEntry() {
  return {
    id: 'entry-1',
    couple_id: 'couple-1',
    started_at: START,
    ended_at: null,
    category_id: null,
    category_name: null,
    note: null,
    auto_stopped: false,
  };
}

function runningPayload() {
  return {
    ok: true,
    data: {
      entry: runningEntry(),
      couple_name: 'Sarah & Tom',
      server_now: NOW,
    },
  };
}

function renderProvider(shadowing = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TimerProvider shadowing={shadowing}>
        <div>page</div>
      </TimerProvider>
    </QueryClientProvider>,
  );
}

describe('TimerPill via TimerProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no timer is running', async () => {
    getRunningMock.mockResolvedValue({ ok: true, data: null });
    renderProvider();
    expect(await screen.findByText('page')).toBeInTheDocument();
    expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument();
  });

  it('shows the couple name and elapsed time while running', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider();
    expect(await screen.findByTestId('timer-pill')).toBeInTheDocument();
    expect(screen.getByText('Sarah & Tom')).toBeInTheDocument();
    expect(screen.getByText('00:12:47')).toBeInTheDocument();
  });

  it('ticks forward every second', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider();
    await screen.findByText('00:12:47');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('00:12:49')).toBeInTheDocument();
  });

  it('stopping calls the stop action', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({ ok: true, data: null });
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /stop timing/i }),
    );
    await waitFor(() => expect(stopMock).toHaveBeenCalled());
  });

  it('opens the note dialog for the session it just stopped', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({
      ok: true,
      data: {
        entry: { ...runningEntry(), ended_at: NOW },
        couple_name: 'Sarah & Tom',
      },
    });
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /stop timing/i }),
    );
    expect(
      await screen.findByLabelText(/what did you work on/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/12m/)).toBeInTheDocument();
  });

  it('saving the note patches the stopped entry', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({
      ok: true,
      data: {
        entry: { ...runningEntry(), ended_at: NOW },
        couple_name: 'Sarah & Tom',
      },
    });
    updateMock.mockResolvedValue({
      ok: true,
      data: { ...runningEntry(), ended_at: NOW, note: 'Venue call' },
    });
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /stop timing/i }),
    );
    await userEvent.type(
      await screen.findByLabelText(/what did you work on/i),
      'Venue call',
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({
        id: 'entry-1',
        patch: { note: 'Venue call', category_id: null },
      }),
    );
  });

  it('skipping the note dialog leaves the entry untouched', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({
      ok: true,
      data: {
        entry: { ...runningEntry(), ended_at: NOW },
        couple_name: 'Sarah & Tom',
      },
    });
    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /stop timing/i }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /skip/i }),
    );
    expect(updateMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByLabelText(/what did you work on/i),
      ).not.toBeInTheDocument(),
    );
  });

  it('renders nothing in shadow mode even with a running timer', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    renderProvider(true);
    expect(await screen.findByText('page')).toBeInTheDocument();
    expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument();
    expect(getRunningMock).not.toHaveBeenCalled();
  });
});

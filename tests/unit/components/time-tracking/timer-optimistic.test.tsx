import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TimerProvider,
  useTimerSurface,
} from '@/components/time-tracking/timer-provider';

const getRunningMock = vi.fn();
const startMock = vi.fn();
const stopMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  getRunningTimerAction: () => getRunningMock(),
  startCoupleTimerAction: (coupleId: string) => startMock(coupleId),
  stopCoupleTimerAction: () => stopMock(),
  updateCoupleTimeEntryAction: vi.fn(),
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
    category_color: null,
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

/** A promise the test resolves by hand, standing in for a slow action. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Buttons that drive the surface the way a couple header would. */
function Harness() {
  const { start, stop } = useTimerSurface();
  return (
    <>
      <button onClick={() => start('couple-2', 'Alice & Ben')}>
        start couple 2
      </button>
      <button onClick={() => stop()}>stop everything</button>
    </>
  );
}

function renderProvider() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TimerProvider shadowing={false}>
        <Harness />
      </TimerProvider>
    </QueryClientProvider>,
  );
}

describe('TimerProvider optimistic writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the running pill before the start action resolves', async () => {
    getRunningMock.mockResolvedValue({ ok: true, data: null });
    const pendingStart = deferred<unknown>();
    startMock.mockReturnValue(pendingStart.promise);

    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /start couple 2/i }),
    );

    // The action has not resolved: anything on screen here is optimistic.
    expect(await screen.findByTestId('timer-pill')).toBeInTheDocument();
    expect(screen.getByText('Alice & Ben')).toBeInTheDocument();
    expect(screen.getByText('00:00:00')).toBeInTheDocument();

    pendingStart.resolve({
      ok: true,
      data: {
        started: { ...runningEntry(), id: 'entry-2', couple_id: 'couple-2' },
        stopped: null,
      },
    });
  });

  it('hides the running pill before the stop action resolves', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    const pendingStop = deferred<unknown>();
    stopMock.mockReturnValue(pendingStop.promise);

    renderProvider();
    await screen.findByTestId('timer-pill');
    await userEvent.click(
      screen.getByRole('button', { name: /stop everything/i }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument(),
    );
    expect(stopMock).toHaveBeenCalled();

    pendingStop.resolve({ ok: true, data: null });
  });

  it('rolls the pill back when the start action fails', async () => {
    getRunningMock.mockResolvedValue({ ok: true, data: null });
    startMock.mockResolvedValue({ ok: false, error: 'nope' });

    renderProvider();
    await userEvent.click(
      await screen.findByRole('button', { name: /start couple 2/i }),
    );

    await waitFor(() =>
      expect(screen.queryByTestId('timer-pill')).not.toBeInTheDocument(),
    );
  });

  it('restores the running pill when the stop action fails', async () => {
    getRunningMock.mockResolvedValue(runningPayload());
    stopMock.mockResolvedValue({ ok: false, error: 'nope' });

    renderProvider();
    await screen.findByTestId('timer-pill');
    await userEvent.click(
      screen.getByRole('button', { name: /stop everything/i }),
    );

    // Rollback restores the snapshot, and the follow-up read re-confirms
    // the session is still running server-side.
    expect(await screen.findByTestId('timer-pill')).toBeInTheDocument();
    expect(screen.getByText('Sarah & Tom')).toBeInTheDocument();
  });
});

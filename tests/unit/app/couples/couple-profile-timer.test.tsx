import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CoupleProfileHeader } from '@/app/(dashboard)/couples/couple-profile-header';
import type { Couple } from '@/types/couple';
import type { RunningTimer } from '@/types/time-tracking';

const start = vi.fn();
const stop = vi.fn();
const claimSurface = vi.fn(() => () => {});

interface SurfaceStub {
  shadowing: boolean;
  running: RunningTimer | null;
  clockOffsetMs: number;
  isRunningFor: (coupleId: string) => boolean;
  start: (coupleId: string) => void;
  stop: () => void;
  claimSurface: () => () => void;
}

let surface: SurfaceStub;

vi.mock('@/components/time-tracking/timer-provider', () => ({
  useTimerSurface: () => surface,
}));

const NOW = '2026-07-30T02:12:47.000Z';
const START = '2026-07-30T02:00:00.000Z';

const couple = {
  id: 'couple-1',
  user_id: 'user-1',
  created_at: NOW,
  name: 'Sarah & Tom',
  email: '',
  phone: '',
  status: 'new',
  notes: '',
  kanban_position: 0,
  event_date: null,
  venue: '',
  lead_source: null,
  primary_name: 'Sarah',
  secondary_name: 'Tom',
} as unknown as Couple;

function runningTimer(coupleName: string): RunningTimer {
  return {
    entry: {
      id: 'entry-1',
      couple_id: coupleName === 'Sarah & Tom' ? 'couple-1' : 'couple-2',
      started_at: START,
      ended_at: null,
      category_id: null,
      category_name: null,
      note: null,
      auto_stopped: false,
    },
    couple_name: coupleName,
    server_now: NOW,
  };
}

function renderHeader() {
  return render(
    <CoupleProfileHeader
      couple={couple}
      statuses={[]}
      onSave={vi.fn()}
      onClose={vi.fn()}
      onRotateLinks={vi.fn()}
      onDeleteRequest={vi.fn()}
      settingsMode={false}
      onSettingsToggle={vi.fn()}
    />,
  );
}

describe('CoupleProfileHeader timer control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
    surface = {
      shadowing: false,
      running: null,
      clockOffsetMs: 0,
      isRunningFor: () => false,
      start,
      stop,
      claimSurface,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a Start timing control when nothing is running', () => {
    renderHeader();
    expect(
      screen.getAllByRole('button', { name: /start timing/i }).length,
    ).toBeGreaterThan(0);
  });

  it('starting calls start with the couple id', async () => {
    renderHeader();
    await userEvent.click(
      screen.getAllByRole('button', { name: /start timing/i })[0]!,
    );
    expect(start).toHaveBeenCalledWith('couple-1');
  });

  it('shows elapsed time and a stop control for this couple', () => {
    surface.running = runningTimer('Sarah & Tom');
    surface.isRunningFor = (id) => id === 'couple-1';
    renderHeader();
    expect(
      screen.getAllByRole('button', { name: /stop timing/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('00:12:47').length).toBeGreaterThan(0);
  });

  it('stopping calls stop', async () => {
    surface.running = runningTimer('Sarah & Tom');
    surface.isRunningFor = (id) => id === 'couple-1';
    renderHeader();
    await userEvent.click(
      screen.getAllByRole('button', { name: /stop timing/i })[0]!,
    );
    expect(stop).toHaveBeenCalled();
  });

  it('names the other couple when the timer belongs elsewhere', () => {
    surface.running = runningTimer('Alice & Ben');
    surface.isRunningFor = () => false;
    renderHeader();
    expect(screen.getAllByText(/Alice & Ben/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('00:12:47').length).toBeGreaterThan(0);
  });

  it('starting this couple while another runs is still one click', async () => {
    // The concurrency rule is "starting a new one stops the old", so the
    // control must start THIS couple rather than making the MC stop the
    // other timer first.
    surface.running = runningTimer('Alice & Ben');
    surface.isRunningFor = () => false;
    renderHeader();
    await userEvent.click(
      screen.getAllByRole('button', { name: /start timing/i })[0]!,
    );
    expect(start).toHaveBeenCalledWith('couple-1');
    expect(stop).not.toHaveBeenCalled();
  });

  it('renders no timer control in shadow mode', () => {
    surface.shadowing = true;
    surface.running = runningTimer('Sarah & Tom');
    renderHeader();
    expect(
      screen.queryByRole('button', { name: /timing/i }),
    ).not.toBeInTheDocument();
  });
});

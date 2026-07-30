import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoupleTime } from '@/app/(dashboard)/couples/couple-time';
import { orderedTabKeys } from '@/app/(dashboard)/couples/couple-profile-tabs';
import { SECTION_KEYS } from '@/app/(dashboard)/couples/couple-profile-types';

const listMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  listCoupleTimeEntriesAction: (id: string) => listMock(id),
  createCoupleTimeEntryAction: vi.fn(),
  updateCoupleTimeEntryAction: vi.fn(),
  deleteCoupleTimeEntryAction: vi.fn(),
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
}));

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CoupleTime coupleId="couple-1" />
    </QueryClientProvider>,
  );
}

describe('Time tab registration', () => {
  it('registers "time" as a profile tab key', () => {
    expect(SECTION_KEYS).toContain('time');
  });

  it('appends "time" to a stored tab order that predates it', () => {
    const keys = orderedTabKeys({
      hidden_tabs: [],
      tab_order: ['overview', 'tasks'],
    });
    expect(keys).toContain('time');
  });
});

describe('CoupleTime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the empty state when nothing is tracked', async () => {
    listMock.mockResolvedValue({ ok: true, data: [] });
    renderTab();
    expect(await screen.findByText(/no time tracked yet/i)).toBeInTheDocument();
  });

  it('shows an error state when the read fails', async () => {
    listMock.mockResolvedValue({ ok: false, error: 'boom' });
    renderTab();
    expect(
      await screen.findByText(/could not load tracked time/i),
    ).toBeInTheDocument();
  });

  it('renders the total, the category breakdown and the rows', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e1',
          couple_id: 'couple-1',
          started_at: '2026-07-30T02:00:00.000Z',
          ended_at: '2026-07-30T02:48:00.000Z',
          category_id: 'c1',
          category_name: 'Meeting',
          note: 'Venue walkthrough call',
          auto_stopped: false,
        },
        {
          id: 'e2',
          couple_id: 'couple-1',
          started_at: '2026-07-28T02:00:00.000Z',
          ended_at: '2026-07-28T03:15:00.000Z',
          category_id: null,
          category_name: null,
          note: null,
          auto_stopped: false,
        },
      ],
    });
    renderTab();
    expect(await screen.findByText('2h 3m tracked')).toBeInTheDocument();
    expect(screen.getByText('Meeting 48m')).toBeInTheDocument();
    expect(screen.getByText('Uncategorised 1h 15m')).toBeInTheDocument();
    expect(screen.getByText('Venue walkthrough call')).toBeInTheDocument();
    expect(screen.getByText('48m')).toBeInTheDocument();
  });

  it('flags an auto-stopped session', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e3',
          couple_id: 'couple-1',
          started_at: '2026-07-30T02:00:00.000Z',
          ended_at: '2026-07-30T10:00:00.000Z',
          category_id: null,
          category_name: null,
          note: null,
          auto_stopped: true,
        },
      ],
    });
    renderTab();
    expect(await screen.findByText(/auto-stopped/i)).toBeInTheDocument();
  });

  it('shows a running session as running, with no row actions', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'e4',
          couple_id: 'couple-1',
          started_at: '2026-07-30T02:00:00.000Z',
          ended_at: null,
          category_id: null,
          category_name: null,
          note: null,
          auto_stopped: false,
        },
      ],
    });
    renderTab();
    expect(await screen.findByText(/running/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /row actions/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * The running-timer pill never covers a page header's controls (Phase 6
 * live check, B1).
 *
 * The pill was fixed to the viewport's top-right, and the workflow
 * canvas keeps Turn on / Turn off there: the pill's Stop button sat on
 * top of it at every width, so a click meant for Turn on stopped the
 * timer. A surface whose header holds primary controls now registers it
 * as the pill's anchor (`useTimerPillAnchor`), and the pill docks below
 * that header's measured bottom edge, whatever it wraps to.
 *
 * jsdom has no layout, so the header's rectangle is stubbed; the check
 * is the geometry the pill is given: its top is below the header's
 * bottom, so the two boxes cannot overlap.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimerProvider } from '@/components/time-tracking/timer-provider';
import { useTimerPillAnchor } from '@/components/time-tracking/use-timer-pill-anchor';

const getRunningMock = vi.fn();

vi.mock('@/app/(dashboard)/couples/time-actions', () => ({
  getRunningTimerAction: () => getRunningMock(),
  startCoupleTimerAction: vi.fn(),
  stopCoupleTimerAction: vi.fn(),
  updateCoupleTimeEntryAction: vi.fn(),
  listTimeCategoriesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createTimeCategoryAction: vi.fn(),
  renameTimeCategoryAction: vi.fn(),
  deleteTimeCategoryAction: vi.fn(),
  setTimeCategoryColorAction: vi.fn(),
}));

const NOW = '2026-07-30T02:12:47.000Z';

function running() {
  return {
    ok: true,
    data: {
      entry: {
        id: 'entry-1',
        couple_id: 'couple-1',
        started_at: '2026-07-30T02:00:00.000Z',
        ended_at: null,
        category_id: null,
        category_name: null,
        note: null,
        auto_stopped: false,
      },
      couple_name: 'Sarah & Tom',
      server_now: NOW,
    },
  };
}

/** A header with a Turn on button, registered as the pill's anchor. */
function CanvasLikeHeader({ bottom }: { bottom: number }) {
  const anchor = useTimerPillAnchor();
  return (
    <header
      ref={(el) => {
        if (el) {
          el.getBoundingClientRect = () =>
            ({ top: 0, bottom, left: 0, right: 1440, width: 1440, height: bottom, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        }
        anchor(el);
      }}
    >
      <button type="button">Turn on</button>
    </header>
  );
}

function renderWith(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TimerProvider shadowing={false}>{page}</TimerProvider>
    </QueryClientProvider>,
  );
}

function topOf(pill: HTMLElement): number | null {
  const v = pill.style.getPropertyValue('--timer-pill-top');
  return v ? Number.parseFloat(v) : null;
}

describe('the timer pill and a page header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRunningMock.mockResolvedValue(running());
  });

  it('docks below a registered header, clear of its bottom edge (desktop header)', async () => {
    renderWith(<CanvasLikeHeader bottom={57} />);
    const pill = await screen.findByTestId('timer-pill');
    expect(pill.className).toContain('top-[var(--timer-pill-top)]');
    expect(pill.className).not.toMatch(/(^|\s)(md:)?top-(3|16)(\s|$)/);
    expect(topOf(pill)).toBeGreaterThan(57);
  });

  it('docks below a taller header too (phone: top bar plus canvas header)', async () => {
    renderWith(<CanvasLikeHeader bottom={114} />);
    const pill = await screen.findByTestId('timer-pill');
    expect(topOf(pill)).toBeGreaterThan(114);
  });

  it('keeps its corner on a page with no registered header', async () => {
    renderWith(<div>page</div>);
    const pill = await screen.findByTestId('timer-pill');
    expect(pill.className).toContain('top-16');
    expect(topOf(pill)).toBeNull();
  });

  it('works outside a TimerProvider without throwing (the hook is optional)', () => {
    expect(() => render(<CanvasLikeHeader bottom={57} />)).not.toThrow();
  });
});

/**
 * Pure date-math helpers for the dashboard period selector.
 *
 * The dashboard headers and charts use **two different windowing
 * schemes** depending on what's being computed:
 *
 * 1. **Rolling window** — used on stat cards (Leads, Revenue,
 *    Conversion). The current window is the last N days; the
 *    previous window is the N days before that. Avoids the
 *    "cliff drop" effect where on Monday morning the weekly stat
 *    suddenly resets to near-zero.
 *
 * 2. **Calendar-aligned window** — used on charts + lead-source
 *    panels. The current window is "this calendar week / month /
 *    quarter / year so far" with the previous window being the
 *    equivalent slice of the prior period. Better for charts that
 *    align to real calendar buckets (Jan-Mar = Q1, etc.).
 *
 * Extracted from `app/(dashboard)/use-dashboard.ts` so the math
 * can be unit-tested with frozen `now` values without mounting
 * the React Query hooks.
 *
 * **Week convention:** Monday-start. `dayOfWeek === 0` (Sunday)
 * maps to `daysFromMonday = 6` rather than 0.
 *
 * @module lib/dashboard/periods
 */

export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year';

const DAYS_PER_PERIOD: Record<DashboardPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PeriodWindow {
  currentStart: string;
  previousStart: string;
  previousEnd: string;
}

/**
 * Rolling-window math: last N days vs the N days before that.
 * The `now` argument is injectable for deterministic testing.
 */
export function getRollingWindow(
  period: DashboardPeriod,
  now: Date = new Date(),
): PeriodWindow {
  const ms = DAYS_PER_PERIOD[period] * MS_PER_DAY;
  const currentStart = new Date(now.getTime() - ms).toISOString();
  const previousStart = new Date(now.getTime() - 2 * ms).toISOString();
  return { currentStart, previousStart, previousEnd: currentStart };
}

/**
 * Calendar-aligned window math:
 * - week: Monday → today
 * - month: 1st of this month → today
 * - quarter: first day of quarter → today
 * - year: Jan 1 → today
 *
 * The "previous" range is the equivalent slice of the prior period
 * (so we can show "this week so far vs last week to the same point").
 */
export function getPeriodWindow(
  period: DashboardPeriod,
  now: Date = new Date(),
): PeriodWindow {
  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentStart = new Date(now);
      currentStart.setDate(now.getDate() - daysFromMonday);
      currentStart.setHours(0, 0, 0, 0);
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: currentStart.toISOString(),
      };
    }
    case 'month': {
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysElapsed = now.getDate() - 1;
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      const previousEnd = new Date(prevMonthStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevMonthStart.toISOString(),
        previousEnd: (previousEnd > prevMonthEnd
          ? prevMonthEnd
          : previousEnd
        ).toISOString(),
      };
    }
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const currentStart = new Date(now.getFullYear(), qMonth, 1);
      const daysElapsed = Math.floor(
        (now.getTime() - currentStart.getTime()) / MS_PER_DAY,
      );
      const prevQStart = new Date(now.getFullYear(), qMonth - 3, 1);
      const previousEnd = new Date(prevQStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevQStart.toISOString(),
        previousEnd: previousEnd.toISOString(),
      };
    }
    case 'year': {
      const currentStart = new Date(now.getFullYear(), 0, 1);
      const daysElapsed = Math.floor(
        (now.getTime() - currentStart.getTime()) / MS_PER_DAY,
      );
      const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const previousEnd = new Date(prevYearStart);
      previousEnd.setDate(previousEnd.getDate() + daysElapsed + 1);
      return {
        currentStart: currentStart.toISOString(),
        previousStart: prevYearStart.toISOString(),
        previousEnd: previousEnd.toISOString(),
      };
    }
  }
}

export interface ChartConfig {
  chartStart: Date;
  format: (d: Date) => string;
  initKeys: () => string[];
}

/**
 * Chart-window config for trend charts:
 * - Weekly  → last 8 weeks (Monday-anchored)
 * - Monthly → last 12 months
 * - Quarterly → last 6 quarters
 * - Yearly  → last 5 years
 */
export function getChartConfig(
  period: DashboardPeriod,
  now: Date = new Date(),
): ChartConfig {
  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentMonday = new Date(now);
      currentMonday.setDate(now.getDate() - daysFromMonday);
      currentMonday.setHours(0, 0, 0, 0);
      const chartStart = new Date(currentMonday);
      chartStart.setDate(chartStart.getDate() - 7 * 7);
      const getMonday = (d: Date) => {
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        mon.setHours(0, 0, 0, 0);
        return mon;
      };
      const fmt = (d: Date) =>
        getMonday(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      return {
        chartStart,
        format: fmt,
        initKeys: () =>
          Array.from({ length: 8 }, (_, i) => {
            const d = new Date(chartStart);
            d.setDate(d.getDate() + i * 7);
            return fmt(d);
          }),
      };
    }
    case 'month': {
      const chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const fmt = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
      return {
        chartStart,
        format: fmt,
        initKeys: () =>
          Array.from({ length: 12 }, (_, i) =>
            fmt(
              new Date(
                chartStart.getFullYear(),
                chartStart.getMonth() + i,
                1,
              ),
            ),
          ),
      };
    }
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const chartStart = new Date(now.getFullYear(), qMonth - 15, 1);
      const fmtQ = (d: Date) => {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q} '${String(d.getFullYear()).slice(2)}`;
      };
      return {
        chartStart,
        format: (d) =>
          fmtQ(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)),
        initKeys: () =>
          Array.from({ length: 6 }, (_, i) =>
            fmtQ(
              new Date(
                chartStart.getFullYear(),
                chartStart.getMonth() + i * 3,
                1,
              ),
            ),
          ),
      };
    }
    case 'year': {
      const chartStart = new Date(now.getFullYear() - 4, 0, 1);
      return {
        chartStart,
        format: (d) => String(d.getFullYear()),
        initKeys: () =>
          Array.from({ length: 5 }, (_, i) =>
            String(chartStart.getFullYear() + i),
          ),
      };
    }
  }
}

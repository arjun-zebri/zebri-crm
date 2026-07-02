/**
 * Shared layout shell for every tab inside the Couple Profile modal.
 *
 * Standardises three things across all tabs so they read as one product:
 * - A **titled header**: the tab name plus a muted, dot-separated stat
 *   sub-line (positive statuses tinted green), with the primary action(s)
 *   on the right.
 * - A **centered empty state** that overlays the full tab body and sits
 *   a touch above the geometric centre (true centre reads as "too low"
 *   to the eye — optical centre).
 *
 * Usage:
 * ```tsx
 * <CoupleTabShell
 *   title="Tasks"
 *   stats={all.length ? [{ label: tabStat(all.length, 'task') }, { label: `${done} done`, tone: 'success' }] : undefined}
 *   actions={<Button>Add task</Button>}
 * >
 *   {isLoading ? <Skeleton /> : isEmpty ? (
 *     <CoupleTabEmpty icon={CheckSquare} title="No tasks yet" description="Add one above." />
 *   ) : (
 *     <List />
 *   )}
 * </CoupleTabShell>
 * ```
 *
 * `CoupleTabEmpty` relies on the shell's `relative` + full-height root,
 * so it must only be rendered as a child of `CoupleTabShell`.
 *
 * @module app/(dashboard)/couples/couple-tab-shell
 */
'use client';

import { Fragment, type ReactNode } from 'react';

import { Empty, type EmptyProps } from '@/components/ui/empty';

/** One dot-separated part of a tab's header sub-line. */
export interface TabStat {
  /** Display text, e.g. "3 total" or "1 signed". */
  label: string;
  /**
   * `'success'` tints the part green (`text-success`), `'danger'` red
   * (`text-danger`, e.g. an overdue count); omit for muted.
   */
  tone?: 'success' | 'danger';
}

const TONE_CLASS: Record<NonNullable<TabStat['tone']>, string> = {
  success: 'font-medium text-success',
  danger: 'font-medium text-danger',
};

export interface CoupleTabShellProps {
  /** Tab name shown as the header title, e.g. "Contracts". */
  title?: string;
  /**
   * Sub-line stat parts under the title (e.g. total + status breakdown).
   * Pass only when the tab has data so it never shows beside the centered
   * empty state.
   */
  stats?: TabStat[];
  /** Primary action button(s), rendered on the right. Omit for read-only tabs (e.g. Vows). */
  actions?: ReactNode;
  /** Tab body — typically the loading / error / empty / content branch. */
  children: ReactNode;
}

/**
 * Root wrapper for a Couple Profile tab: a full-height flex column with an
 * optional titled header (title + stat sub-line on the left, `actions` on the
 * right). The header renders when a `title` or `actions` is present.
 */
export function CoupleTabShell({ title, stats, actions, children }: CoupleTabShellProps) {
  return (
    <div className="relative flex flex-1 flex-col gap-6 min-h-0">
      {title || actions ? (
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="truncate text-lg font-semibold text-text">{title}</h2>
            ) : null}
            {stats && stats.length > 0 ? (
              <p className="mt-0.5 truncate text-sm text-text-muted">
                {stats.map((s, i) => (
                  <Fragment key={i}>
                    {i > 0 ? <span className="text-text-subtle"> · </span> : null}
                    <span className={s.tone ? TONE_CLASS[s.tone] : undefined}>{s.label}</span>
                  </Fragment>
                ))}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Build a pluralized count stat for a tab header, e.g. `tabStat(3, 'file')`
 * → "3 files", `tabStat(1, 'event')` → "1 event". Adjective-style stats
 * ("3 sent", "1 signed") are built inline at the call site instead.
 */
export const tabStat = (n: number, noun: string): string =>
  `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * Centered empty state for a tab. Overlays the full tab body (behind the
 * actions row) and sits slightly above centre. Text-only by design — the
 * primary action lives in the shell's top-right row, never inside the empty.
 */
export function CoupleTabEmpty(props: Omit<EmptyProps, 'size' | 'action' | 'className'>) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pb-[14vh]">
      <Empty size="sm" {...props} />
    </div>
  );
}

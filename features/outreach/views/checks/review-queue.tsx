'use client';

/**
 * Needs-review queue: one prospect at a time, decided with A, I or S.
 *
 * Shortcuts are ignored while the founder types in a field or while a
 * dialog is open, so they never fire into another control. The queue
 * refetches after each decision, so the next prospect slides into the
 * same index.
 *
 * @module features/outreach/views/checks/review-queue
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { setVerdictAction } from '@/features/outreach/actions';
import { useOutreachMutation, useReviewQueue } from '@/features/outreach/hooks';

import { ReviewCard } from './review-card';

/** True when the key event came from somewhere a letter should be typed. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The review queue panel. Works through a page of 25 at a time; `total`
 * is the real number waiting, since the page itself is capped.
 */
export function ReviewQueue({ total, onDone }: { total: number; onDone: () => void }) {
  const q = useReviewQueue();
  // A background run (the tick, with this tab closed) moves `total` via the
  // polled checks query; follow it so the queue never shows a stale page.
  const { refetch } = q;
  // Why: the query already fetches on mount, so only a change in `total` after that needs another fetch.
  const lastTotal = useRef(total);
  useEffect(() => {
    if (lastTotal.current === total) return;
    lastTotal.current = total;
    void refetch();
  }, [total, refetch]);
  const [index, setIndex] = useState(0);
  const rows = q.data ?? [];
  const current = rows[Math.min(index, Math.max(rows.length - 1, 0))] ?? null;
  const saveVerdict = useOutreachMutation(setVerdictAction);
  const { mutate: save, isPending: saving } = saveVerdict;

  const decide = useCallback(
    (verdictValue: 'active' | 'inactive') => {
      if (!current || saving) return;
      save({ ids: [current.id], verdict: verdictValue });
    },
    [current, saving, save],
  );

  const skip = useCallback(() => {
    setIndex((i) => (rows.length > 0 ? (i + 1) % rows.length : 0));
  }, [rows.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // An open dialog owns the keyboard; letters must not decide prospects behind it.
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'a') decide('active');
      else if (key === 'i') decide('inactive');
      else if (key === 's') skip();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, skip]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-body font-semibold text-text">Needs review</h2>
        {rows.length > 0 && (
          <p className="text-body text-text-muted">
            {Math.min(index, rows.length - 1) + 1} of {total} · A active, I inactive, S skip
          </p>
        )}
      </div>
      {q.isPending && <Loading label="Loading the queue" variant="inline" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.isSuccess && !current && (
        <Empty
          title="Nothing to review"
          description="Every prospect the checks could not settle has a decision."
          action={<Button variant="outline" onClick={onDone}>Back to prospects</Button>}
        />
      )}
      {current && (
        <Card>
          <ReviewCard
            prospect={current}
            pending={saving}
            onDecide={decide}
            onSkip={skip}
          />
        </Card>
      )}
    </section>
  );
}

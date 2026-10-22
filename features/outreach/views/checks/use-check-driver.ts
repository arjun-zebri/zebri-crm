'use client';

/**
 * Drives check runs forward while the Prospects page is open.
 *
 * The server does one batch per call and returns `active: false` when
 * nothing is left, so the browser loops over batches until then. Closing
 * the tab stops the loop; the runs carry on slowly in the background
 * (the cron tick), so nothing is lost.
 *
 * @module features/outreach/views/checks/use-check-driver
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { processCheckBatchAction } from '@/features/outreach/actions';
import { OUTREACH_KEY } from '@/features/outreach/hooks';

/**
 * Run batches back to back while `running` is true.
 *
 * Why the refs: React may run effects twice in development, and a
 * re-render must not start a second loop next to the first. `loopActive`
 * guards the loop, and `mounted` stops it on unmount.
 *
 * A failed batch stops the loop and is returned as `error`, so the page can
 * say "Check paused" and offer `retry`. It does not retry on its own: a
 * server that is failing would be hammered every few hundred milliseconds.
 *
 * @param running - True while any check run is in progress.
 */
export function useCheckDriver(running: boolean): { error: string | null; retry: () => void } {
  const queryClient = useQueryClient();
  const loopActive = useRef(false);
  const mounted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!running || loopActive.current) return;
    loopActive.current = true;
    setError(null);
    void (async () => {
      try {
        while (mounted.current) {
          const res = await processCheckBatchAction();
          if (!res.ok) {
            setError(res.error);
            return;
          }
          // Refresh everything after every batch: progress bars, and the
          // verdicts that the review queue and prospect list show.
          await queryClient.invalidateQueries({ queryKey: [OUTREACH_KEY] });
          if (!res.data.active) return;
        }
      } finally {
        loopActive.current = false;
      }
    })();
  }, [running, queryClient, attempt]);

  return { error, retry: () => setAttempt((a) => a + 1) };
}

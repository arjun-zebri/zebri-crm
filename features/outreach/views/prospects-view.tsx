'use client';

/**
 * Admin > Outreach > Prospects: every person in the pipeline. This is the
 * home for people: import a sheet or add someone by hand, run the activity check, work the
 * needs-review queue, filter the table, or switch to the pipeline board.
 *
 * The page's shape follows what the founder can act on. With no prospects
 * it shows one Import call and nothing else. With prospects it shows the
 * toolbar, a stats line, and a needs-review line only when someone is
 * waiting. Check runs appear only while in flight. The URL contract (import,
 * check, board, review, prospect) is documented in {@link useProspectsUrl}.
 *
 * @module features/outreach/views/prospects-view
 */
import { useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { useChecks } from '@/features/outreach/hooks';

import { CheckPaused } from './checks/check-paused';
import { ImportWizard } from './checks/import-wizard';
import { ReviewQueue } from './checks/review-queue';
import { ActiveRuns, PastChecks } from './checks/runs-list';
import { StartRunModal } from './checks/start-run-modal';
import { useCheckDriver } from './checks/use-check-driver';
import { PipelineView } from './pipeline-view';
import { AddProspectDialog } from './prospects/add-prospect-dialog';
import { ProspectModal } from './prospects/prospect-modal';
import { ProspectsEmpty } from './prospects/prospects-empty';
import { ProspectsList } from './prospects/prospects-list';
import { ProspectsStats } from './prospects/prospects-stats';
import { ProspectsToolbar } from './prospects/prospects-toolbar';
import { ReviewCallout } from './prospects/review-callout';
import { useProspectsList } from './prospects/use-prospects-list';
import { useProspectsUrl } from './prospects/use-prospects-url';

/**
 * Run statuses that still have work for the driver. Matches the rule in
 * `useCheckDriver`, so the card shows exactly while the loop is running.
 */
const IN_PROGRESS = new Set(['queuing', 'running']);

/** The Prospects page. */
export function ProspectsView() {
  const url = useProspectsUrl();
  const list = useProspectsList();
  const checks = useChecks();
  const [adding, setAdding] = useState(false);
  const running = !!checks.data?.runs.some((r) => IN_PROGRESS.has(r.status));
  const driver = useCheckDriver(running);

  if (checks.isPending) {
    return (
      <SkeletonRegion label="Loading prospects">
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </SkeletonRegion>
    );
  }
  if (checks.isError) return <ErrorState error={checks.error} onRetry={() => void checks.refetch()} />;

  const data = checks.data;
  const isEmpty = data.total === 0;

  // Why one fragment: the modals keep the same position whether the page is
  // empty or populated. The first import flips the page out of its empty
  // state while the wizard is still open; a remount there would lose the
  // wizard's onClose and leave `?import=1` stuck in the URL.
  const content = isEmpty ? (
    <ProspectsEmpty onImport={() => url.setParams({ import: '1' })} onAdd={() => setAdding(true)} />
  ) : (
    <div className="space-y-6">
      <ProspectsToolbar
        board={url.board}
        unchecked={data.counts.unchecked}
        onLayout={(layout) => {
          // Selection belongs to the table; leaving it must not carry bulk actions into the board.
          list.clearSelection();
          url.setParams({ board: layout === 'board' ? '1' : null, review: null });
        }}
        onImport={() => url.setParams({ import: '1' })}
        onAdd={() => setAdding(true)}
        onCheck={() => url.setParams({ check: '1' })}
      />
      {!url.board && !url.review && (
        <ProspectsStats
          counts={data.counts}
          spentCentsThisMonth={data.spentCentsThisMonth}
          budgetCents={data.budgetCents}
          verdict={list.filters.verdict}
          onVerdict={(verdict) => list.changeFilters({ verdict })}
        />
      )}
      {data.counts.needsReview > 0 && !url.review && (
        <ReviewCallout count={data.counts.needsReview} onReview={() => url.setParams({ review: '1', board: null })} />
      )}
      {driver.error && <CheckPaused message={driver.error} onRetry={driver.retry} />}
      <ActiveRuns runs={data.runs} />
      {url.board ? (
        <PipelineView />
      ) : url.review ? (
        <ReviewQueue total={data.counts.needsReview} onDone={() => url.setParams({ review: null })} />
      ) : (
        <ProspectsList list={list} onOpen={(id) => url.setParams({ prospect: id })} />
      )}
      <PastChecks runs={data.runs} />
    </div>
  );

  return (
    <>
      {content}
      {url.importing && <ImportWizard onClose={() => url.setParams({ import: null })} />}
      {url.checking && (
        <StartRunModal
          counts={data.counts}
          spentCentsThisMonth={data.spentCentsThisMonth}
          budgetCents={data.budgetCents}
          onClose={() => url.setParams({ check: null })}
        />
      )}
      {adding && (
        <AddProspectDialog
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            url.setParams({ prospect: id });
          }}
        />
      )}
      <ProspectModal prospectId={url.openId} onClose={() => url.setParams({ prospect: null })} />
    </>
  );
}

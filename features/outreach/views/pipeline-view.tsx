'use client';

/**
 * Prospects > Board: prospects past first contact, as a board. Shown when
 * `?board=1` is on the Prospects page; the page owns the toolbar around it.
 *
 * Moving a card saves immediately and shows in its new column at once.
 * Moving to Lost asks for a reason first.
 *
 * @module features/outreach/views/pipeline-view
 */
import { useState } from 'react';

import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { usePipeline } from '@/features/outreach/hooks';
import type { ProspectRow } from '@/lib/outreach/services/queries';

import { LostReasonModal } from './pipeline/lost-reason-modal';
import { PipelineBoard } from './pipeline/pipeline-board';
import { PipelineSkeleton } from './pipeline/pipeline-skeleton';
import { useMoveProspect } from './pipeline/use-move-prospect';

/** Pipeline tab. */
export function PipelineView() {
  const pipeline = usePipeline();
  const move = useMoveProspect();
  const [lostFor, setLostFor] = useState<ProspectRow | null>(null);

  if (pipeline.isPending) return <PipelineSkeleton />;
  if (pipeline.isError) {
    return <ErrorState error={pipeline.error} onRetry={() => void pipeline.refetch()} />;
  }

  const rows = pipeline.data;
  if (rows.length === 0) {
    return (
      <Empty title="Nothing on the board yet" description="People show up here once they've been contacted." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Why: on a phone there is no drag handle worth aiming for, so the card's menu is named as the way to move people. */}
      <p className="text-body text-text-muted">
        <span className="hidden md:inline">Drag a card by its handle, or use its menu, to move it.</span>
        <span className="md:hidden">Use a card&apos;s menu to move it to another stage.</span> Click a name to open the prospect.
      </p>
      <PipelineBoard
        rows={rows}
        onMove={(row, stage) => {
          if (stage === 'lost') setLostFor(row);
          else move.mutate({ row, stage });
        }}
      />
      {lostFor && <LostReasonModal key={lostFor.id} row={lostFor} onClose={() => setLostFor(null)} />}
    </div>
  );
}

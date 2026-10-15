'use client';

/**
 * The prospect modal. Exported so Today can open the same view from any
 * row that names a prospect. Pass `prospectId` to open it, `null` to
 * close it.
 *
 * Layout, and why: the first view answers the questions the founder opens
 * a prospect to answer, and nothing else. Where are they and what stage
 * (one line), what did they say (their latest reply), and the two
 * controls they change most (stage, reply sentiment). Everything else
 * sits behind three tabs: Messages, Details, History.
 *
 * @module features/outreach/views/prospects/prospect-modal
 */
import { useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { UnderlineTabs } from '@/components/ui/underline-tabs';
import { useProspect } from '@/features/outreach/hooks';
import type { ProspectDetail } from '@/lib/outreach/services/queries';

import { MessagesSection } from './drawer-messages';
import { PipelineFields } from './drawer-pipeline';
import { TimelineSection } from './drawer-timeline';
import { LatestReply } from './latest-reply';
import { ProspectDetails } from './prospect-details';
import { ProspectHeader } from './prospect-header';

type Tab = 'messages' | 'details' | 'history';

/** Props for {@link ProspectModal}. */
export interface ProspectModalProps {
  /** The prospect to show. `null` keeps the modal closed. */
  prospectId: string | null;
  onClose: () => void;
}

/** The modal. Loading and error states live inside it. */
export function ProspectModal({ prospectId, onClose }: ProspectModalProps) {
  const query = useProspect(prospectId);
  const name = query.data?.prospect.full_name;
  return (
    <Modal isOpen={prospectId !== null} onClose={onClose} title={name ?? 'Prospect'} size="lg">
      {prospectId !== null && query.isPending && (
        <SkeletonRegion label="Loading prospect">
          <div className="space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16" />
            <Skeleton className="h-40" />
          </div>
        </SkeletonRegion>
      )}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && <ModalBody key={query.data.prospect.id} detail={query.data} onDeleted={onClose} />}
    </Modal>
  );
}

/** The loaded content. Keyed by prospect so no draft or tab leaks between people. */
function ModalBody({ detail, onDeleted }: { detail: ProspectDetail; onDeleted: () => void }) {
  const p = detail.prospect;
  const [tab, setTab] = useState<Tab>('messages');
  const hasReplied = detail.events.some((e) => e.type === 'replied');
  return (
    <div className="space-y-6">
      <ProspectHeader prospect={p} onDeleted={onDeleted} />
      <LatestReply events={detail.events} />
      <PipelineFields prospect={p} hasReplied={hasReplied} />
      <div className="space-y-4">
        <UnderlineTabs<Tab>
          ariaLabel="Prospect sections"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'messages', label: `Messages (${detail.messages.length})` },
            { id: 'details', label: 'Details' },
            { id: 'history', label: 'History' },
          ]}
        />
        {tab === 'messages' && <MessagesSection messages={detail.messages} />}
        {tab === 'details' && <ProspectDetails detail={detail} />}
        {tab === 'history' && <TimelineSection events={detail.events} />}
      </div>
    </div>
  );
}

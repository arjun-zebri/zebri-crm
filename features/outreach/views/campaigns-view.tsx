'use client';

/**
 * Outreach > Campaigns: who gets which sequences, and how fast.
 *
 * Lists campaigns, opens the editor, and changes status. Activation asks
 * first, since it starts real sends. Finishing stops every active
 * sequence, so it asks too. A pause banner shows above the list whenever
 * sending stops, and a one-line setup summary links to Settings while
 * anything is still missing. `?new=1` opens the editor straight away.
 *
 * @module features/outreach/views/campaigns-view
 */
import { Megaphone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import type { CampaignSummary } from '@/lib/outreach/services/queries';

import { setCampaignStatusAction } from '../actions';
import { useCampaigns, useOutreachMutation, useReadiness, useSequences } from '../hooks';

import { ActivateConfirm } from './campaigns/activate-confirm';
import { blankCampaign, draftFromCampaign, type DraftCampaign } from './campaigns/campaign-draft';
import { CampaignEditor } from './campaigns/campaign-editor';
import { CampaignList } from './campaigns/campaign-list';
import { campaignStatusLine, type CampaignNextStatus } from './campaigns/campaign-status-line';
import { SetupSummaryLink } from './readiness/setup-summary-link';
import { newKey } from './sequences/sequence-draft';
import { useNewFromUrl } from './sequences/use-new-from-url';
import { SendingPause } from './settings/sending-pause';

/** The editor that is open. A fresh key remounts it with a new draft. */
interface OpenEditor {
  key: string;
  draft: DraftCampaign;
}

/** Campaigns tab. */
export function CampaignsView() {
  const campaigns = useCampaigns();
  const sequences = useSequences();
  const readiness = useReadiness();
  const status = useOutreachMutation(setCampaignStatusAction);
  const { toast } = useToast();
  // Why: the shared mutation toasts only the data it returns, so the status-specific line is added per call.
  const changeStatus = (id: string, next: CampaignNextStatus, after?: () => void) =>
    status.mutate({ id, status: next }, { onSuccess: () => { toast(campaignStatusLine(next), 'success'); after?.(); } });
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const [toActivate, setToActivate] = useState<CampaignSummary | null>(null);
  const [toFinish, setToFinish] = useState<CampaignSummary | null>(null);

  const open = (draft: DraftCampaign) => setEditor({ key: newKey(), draft });
  const openBlank = () => open(blankCampaign());
  // Why: the editor needs the sequence list, so it waits for both queries.
  const clearNewParam = useNewFromUrl('campaigns', !campaigns.isPending && !sequences.isPending, openBlank);
  const closeEditor = () => {
    setEditor(null);
    clearNewParam();
  };

  if (campaigns.isPending) return <Loading label="Loading campaigns" />;
  if (campaigns.isError) {
    return <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />;
  }

  // Live sequences only: archived ones can't be picked, but their names may still show on old campaigns.
  const liveSequences = (sequences.data ?? []).map((s) => ({ id: s.id, name: s.name }));
  const sequenceNames = new Map(liveSequences.map((s) => [s.id, s.name]));
  const list = campaigns.data;
  const snapshot = readiness.data;

  return (
    <div className="space-y-4">
      {snapshot?.sendingPaused && <SendingPause paused reason={snapshot.pausedReason} />}
      {snapshot && <SetupSummaryLink items={snapshot.items} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-text-muted">
          A campaign picks who to contact and which sequences they get.
        </p>
        {list.length > 0 && <Button onClick={openBlank}>New campaign</Button>}
      </div>

      {list.length === 0 ? (
        <Empty
          icon={Megaphone}
          title="No campaigns yet"
          description="Create one to start sending to celebrants."
          action={<Button onClick={openBlank}>New campaign</Button>}
        />
      ) : (
        <CampaignList
          campaigns={list}
          sequenceNames={sequenceNames}
          pending={status.isPending}
          onEdit={(c) => open(draftFromCampaign(c))}
          onStatus={(c, next) => changeStatus(c.id, next)}
          onActivate={setToActivate}
          onFinish={setToFinish}
        />
      )}

      {editor && (
        <CampaignEditor key={editor.key} initial={editor.draft} sequences={liveSequences} onClose={closeEditor} />
      )}

      <ActivateConfirm
        campaign={toActivate}
        loading={status.isPending}
        onCancel={() => setToActivate(null)}
        onConfirm={() => {
          if (!toActivate) return;
          changeStatus(toActivate.id, 'active', () => setToActivate(null));
        }}
      />

      <ConfirmDialog
        open={toFinish !== null}
        title="Finish this campaign?"
        description="Stops every active sequence in this campaign."
        confirmLabel="Finish"
        loading={status.isPending}
        onCancel={() => setToFinish(null)}
        onConfirm={() => {
          if (!toFinish) return;
          changeStatus(toFinish.id, 'finished', () => setToFinish(null));
        }}
      />
    </div>
  );
}

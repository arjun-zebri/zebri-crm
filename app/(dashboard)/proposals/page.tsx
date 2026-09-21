/**
 * /proposals: templates + basic stats + settings, since Proposal Layout
 * v2 replaced the previous 4-tab plan (Proposals / Templates / Analytics
 * / Settings) — Templates duplicated the sidebar's Templates hub, and
 * Analytics/Settings were empty placeholders. The individual sent-proposal
 * list that used to live below the templates was removed outright
 * (2026-09-19 feedback, repeated: it read as a second, half-empty page
 * under the templates grid every account actually uses) - a proposal's
 * own detail still opens at `/proposals/[id]` for whoever links to it
 * (a couple's profile, an email), this page just doesn't list them.
 * Orchestrator: open builder/settings, sections are co-located components.
 *
 * @module app/(dashboard)/proposals/page
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';

import { proposalLayoutV2Enabled } from './flags';
import { NewTemplateFlow } from './new-template-flow';
import { ProposalSettingsModal } from './proposal-settings-modal';
import { ProposalTemplatesShortcut } from './proposal-templates-shortcut';
import { ProposalsFrame } from './proposals-frame';
import { ProposalsHeader } from './proposals-header';
import { computeProposalStats } from './proposals-stats';
import { ProposalsStatsRow } from './proposals-stats-row';
import { useProposals } from './use-proposals';

export default function ProposalsPage() {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Only the aggregate counts (`ProposalsStatsRow`) are drawn from this -
  // no per-proposal list on this page any more, see the module doc.
  const { data, isLoading } = useProposals();
  const layoutV2 = proposalLayoutV2Enabled();

  return (
    <ProposalsFrame>
      <div className="space-y-6">
        {/* Conditional spread (exactOptionalPropertyTypes): both handlers are
            optional props, present only while Layout v2 is on - an explicit
            `undefined` value isn't the same as an absent key under strict. */}
        <ProposalsHeader
          onNew={() => setNewOpen(true)}
          {...(layoutV2 ? { onNewTemplate: () => setNewTemplateOpen(true) } : {})}
          {...(layoutV2 ? { onOpenSettings: () => setSettingsOpen(true) } : {})}
        />
        {layoutV2 ? <ProposalsStatsRow stats={computeProposalStats(data ?? [])} loading={isLoading} /> : null}
        {layoutV2 ? <ProposalTemplatesShortcut onNewTemplate={() => setNewTemplateOpen(true)} /> : null}
        {newOpen ? (
          <ProposalBuilderModal
            proposalId={null}
            isOpen
            onClose={() => setNewOpen(false)}
            onSaved={(id) => {
              setNewOpen(false);
              router.push(`/proposals/${id}`);
            }}
          />
        ) : null}
        {layoutV2 ? <NewTemplateFlow isOpen={newTemplateOpen} onOpenChange={setNewTemplateOpen} /> : null}
        {layoutV2 ? (
          <ProposalSettingsModal scope={{ kind: 'account' }} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        ) : null}
      </div>
    </ProposalsFrame>
  );
}

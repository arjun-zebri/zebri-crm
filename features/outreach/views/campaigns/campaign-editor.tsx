'use client';

/**
 * Campaign editor modal: name, audience, sequences with weights, and the
 * daily pace. Activation happens from the list, not here.
 *
 * Every way out (Cancel, Escape, the X, the backdrop) goes through one
 * close path. A dirty draft asks before it is thrown away.
 *
 * @module features/outreach/views/campaigns/campaign-editor
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { saveCampaignAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';

import { ArmFields } from './arm-fields';
import { AudienceFields } from './audience-fields';
import { type DraftCampaign, campaignProblems, isDraftDirty, toCampaignPayload } from './campaign-draft';

interface CampaignEditorProps {
  /** Starting state. The parent remounts the editor (new key) to start over. */
  initial: DraftCampaign;
  /** Live sequences to choose from. */
  sequences: { id: string; name: string }[];
  onClose: () => void;
}

/** Fixed-height modal so the footer stays put while the sections change. */
export function CampaignEditor({ initial, sequences, onClose }: CampaignEditorProps) {
  const [draft, setDraft] = useState<DraftCampaign>(initial);
  // Why: a fixed copy of the opening state, so "dirty" means "differs from what the founder started with".
  const [opened] = useState<DraftCampaign>(initial);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const save = useOutreachMutation(saveCampaignAction, 'Campaign saved');
  const problems = campaignProblems(draft);
  const dirty = isDraftDirty(draft, opened);

  // Why: one close path for Cancel, Escape, the X and the backdrop, so none of them can skip the guard.
  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  return (
    <>
      <Modal
        isOpen
        onClose={requestClose}
        size="lg"
        title={draft.id ? 'Edit campaign' : 'New campaign'}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <p className="min-w-0 truncate text-body text-text-muted">{problems[0] ?? ''}</p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={requestClose}>Cancel</Button>
              <Button
                loading={save.isPending}
                disabled={problems.length > 0}
                onClick={() => save.mutate(toCampaignPayload(draft), { onSuccess: onClose })}
              >
                Save campaign
              </Button>
            </div>
          </div>
        }
      >
        <div className="h-[min(560px,60vh)] space-y-6 overflow-y-auto pr-1">
          <Input
            label="Name"
            value={draft.name}
            maxLength={120}
            placeholder="For example, NSW celebrants, October"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <AudienceFields
            states={draft.states}
            minScore={draft.minScore}
            onStates={(states) => setDraft((d) => ({ ...d, states }))}
            onMinScore={(minScore) => setDraft((d) => ({ ...d, minScore }))}
          />
          <ArmFields sequences={sequences} arms={draft.arms} onChange={(arms) => setDraft((d) => ({ ...d, arms }))} />
          <Input
            label="Daily new enrolments"
            type="number"
            min={0}
            max={200}
            value={draft.daily_new_enrolments}
            help="How many new people start this campaign per day."
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft((d) => ({ ...d, daily_new_enrolments: Number.isFinite(n) ? Math.min(200, Math.max(0, Math.round(n))) : 0 }));
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="Your edits to this campaign will be lost."
        confirmLabel="Discard"
        loadingLabel="Discarding..."
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={onClose}
      />
    </>
  );
}

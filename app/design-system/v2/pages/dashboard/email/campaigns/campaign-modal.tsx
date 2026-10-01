'use client';

import { Dialog } from '@/components/ui-v2/dialog';

import type { Campaign } from '../campaigns-data';
import { fillFields } from '../email-data';
import { ClientFrame } from '../render/client-frame';
import { EmailBody } from '../render/email-body';
import { quirksOf } from '../render/quirks';
import type { EmailState } from '../use-email-state';

import { CampaignHeader } from './campaign-header';
import { CampaignSide } from './campaign-side';

/**
 * A campaign opened from the Email page: an `xl` v2 dialog (full screen
 * on phones), laid out like the proposal modal. The header names the
 * campaign and holds its actions. Below, the email as it landed (Gmail
 * on a computer, where most couples read) on the soft grey desk on the
 * left, in the template's current signature; on the right, the results
 * money first, or for one still to go, who and when.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns/campaign-modal
 */

export interface CampaignModalProps {
  /** The open campaign's id; closed while null. */
  id: string | null;
  state: EmailState;
  /** Edit: opens the builder stub for this campaign. */
  onEdit: (c: Campaign) => void;
  onClose: () => void;
}

/** The campaign dialog. See {@link CampaignModalProps}. */
export function CampaignModal({ id, state, onEdit, onClose }: CampaignModalProps) {
  const c = id ? state.campaigns.find((x) => x.id === id) : undefined;
  const t = c ? state.templates.find((x) => x.id === c.template) : undefined;
  return (
    <Dialog open={c !== undefined} onClose={onClose} size="xl" aria-labelledby="campaign-title">
      {c && t ? (
        <>
          <CampaignHeader campaign={c} onEdit={() => onEdit(c)} onClose={onClose} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
            <div className="bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
              <ClientFrame client="gmail" device="desktop" subject={fillFields(t.subject)} preheader={fillFields(t.preheader)}>
                <EmailBody blocks={t.blocks} signature={t.signature} quirks={quirksOf('gmail', 'desktop', t.kb)} marketing />
              </ClientFrame>
            </div>
            <div className="border-zebra-950/5 p-5 md:p-6 lg:overflow-y-auto lg:border-l">
              <CampaignSide campaign={c} state={state} />
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

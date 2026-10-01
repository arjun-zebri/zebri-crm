'use client';

import { useState } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';

import { fillFields, type EmailTemplate } from '../email-data';
import { ClientFrame } from '../render/client-frame';
import { EmailBody } from '../render/email-body';
import { quirksOf, type Client, type Device } from '../render/quirks';
import type { EmailState } from '../use-email-state';

import { PreviewControls } from './preview-controls';
import { TemplateHeader } from './template-header';
import { TemplateSide } from './template-side';

/**
 * A template opened from the Templates tab: an `xl` dialog laid out like
 * the proposal modal. The header names it and holds Edit and More. On
 * the left, on the soft grey desk, the email as it lands in the inbox
 * and device picked above it (`PreviewControls`), bent the way that
 * inbox bends it (`quirksOf`); on the right, how it has done and what it
 * is made of (`TemplateSide`), with the checks for that inbox. Newsletters
 * carry the unsubscribe footer. The inbox and device stay as picked
 * from one template to the next.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/template-dialog
 */

export interface TemplateDialogProps {
  /** The open template's id; closed while null. */
  id: string | null;
  state: EmailState;
  onEdit: (t: EmailTemplate) => void;
  onClose: () => void;
}

/** The template dialog. See {@link TemplateDialogProps}. */
export function TemplateDialog({ id, state, onEdit, onClose }: TemplateDialogProps) {
  const [client, setClient] = useState<Client>('gmail');
  const [device, setDevice] = useState<Device>('desktop');
  const [showFields, setShowFields] = useState(false);
  const t = id ? state.templates.find((x) => x.id === id) : undefined;
  return (
    <Dialog open={t !== undefined} onClose={onClose} size="xl" aria-labelledby="template-title">
      {t ? (
        <>
          <TemplateHeader template={t} state={state} onEdit={() => onEdit(t)} onClose={onClose} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
            <div className="space-y-5 bg-zebra-50 p-5 md:p-8 lg:overflow-y-auto">
              <PreviewControls
                client={client}
                onClient={setClient}
                device={device}
                onDevice={setDevice}
                showFields={showFields}
                onShowFields={setShowFields}
              />
              <ClientFrame client={client} device={device} subject={fillFields(t.subject)} preheader={t.preheader}>
                <EmailBody
                  blocks={t.blocks}
                  signature={t.signature}
                  quirks={quirksOf(client, device, t.kb)}
                  showFields={showFields}
                  marketing={t.folder === 'newsletters'}
                />
              </ClientFrame>
            </div>
            <div className="border-zebra-950/5 p-5 md:p-6 lg:overflow-y-auto lg:border-l">
              <TemplateSide template={t} state={state} client={client} device={device} />
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

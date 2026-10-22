'use client';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { SparklesIcon } from '@/components/ui-v2/icons';

import { CONSENT_WORDS, MOMENTS, listById } from '../campaigns-data';
import { fillFields } from '../email-data';
import { RecordLead } from '../record-lead';
import { ClientFrame } from '../render/client-frame';
import { EmailBody } from '../render/email-body';
import { quirksOf } from '../render/quirks';
import type { EmailState } from '../use-email-state';

/**
 * A send Zebri suggested, opened from the Overview ready to go: an `lg`
 * dialog built from the dialog parts (`RecordLead` under the header) that says what it is and why now, who it goes to (with
 * the consent that allows it) and from which template; under it, the
 * email as the first couple will see it in Gmail. Schedule (the one
 * primary) sends it at 9:00 am tomorrow, the hour wedding emails get
 * opened most; Edit opens the builder stub for a change first.
 *
 * @module app/design-system/v2/pages/dashboard/email/overview/moment-dialog
 */

export interface MomentDialogProps {
  /** The open suggestion's id; closed while null. */
  id: string | null;
  state: EmailState;
  /** Opens the builder stub, named for the send. */
  onEdit: (title: string) => void;
  onClose: () => void;
}

/** The suggested-send dialog. See {@link MomentDialogProps}. */
export function MomentDialog({ id, state, onEdit, onClose }: MomentDialogProps) {
  const m = id ? MOMENTS.find((x) => x.id === id) : undefined;
  const t = m ? state.templates.find((x) => x.id === m.template) : undefined;
  const list = m ? listById(m.list) : undefined;
  const done = m ? state.scheduled.has(m.id) : false;
  return (
    <Dialog open={m !== undefined} onClose={onClose} size="lg" aria-labelledby="moment-title">
      {m && t && list ? (
        <>
          <DialogHeader
            id="moment-kind"
            icon={SparklesIcon}
            title="Suggested send"
            actions={
              <>
                <Button variant="secondary" onClick={() => onEdit(m.title)}>
                  Edit
                </Button>
                <Button
                  disabled={done}
                  onClick={() => {
                    state.schedule(m.id);
                    onClose();
                  }}
                >
                  {done ? 'Scheduled' : 'Schedule for 9:00 am tomorrow'}
                </Button>
              </>
            }
          />
          <RecordLead id="moment-title" name={m.title} roomy>
            <p className="type-lead text-zebra-500">{m.why}</p>
            <p className="type-body text-zebra-500">
              To {m.people} from {list.name} ({CONSENT_WORDS[list.consent].toLowerCase()}) ·{' '}
              {t.name}
            </p>
          </RecordLead>
          <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 p-6 sm:p-10">
            <ClientFrame
              client="gmail"
              device="desktop"
              subject={fillFields(t.subject)}
              preheader={t.preheader}
            >
              <EmailBody
                blocks={t.blocks}
                signature={t.signature}
                quirks={quirksOf('gmail', 'desktop', t.kb)}
                marketing
              />
            </ClientFrame>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

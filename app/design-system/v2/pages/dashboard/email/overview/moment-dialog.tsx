'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import { CONSENT_WORDS, MOMENTS, listById } from '../campaigns-data';
import { fillFields } from '../email-data';
import { ClientFrame } from '../render/client-frame';
import { EmailBody } from '../render/email-body';
import { quirksOf } from '../render/quirks';
import type { EmailState } from '../use-email-state';

/**
 * A send Zebri suggested, opened from the Overview ready to go: an `lg`
 * dialog whose header says what it is and why now, who it goes to (with
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
          <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id="moment-title" className="type-title text-zebra-950">
                {m.title}
              </h2>
              <p className="type-body text-zebra-700">{m.why}</p>
              <p className="type-body text-zebra-500">
                To {m.people} from {list.name} ({CONSENT_WORDS[list.consent].toLowerCase()}) · {t.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
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
            </div>
            <div className="sm:border-l sm:border-zebra-950/5 sm:pl-4">
              <Button variant="ghost" square aria-label="Close" onClick={onClose}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-zebra-50 p-5 md:p-8">
            <ClientFrame client="gmail" device="desktop" subject={fillFields(t.subject)} preheader={t.preheader}>
              <EmailBody blocks={t.blocks} signature={t.signature} quirks={quirksOf('gmail', 'desktop', t.kb)} marketing />
            </ClientFrame>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

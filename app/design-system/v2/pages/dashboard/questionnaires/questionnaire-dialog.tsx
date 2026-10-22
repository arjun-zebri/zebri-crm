'use client';


import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DIALOG_FOOTER_PAD, DialogBody, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { QuestionnaireIcon } from '@/components/ui-v2/icons';


import { ClientView } from './client-view/client-view';
import { asked, filled, progressOf, titleOf } from './questionnaire-data';
import { markComplete, remind, reopen, setAnswer, useSent } from './questionnaire-store';
import { ReadBack } from './read-back';

/**
 * A client's questionnaire, in an `xl` sheet of one height, laid out as
 * a script is: on the left their copy as they see it, with their
 * answers, which the MC can fill in or change (from a call, say: each
 * saves as it is typed); on the right where it stands (how many are
 * answered, when it went, the last reminder) with Remind and Mark
 * complete, or Reopen once it is done. A hairline between them, both
 * white; the header (with Close) runs across the top.
 * It is done only when the client submits or the MC marks it.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/questionnaire-dialog
 */

export interface QuestionnaireDialogProps {
  /** The sent questionnaire to open; null keeps it shut. */
  sentId: string | null;
  onClose: () => void;
}

/** The questionnaire dialog. See {@link QuestionnaireDialogProps}. */
export function QuestionnaireDialog({ sentId, onClose }: QuestionnaireDialogProps) {
  const s = useSent().find((x) => x.id === sentId);
  const done = s?.status === 'completed';
  const left = s ? asked(s.copy).filter((q) => q.required && !filled(s.answers[q.id])).length : 0;
  return (
    <Dialog open={!!s} onClose={onClose} size="xl" aria-labelledby="questionnaire-title">
      {s ? (
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader id="questionnaire-title" icon={QuestionnaireIcon} title={`${titleOf(s.copy)} · ${s.client}`} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            {/* The page style whatever they were sent: the MC reads and fills every answer at once. */}
            <DialogBody className="min-w-0">
              <ClientView template={{ ...s.copy, style: 'page' }} answers={s.answers} onAnswer={(q, a) => setAnswer(s.id, q, a)} />
            </DialogBody>
            <aside aria-label="Where it stands" className="flex shrink-0 flex-col border-t border-hairline lg:w-[22rem] lg:border-l lg:border-t-0">
              {/* Only what has happened: no Reminded line until it has been. */}
              <ReadBack
                compact
                className="flex-1 px-6 py-6 sm:px-8 sm:pt-10"
                rows={[
                  ['Where it stands', progressOf(s)],
                  ['Sent', s.sentOn],
                  ...(s.remindedOn ? [['Reminded', s.remindedOn] as const] : []),
                  ...(done ? [] : [['Still needed', left ? `${left} required ${left === 1 ? 'question' : 'questions'}` : 'Nothing required'] as const]),
                ]}
              />
              <div className={`flex justify-end gap-3 ${DIALOG_FOOTER_PAD}`}>
                {done ? (
                  <Button variant="secondary" onClick={() => reopen(s.id)}>
                    Reopen
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => remind(s.id)}>
                      Remind
                    </Button>
                    <Button onClick={() => markComplete(s.id)}>Mark complete</Button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

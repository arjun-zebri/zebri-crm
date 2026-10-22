'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader, DoneView, EmailStep, useSend, type Mail } from '@/components/ui-v2/dialog-parts';
import { PlusIcon, QuestionnaireIcon } from '@/components/ui-v2/icons';

import { BuilderDialog } from './builder/builder-dialog';
import { asked, newTemplate, titleOf, type Template } from './questionnaire-data';
import { sendQuestionnaire, useTemplates } from './questionnaire-store';

/**
 * Sending a questionnaire to a client, from New document > Questionnaire
 * on their Documents: an `md` dialog of one height, in two steps, as
 * Send a proposal is. Pick one of the MC's questionnaires (or write one,
 * which opens the builder and comes back with it picked), then the email
 * Zebri has written to go with it, as ordinary fields to edit. Send
 * copies it to the client and lands on a done view. No Cancel (a form:
 * Escape, Close or a click outside leave); Back is `plain`.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/send-questionnaire
 */

export interface SendQuestionnaireProps {
  open: boolean;
  /** The client's display name. */
  client: string;
  onClose: () => void;
  /** After sending, with the sent copy's id, so their Documents can pick it. */
  onSent: (sentId: string) => void;
}

type Step = 'pick' | 'message' | 'sent';

const draft = (client: string, t: Template): Mail => ({
  subject: titleOf(t),
  body: `Hi ${client.split(/\s*&\s*/).join(' and ')},\n\nA few questions so I can get every detail right. It takes about ${Math.max(2, Math.round(asked(t).length / 2))} minutes, and you can come back to it any time before you submit.\n\nWarmly,\nArjun`,
});

/** The send dialog. See {@link SendQuestionnaireProps}. Keyed by the caller, so each opening starts fresh. */
export function SendQuestionnaire({ open, client, onClose, onSent }: SendQuestionnaireProps) {
  const templates = useTemplates();
  const [step, setStep] = useState<Step>('pick');
  const [picked, setPicked] = useState<string | null>(templates[0]?.id ?? null);
  const [writing, setWriting] = useState<Template | null>(null);
  const [mail, setMail] = useState<Mail>({ subject: '', body: '' });
  const { busy, send } = useSend();
  const template = templates.find((t) => t.id === picked);
  return (
    <>
      <Dialog open={open && !writing} onClose={onClose} size="md" aria-labelledby="send-questionnaire-title">
        <DialogHeader id="send-questionnaire-title" icon={QuestionnaireIcon} title="Send a questionnaire" aside={step === 'sent' ? undefined : `Step ${step === 'pick' ? 1 : 2} of 2`} />
        {step === 'sent' ? (
          <DoneView title={`Sent to ${client}`} detail="Their answers show on their Documents as they come in, and in your scripts." />
        ) : (
          <DialogBody>
            {step === 'pick' ? (
              <div className="space-y-3">
                <p className="type-body text-zebra-500">Which questionnaire for {client}?</p>
                {templates.map((t) => (
                  <ChoiceCard key={t.id} selected={t.id === picked} onClick={() => setPicked(t.id)} className="w-full text-left">
                    <span className="block type-label text-zebra-950">{titleOf(t)}</span>
                    <span className="block type-body text-zebra-500">
                      {asked(t).length} {asked(t).length === 1 ? 'question' : 'questions'} · {t.style === 'steps' ? 'One at a time' : 'All on one page'}
                    </span>
                  </ChoiceCard>
                ))}
                <Button variant="ghost" compact icon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={() => setWriting(newTemplate())} className="-ml-2">
                  {templates.length ? 'Write a new one' : 'Write your first questionnaire'}
                </Button>
              </div>
            ) : (
              <EmailStep intro={`${template ? titleOf(template) : ''} for ${client}, with this email`} mail={mail} onChange={setMail} disabled={busy} />
            )}
          </DialogBody>
        )}
        <DialogFooter>
          {step === 'pick' ? (
            <Button disabled={!template} onClick={() => template && (setMail(draft(client, template)), setStep('message'))}>
              Next
            </Button>
          ) : step === 'message' ? (
            <>
              <Button variant="plain" onClick={() => setStep('pick')} disabled={busy}>
                Back
              </Button>
              <Button
                loading={busy}
                disabled={!mail.subject.trim() || !mail.body.trim()}
                onClick={() =>
                  send(() => {
                    const s = picked ? sendQuestionnaire(picked, client) : null;
                    if (s) onSent(s.id);
                    setStep('sent');
                  })
                }
              >
                Send questionnaire
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </DialogFooter>
      </Dialog>
      <BuilderDialog
        key={writing?.id ?? 'shut'}
        template={writing}
        onClose={() => setWriting(null)}
        onSaved={(t) => setPicked(t.id)}
      />
    </>
  );
}

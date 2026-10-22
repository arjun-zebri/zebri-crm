'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { QuestionnaireDialog } from '../../questionnaires/questionnaire-dialog';
import { remind, useSent } from '../../questionnaires/questionnaire-store';
import { SendQuestionnaire } from '../../questionnaires/send-questionnaire';

import type { Doc } from './profile-data';
import { questionnaireDoc } from './questionnaire-doc';

/**
 * A client's questionnaires in their Documents: a row for each one sent
 * to them (opening it in the questionnaire dialog, with Remind on the
 * row while it waits), New document > Questionnaire (the send
 * dialog), and the one open in the questionnaire dialog. `dialogs` is
 * the two dialogs, for the section to place once.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/use-questionnaire-docs
 */
export function useQuestionnaireDocs(client: string, pick: (id: string) => void) {
  const sent = useSent().filter((s) => s.client === client);
  // Counts openings of the send dialog, so each starts fresh; 0 is shut.
  const [sending, setSending] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  return {
    docs: sent.map(questionnaireDoc),
    /** Opens a questionnaire from its row; false for any other document. */
    openDoc: (d: Doc) => {
      const s = sent.find((x) => x.id === d.questionnaireId);
      return s ? (setOpen(s.id), true) : false;
    },
    /** Remind on the row while it waits on answers; null otherwise. */
    action: (d: Doc) => {
      const s = sent.find((x) => x.id === d.questionnaireId);
      if (!s || s.status === 'completed') return null;
      return (
        <Button variant="text" onClick={() => remind(s.id)} disabled={s.remindedOn !== undefined}>
          {s.remindedOn ? 'Reminded' : 'Remind'}
        </Button>
      );
    },
    /** New document > Questionnaire. */
    start: () => setSending((n) => n + 1),
    dialogs: (
      <>
        <SendQuestionnaire
          key={sending}
          open={sending > 0}
          client={client}
          onClose={() => setSending(0)}
          onSent={pick}
        />
        <QuestionnaireDialog sentId={open} onClose={() => setOpen(null)} />
      </>
    ),
  };
}

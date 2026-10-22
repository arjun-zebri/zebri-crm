'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { MessageTextIcon, QuestionnaireIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Segmented } from '@/components/ui-v2/segmented';

import { StyleScope, useDocumentStyle } from '../../brand/use-document-style';
import { DesignButton } from '../../canvas/docs/design-button';
import { useDesigning } from '../../canvas/docs/design-store';
import { ClientView } from '../client-view/client-view';
import { type Answer, type Style, type Template } from '../questionnaire-data';
import { saveTemplate } from '../questionnaire-store';

import { QuestionList } from './question-list';

/**
 * Writing a questionnaire, in an `xl` sheet of one height. On the left,
 * the questionnaire as a document: its name, the line to the client, how
 * it is shown (all on one page, or one at a time), then the questions.
 * On the right, what the client sees, live, in the style picked: try it
 * there (those answers are thrown away), on the grey preview well with
 * no border. Laid out as the booking type sheet is (the two editor-and-
 * preview dialogs share one shape): the dialog header across the top with
 * Close at its right, the editor on the left with Save under it, the
 * one button (no Cancel: Escape, Close or a click outside leave), the
 * preview on the right. Save keeps it for every client; closing without
 * saving drops the changes.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/builder/builder-dialog
 */

const STYLES = ['All on one page', 'One at a time'] as const;
const STYLE_OF: Record<(typeof STYLES)[number], Style> = { 'All on one page': 'page', 'One at a time': 'steps' };

export interface BuilderDialogProps {
  /** The questionnaire to edit (a new one for New); null keeps it shut. */
  template: Template | null;
  onClose: () => void;
  /** After a save, with what was saved. */
  onSaved?: ((t: Template) => void) | undefined;
}

/** The builder. See {@link BuilderDialogProps}. Keyed by the caller, so each opening starts fresh. */
export function BuilderDialog({ template, onClose, onSaved }: BuilderDialogProps) {
  const [draft, setDraft] = useState<Template | null>(template);
  const [open, setOpen] = useState<string | null>(template?.questions[0]?.id ?? null);
  const [tried, setTried] = useState<Record<string, Answer>>({});
  const style = useDocumentStyle('questionnaire');
  // Out of the way while Design is open over it; back, as it was, after (see `useDesigning`).
  const designing = useDesigning();
  const set = (patch: Partial<Template>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  return (
    <Dialog open={!!template && !designing} onClose={onClose} size="xl" aria-labelledby="builder-title">
      {draft ? (
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader id="builder-title" icon={QuestionnaireIcon} title="Questionnaire" />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
              <DialogBody className="space-y-8">
                {/* The builder's own fields are lines led by their icons (option G, 2026-10-14), all one size. */}
                <div className="space-y-1">
                  <Input icon={QuestionnaireIcon} label="Questionnaire name" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                  <Input wide icon={MessageTextIcon} label="Line to the client" value={draft.intro} onChange={(e) => set({ intro: e.target.value })} />
                </div>
                <Segmented
                  label="How it is shown"
                  options={STYLES}
                  value={draft.style === 'steps' ? 'One at a time' : 'All on one page'}
                  onChange={(s) => set({ style: STYLE_OF[s] })}
                />
                <QuestionList questions={draft.questions} onChange={(questions) => set({ questions })} open={open} onOpen={setOpen} />
              </DialogBody>
              <DialogFooter>
                <Button
                  onClick={() => {
                    saveTemplate(draft);
                    onSaved?.(draft);
                    onClose();
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
            {/* The preview well: grey, no border, inset to the body's padding. */}
            <aside
              aria-label="What the client sees"
              className="mx-6 mb-6 flex shrink-0 flex-col rounded-panel bg-zebra-50 sm:mx-10 sm:mb-10 lg:ml-0 lg:mt-10 lg:min-h-0 lg:w-[30rem]"
            >
              <div className="flex min-h-9 items-center justify-between gap-2 px-6 pt-4 sm:px-8">
                <GroupLabel>What they see</GroupLabel>
                <DesignButton kind="questionnaire" data={{ template: draft }} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 max-lg:max-h-96 sm:px-8">
                {/* Keyed by style, so switching starts the client at the top. */}
                <StyleScope style={style}>
                  <ClientView
                    key={draft.style}
                    template={draft}
                    answers={tried}
                    onAnswer={(q, a) => setTried((t) => ({ ...t, [q]: a }))}
                    onSubmit={() => setTried({})}
                  />
                </StyleScope>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

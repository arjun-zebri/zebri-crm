'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EditIcon, EyeIcon, SentIcon } from '@/components/ui-v2/icons';

import { useEmailTemplates } from '../documents/email-templates';

import { EmailBuilder } from './email-builder';
import { InboxPreview, START_VIEW, type PreviewView } from './inbox-preview';
import type { Journey, JourneyStep } from './journeys-data';
import { draftOf, emailOf, reminderDraftOf, reminderOf } from './step-email';
import { isRemind } from './step-follow-ups';
import { StepPanel } from './step-panel';
import { StepPreview } from './step-preview';
import type { StepEmail } from './step-settings';
import { TabMenu } from './tab-menu';
import { shortTiming, timingOf } from './timing';
import { TodoDialog } from './todo-dialog';

/**
 * A step, opened from its card, after the founder's mockup (2026-10-07):
 * on the left, everything the client receives from it, a tab each, or
 * a dropdown past three (`TabMenu`) (a
 * document step's document, the email it goes out in, then each Remind
 * follow-up's email), the picked one shown at full size, an email as it
 * reaches them (`InboxPreview`: the email card, as the builder draws it);
 * over it Send test, and Edit email (or Open editor, for the document). On the right the step's
 * settings (`StepPanel`), where picking a Remind follow-up shows its
 * tab. A to-do sends nothing, so it opens its own narrow dialog instead
 * (`TodoDialog`).
 *
 * Extra large and fixed in height, so the page reads at full size and
 * nothing jumps as tabs come and go. On a phone the panel fills the
 * screen and Preview in its foot shows the page. Built from the dialog
 * parts (`StepPanel` holds the header and footer): no bars, no rules
 * beyond the hairline between the page and the panel.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-dialog
 */

export interface StepDialogProps {
  /** The journey the step belongs to. */
  journey: Journey;
  step: JourneyStep | null;
  onChange: (step: JourneyStep) => void;
  /** Opens the step's document: its template over the page, or where it lives. */
  onEdit: (step: JourneyStep) => void;
  /** Takes the step off the journey (the page offers Undo). */
  onRemove: (step: JourneyStep) => void;
  onClose: () => void;
}

/** What a document step's tab is called. */
const DOC: Partial<Record<JourneyStep['kind'], string>> = { proposal: 'Proposal', contract: 'Contract', invoice: 'Invoice', questionnaire: 'Questionnaire', runSheet: 'Run sheet' };

/** The one thing each kind's email asks them to do, as its button. */
const ACTION: Partial<Record<JourneyStep['kind'], string>> = { proposal: 'View your proposal', contract: 'Review and sign', invoice: 'Pay the invoice', questionnaire: 'Fill it in', runSheet: 'Open the run sheet' };

/** "Remind them after 3 days" → "3 days". */
const spanOf = (item: string) => /after (.+)$/.exec(item)?.[1] ?? item;

/** The step dialog. See {@link StepDialogProps}. */
export function StepDialog({ journey, step, onChange, onEdit, onRemove, onClose }: StepDialogProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [tested, setTested] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [view, setView] = useState<PreviewView>(START_VIEW);
  const templates = useEmailTemplates();
  if (!step) return null;
  if (step.kind === 'todo') return <TodoDialog journey={journey} step={step} onChange={onChange} onRemove={() => onRemove(step)} onClose={onClose} />;
  const at = journey.steps.findIndex((s) => s.id === step.id);
  const prev = journey.steps[at - 1];
  const next = journey.steps[at + 1];
  const doc = DOC[step.kind];
  // An invoice going with the contract arrives in the contract's email, so it has none of its own.
  const ownEmail = !(step.kind === 'invoice' && prev?.kind === 'contract' && step.withPrev);
  const reminders = step.reminders.filter(isRemind);
  const tabs = [...(doc ? ['doc'] : []), ...(ownEmail ? ['email'] : []), ...reminders];
  const labels: Record<string, string> = { doc: doc ?? '', email: doc ? 'Email' : step.name, ...Object.fromEntries(reminders.map((r) => [r, `Reminder · ${spanOf(r)}`])) };
  const tab = picked && tabs.includes(picked) ? picked : (tabs[0] ?? 'email');
  const reminder = tab !== 'doc' && tab !== 'email';
  const email: StepEmail = reminder ? reminderOf(step, tab, next) : emailOf(step, next);
  const draft: StepEmail = reminder ? reminderDraftOf(step, next) : draftOf(step, next);
  const t = timingOf(step);
  const when = reminder ? `${spanOf(tab)} later` : t.at === 'start' ? 'Straight away' : shortTiming(t, prev);
  const button = doc ? ACTION[step.kind] : t.at === 'start' ? 'Book a call' : t.at === 'wedding' && t.side === 'after' ? 'Leave a review' : null;
  // Back to the draft drops the MC's own, so the draft keeps following the step's settings.
  const save = (e: StepEmail | undefined) => {
    if (!reminder) return onChange({ ...step, email: e });
    const rest = Object.fromEntries(Object.entries(step.reminderEmails ?? {}).filter(([k]) => k !== tab));
    onChange({ ...step, reminderEmails: e ? { ...rest, [tab]: e } : rest });
  };
  return (
    <Dialog open onClose={onClose} size="xl" aria-labelledby="step-title">
      <div className="flex min-h-0 flex-1">
        <section aria-label="What your client gets" className="relative hidden min-h-0 flex-1 flex-col border-r border-hairline bg-zebra-50 md:flex">
          <div className="flex items-center gap-2 px-10 pt-6 pb-4">
            <TabMenu label="What your client gets" tabs={tabs} labels={labels} value={tab} onChange={setPicked} />
            <span className="flex-1" />
            {/* A run sheet is filled in per client, so a test of the template would be an empty page. */}
            {tab === 'doc' && step.kind === 'runSheet' ? null : (
              <Button variant="ghost" icon={<SentIcon aria-hidden="true" className="size-4" />} onClick={() => setTested(tab)}>
                {/* Both labels share one cell, so the button keeps its width when it changes. */}
                <span className="grid">
                  <span className={`col-start-1 row-start-1 ${tested === tab ? 'invisible' : ''}`}>Send test</span>
                  <span className={`col-start-1 row-start-1 ${tested === tab ? '' : 'invisible'}`}>Sent</span>
                </span>
              </Button>
            )}
            <Button variant="secondary" icon={<EditIcon aria-hidden="true" className="size-4" />} onClick={() => (tab === 'doc' ? onEdit(step) : setDrafting(true))}>
              {tab === 'doc' ? 'Open editor' : 'Edit email'}
            </Button>
          </div>
          {/* A column, so a short page can sit centred (my-auto) while a long one scrolls from its top. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 pb-10">
            <div className="relative my-auto">
              {tab === 'doc' ? (
                <>
                  <StepPreview step={step} />
                  {/* A layer over the page, not a wrapper: a proposal page has buttons of its own, and buttons cannot nest.
                      Pointer only (the page is inert to keys); the keyboard way to the full size is Preview. */}
                  <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setPreviewing(true)} className="absolute inset-0 cursor-zoom-in" />
                </>
              ) : (
                <InboxPreview email={email} when={when} button={button} view={view} onView={setView} />
              )}
            </div>
          </div>
        </section>
        <StepPanel journey={journey} step={step} onChange={onChange} onRemove={() => onRemove(step)} onPick={setPicked} onPreview={() => setPreviewing(true)} onClose={onClose} />
      </div>

      {drafting ? <EmailBuilder purpose={labels[tab] ?? step.name} value={email} draft={draft} button={button} templates={templates} onSave={save} onClose={() => setDrafting(false)} /> : null}
      <Dialog open={previewing} onClose={() => setPreviewing(false)} size="lg" aria-labelledby="step-preview-title">
        <DialogHeader id="step-preview-title" icon={EyeIcon} title={`${step.detail}, as your client sees it`} />
        <DialogBody className="bg-zebra-50">
          {tab === 'doc' ? <StepPreview step={step} fit="full" /> : <InboxPreview email={email} when={when} button={button} view={view} onView={setView} />}
        </DialogBody>
      </Dialog>
    </Dialog>
  );
}

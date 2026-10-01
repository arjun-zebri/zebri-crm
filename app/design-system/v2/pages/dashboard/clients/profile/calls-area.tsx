'use client';

import { CallNotes } from './call-notes';
import type { Call, CallNotes as Notes } from './calls-data';
import { CallsSection } from './calls-section';
import type { Task } from './profile-data';
import type { CallsState } from './use-calls';

/**
 * The Calls section's two views: the list, or one call's notes once it
 * is opened. Also {@link recapTask}, which turns a call's drafted recap
 * into the shape the compose view reviews, so the recap is sent the same
 * way as every other message in the profile.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/calls-area
 */

export interface CallsAreaProps {
  state: CallsState;
  /** The call whose notes are open, or `null` for the list. */
  open: string | null;
  onOpen: (id: string | null) => void;
  onStart: (from?: string) => void;
  onRecap: (task: Task) => void;
  /** Task ids sent this visit, which include sent recaps. */
  sent: ReadonlySet<string>;
  link: string;
}

/** The recap of a call, as a task the compose view can open. */
export function recapTask(call: Call & { notes: Notes }): Task {
  return {
    id: `recap-${call.id}`,
    label: call.title,
    status: '',
    tone: 'warning',
    cta: 'Send recap',
    done: `Sent the recap of the ${call.title.toLowerCase()}`,
    draft: call.notes.followUp,
  };
}

const hasNotes = (c: Call | undefined): c is Call & { notes: Notes } =>
  c !== undefined && c.status === 'ready' && c.notes !== undefined;

/** The Calls section. See {@link CallsAreaProps}. */
export function CallsArea({ state, open, onOpen, onStart, onRecap, sent, link }: CallsAreaProps) {
  const call = state.calls.find((c) => c.id === open);
  if (hasNotes(call)) {
    const recap = recapTask(call);
    return (
      <CallNotes
        key={call.id}
        call={call}
        decisions={state.decisions}
        onDecide={state.decide}
        onFollowUp={() => onRecap(recap)}
        sent={Boolean(call.notes.followUpSent) || sent.has(recap.id)}
        onBack={() => onOpen(null)}
      />
    );
  }
  return (
    <CallsSection
      calls={state.calls}
      decisions={state.decisions}
      checklist={state.checklist}
      onChecklist={state.setChecklist}
      onStart={onStart}
      onOpen={onOpen}
      link={link}
      busy={state.live !== null}
    />
  );
}

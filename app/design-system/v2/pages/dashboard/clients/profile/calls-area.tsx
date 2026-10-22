'use client';

import { CallNotes } from './call-notes';
import type { Call, CallNotes as Notes } from './calls-data';
import { CallsSection } from './calls-section';
import type { CallsState } from './use-calls';

/**
 * The Calls section's two views: the list, or one call's notes once it
 * is opened.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/calls-area
 */

export interface CallsAreaProps {
  state: CallsState;
  /** The call whose notes are open, or `null` for the list. */
  open: string | null;
  onOpen: (id: string | null) => void;
  onStart: (from?: string) => void;
  link: string;
}

const hasNotes = (c: Call | undefined): c is Call & { notes: Notes } =>
  c !== undefined && c.status === 'ready' && c.notes !== undefined;

/** The Calls section. See {@link CallsAreaProps}. */
export function CallsArea({ state, open, onOpen, onStart, link }: CallsAreaProps) {
  const call = state.calls.find((c) => c.id === open);
  if (hasNotes(call)) {
    return (
      <CallNotes
        key={call.id}
        call={call}
        decisions={state.decisions}
        onDecide={state.decide}
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

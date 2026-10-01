'use client';

import { useEffect, useState, type RefObject } from 'react';

import { clientName, type Client } from '../clients-data';
import type { NextMoves } from '../use-next-moves';

import { ActivitySection } from './activity-section';
import { CallsArea } from './calls-area';
import { ComposeView, type Edit } from './compose-view';
import { DocumentsSection } from './documents-section';
import { LiveBar } from './live-bar';
import { LiveCall } from './live-call';
import { OverviewSection } from './overview-section';
import { profileFor, type Task } from './profile-data';
import { ProfileHeader } from './profile-header';
import { ProfileSidebar, ProfileTabs } from './profile-sidebar';
import { SECTIONS, type Section } from './sections';
import { useCalls } from './use-calls';

/**
 * Everything inside the profile dialog for one client: the sidebar (or
 * a row of the same links on phones), the header, and the section on
 * screen, the message being reviewed, or the call in progress. It holds
 * the profile's state for this visit: the section, which tasks have been
 * sent, and the client's calls. Updates applied from a call's notes flow
 * into the Overview through `useCalls`. Draft edits live in the dialog
 * above it, so they outlast a close.
 *
 * A running call keeps going while the MC looks at another section; the
 * live bar brings it back. Escape steps back one level (draft, call,
 * notes) before it closes the profile.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-body
 */

/** What {@link ProfileBody} needs from the dialog around it. */
export interface ProfileBodyProps {
  client: Client;
  moves: NextMoves;
  onClose: () => void;
  backRef: RefObject<(() => void) | null>;
  /** Told whether the live call fills the main area, so the dialog can widen. */
  onCallView: (on: boolean) => void;
  edits: Record<string, Edit>;
  onEdit: (key: string, e: Edit) => void;
  onForget: (key: string) => void;
}

/** The profile's content. See {@link ProfileBodyProps}. */
export function ProfileBody({
  client,
  moves,
  onClose,
  backRef,
  onCallView,
  edits,
  onEdit,
  onForget,
}: ProfileBodyProps) {
  const [base] = useState(() => profileFor(client));
  const calls = useCalls(client, base);
  const { profile, live } = calls;
  const who = clientName(client);
  const link = `zebri.app/meet/${client.id}`;
  const counts = {
    documents: profile.docs.filter((d) => d.status === 'waiting').length,
    calls: calls.pending,
  };
  const first = base.today[0];
  const [section, setSection] = useState<Section>('overview');
  const [composing, setComposing] = useState<Task | null>(null);
  const [onCall, setOnCall] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  // A move already sent from the Clients page starts out done here.
  const [sent, setSent] = useState<ReadonlySet<string>>(
    () => new Set(first && moves.done.has(client.id) ? [first.id] : []),
  );
  const inCall = live !== null && onCall;
  useEffect(() => {
    backRef.current = composing
      ? () => setComposing(null)
      : inCall
        ? () => setOnCall(false)
        : notes
          ? () => setNotes(null)
          : null;
    return () => {
      backRef.current = null;
    };
  }, [backRef, composing, inCall, notes]);
  useEffect(() => {
    onCallView(inCall);
    return () => onCallView(false);
  }, [inCall, onCallView]);
  const editKey = (task: Task) => `${client.id}:${task.id}`;
  const pick = (s: Section) => {
    setComposing(null);
    setOnCall(false);
    setNotes(null);
    setSection(s);
  };
  const start = (from?: string) => {
    calls.start(from);
    setOnCall(true);
  };
  const end = () => {
    calls.end();
    pick('calls');
  };
  // `since` reads "In 15 days" once booked; before that it is about the
  // enquiry ("Quiet 3 days"), which is not a countdown.
  const countdown = client.since.startsWith('In ') ? client.since.toLowerCase() : '';
  const label = inCall ? 'Call' : (SECTIONS.find((s) => s.value === section)?.label ?? '');
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ProfileSidebar section={section} onSection={pick} counts={counts} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-field">
        <ProfileHeader name={who} stage={client.stage} event={profile.event} onClose={onClose} />
        <ProfileTabs section={section} onSection={pick} counts={counts} />
        {live && !onCall ? <LiveBar who={who} startedAt={live.startedAt} onReturn={() => setOnCall(true)} /> : null}
        <div aria-label={label} className="flex min-h-0 flex-1 flex-col">
          {composing ? (
            <ComposeView
              key={composing.id}
              step={composing}
              people={profile.people}
              saved={edits[editKey(composing)]}
              onEdit={(e) => onEdit(editKey(composing), e)}
              onBack={() => setComposing(null)}
              onSent={(t) => {
                onForget(editKey(t));
                setComposing(null);
                setSent((s) => new Set(s).add(t.id));
                // The first task is the same move as the button on the client's row.
                if (t === first && client.move) moves.complete(client.id);
              }}
            />
          ) : live && onCall ? (
            <LiveCall
              live={live}
              who={who}
              initials={client.names[1] ? `${client.names[0][0]}&${client.names[1][0]}` : client.names[0].slice(0, 2)}
              link={link}
              checklist={calls.checklist}
              onTick={calls.tick}
              onJot={calls.jot}
              onEnd={end}
            />
          ) : section === 'overview' ? (
            <OverviewSection
              profile={profile}
              tasks={profile.today.filter((t) => !sent.has(t.id))}
              countdown={countdown}
              onTask={setComposing}
            />
          ) : section === 'activity' ? (
            <ActivitySection key="activity" profile={profile} />
          ) : section === 'documents' ? (
            <DocumentsSection key="documents" profile={profile} />
          ) : (
            <CallsArea
              state={calls}
              open={notes}
              onOpen={setNotes}
              onStart={start}
              onRecap={setComposing}
              sent={sent}
              link={link}
            />
          )}
        </div>
      </div>
    </div>
  );
}

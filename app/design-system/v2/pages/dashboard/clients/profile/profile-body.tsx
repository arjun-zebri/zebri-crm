'use client';

import { useEffect, useState, type RefObject } from 'react';

import { useAccount } from '../../account';
import { useRunSheet } from '../../home/run-sheet-store';
import type { Client } from '../clients-data';
import type { NextMoves } from '../use-next-moves';

import { ActivitySection } from './activity-section';
import { CallsArea } from './calls-area';
import { ComposeView, type Edit } from './compose-view';
import { useDocCount } from './doc-count';
import { DocumentsSection } from './documents-section';
import { LiveBar } from './live-bar';
import { LiveCall } from './live-call';
import { OverviewSection } from './overview-section';
import { ProfileChat, suggestionsFor } from './profile-chat';
import { profileFor, type Fact, type Task } from './profile-data';
import { ProfileBar } from './profile-header';
import { ProfileSidebar, ProfileTabs } from './profile-sidebar';
import { withSheet } from './run-sheet-doc';
import { SECTIONS, type Section } from './sections';
import { useCalls } from './use-calls';
import { useClientNames } from './use-client-names';

/**
 * Everything inside the profile dialog for one client: the sidebar (or
 * a row of the same links on phones), the header, and the section on
 * screen, the message being reviewed, or the call in progress. It holds
 * the profile's state for this visit: the section and the client's calls. Updates applied from a call's notes flow
 * into the Overview through `useCalls`. Draft edits live in the dialog
 * above it, so they outlast a close.
 *
 * A running call keeps going while the MC looks at another section; the
 * live bar brings it back. Escape steps back one level (draft, call,
 * notes) before it closes the profile.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-body
 */

/** Where a profile opens when it is not Overview: a document, and whether Zebri introduces it. */
export interface ProfileStart {
  doc: string;
  intro: boolean;
}

/** What {@link ProfileBody} needs from the dialog around it. */
export interface ProfileBodyProps {
  client: Client;
  /** Open on Documents with this document picked, instead of Overview. */
  opening?: ProfileStart | undefined;
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
  opening,
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
  const { live } = calls;
  // Renamed from the Overview's contacts, so everything below goes by the names as they are now.
  const named = useClientNames(client);
  const { who, names } = named;
  const { contacts, others } = named.people(calls.profile.people);
  const profile = { ...calls.profile, people: [...contacts, ...others] };
  const { clients, setStage } = useAccount();
  // The account's own record, so a stage changed here shows checked at once.
  const stage = clients.find((c) => c.id === client.id)?.stage ?? client.stage;
  const link = `zebri.app/meet/${client.id}`;
  // The Overview's edits, held here so they outlast a switch of section;
  // the preview has nowhere to save them past the visit.
  // Only the MC's own edits, laid over the profile's details, so an update
  // applied from a call's notes still shows on the Overview.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const facts: Fact[] = profile.facts.map((f) =>
    f.label in typed ? { label: f.label, value: typed[f.label] ?? '' } : f,
  );
  const [clientNotes, setClientNotes] = useState(base.notes);
  const sheet = useRunSheet(who);
  // How many of each, beside its link (2026-10-09 founder mockup).
  const documents = useDocCount(
    profile.docs.map((d) => (d.runSheet ? withSheet(d, sheet, who) : d)),
    who,
  );
  const counts = {
    documents,
    calls: calls.calls.filter((c) => c.status !== 'upcoming').length,
    activity: profile.activity.reduce((n, g) => n + g.items.length, 0),
  };
  const first = base.today[0];
  const [section, setSection] = useState<Section>(opening ? 'documents' : 'overview');
  const [composing, setComposing] = useState<Task | null>(null);
  const [onCall, setOnCall] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
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
  // The header's slot beside More, where Documents puts Upload and New document.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const label = inCall ? 'Call' : (SECTIONS.find((s) => s.value === section)?.label ?? '');
  return (
    // Settings' layout: the bar across the top, the rail and the main column under it.
    <div className="flex min-h-0 flex-1 flex-col">
      <ProfileBar
        name={who}
        slotRef={setSlot}
        wideCorner={section === 'documents' && !composing && !inCall}
        onClose={onClose}
        stage={stage}
        onStage={setStage ? (s) => setStage(client.id, s) : undefined}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ProfileSidebar section={section} onSection={pick} counts={counts} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-field">
          <ProfileTabs section={section} onSection={pick} counts={counts} />
          {live && !onCall ? (
            <LiveBar who={who} startedAt={live.startedAt} onReturn={() => setOnCall(true)} />
          ) : null}
          <div aria-label={label} className="relative flex min-h-0 flex-1 flex-col">
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
                  // The first task is the same move as the button on the client's row.
                  if (t === first && client.move) moves.complete(client.id);
                }}
              />
            ) : live && onCall ? (
              <LiveCall
                live={live}
                who={who}
                initials={
                  names[1] ? `${names[0][0]}&${names[1][0]}` : names[0].slice(0, 2)
                }
                link={link}
                checklist={calls.checklist}
                onTick={calls.tick}
                onJot={calls.jot}
                onEnd={end}
              />
            ) : section === 'overview' ? (
              <OverviewSection
                client={client}
                who={who}
                names={named.typed}
                onNames={named.change}
                others={others}
                facts={facts}
                onFact={(label, value) => setTyped((all) => ({ ...all, [label]: value }))}
                notes={clientNotes}
                onNotes={setClientNotes}
              />
            ) : section === 'activity' ? (
              <ActivitySection key="activity" profile={profile} />
            ) : section === 'documents' ? (
              <DocumentsSection
                key="documents"
                profile={profile}
                client={who}
                initialDoc={opening?.doc}
                intro={opening?.intro}
                slot={slot}
              />
            ) : (
              <CallsArea state={calls} open={notes} onOpen={setNotes} onStart={start} link={link} />
            )}
            {/* On every section, but not over a draft or a live call. 22px in, a footer button's spot (DIALOG_FOOTER_PAD), under the X. */}
            {composing || inCall ? null : (
              <div className="absolute bottom-5.5 right-5.5">
                <ProfileChat
                  who={who}
                  suggestions={suggestionsFor({ ...profile, facts }, calls.calls)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

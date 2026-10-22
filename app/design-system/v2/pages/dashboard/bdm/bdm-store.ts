'use client';

import { useSyncExternalStore } from 'react';

import type { Notification } from '../demo-activity';
import { shortDate } from '../payments/dates';
import { answerText, type Answer } from '../questionnaires/questionnaire-data';

import { BLANK_CELEBRANT, DEMO_CELEBRANT, isoOf, married, today, weddingDate, todayIso, type Celebrant, type CertificateOrder, type Paperwork } from './bdm-data';
import { demoAnswers, SEEDS } from './bdm-seeds';
import { beforeGroups } from './checks';
import { nameParts, prefill } from './noim-questions';

/**
 * The Lodge with BDM block's state for the preview: whether the block is
 * added, the celebrant's details, every couple's paperwork, and what the
 * Registry has said (as notifications). One store, so the client's
 * Documents, the Documents page, Home and the bell all agree. Lodging
 * succeeds, and the Registry registers it a few seconds later on its own; nothing leaves the
 * browser and nothing persists past a reload.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/bdm-store
 */

interface State {
  on: boolean;
  celebrant: Celebrant;
  papers: Paperwork[];
  notices: Notification[];
}

let state: State = { on: false, celebrant: DEMO_CELEBRANT, papers: SEEDS, notices: [] };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const useStore = <T,>(pick: (s: State) => T) =>
  useSyncExternalStore(
    subscribe,
    () => pick(state),
    () => pick(state),
  );

/** Whether the block is added. The dashboard sets it from Blocks. */
export const useBdmOn = () => useStore((s) => s.on);
export const setBdmOn = (on: boolean) => {
  if (on !== state.on) set({ on });
};

export const useCelebrant = () => useStore((s) => s.celebrant);
export const patchCelebrant = (patch: Partial<Celebrant>) => set({ celebrant: { ...state.celebrant, ...patch } });

/** Every couple's paperwork, newest wedding last. */
export const useAllPaperwork = () => useStore((s) => s.papers);
/** One couple's paperwork, or undefined before it is started. */
export const usePaperwork = (client: string) => useStore((s) => s.papers.find((p) => p.client === client));
/** The Registry's notices, newest first, for the bell. */
export const useBdmNotices = () => useStore((s) => s.notices);

const patch = (client: string, change: Partial<Paperwork> | ((p: Paperwork) => Partial<Paperwork>)) =>
  set({ papers: state.papers.map((p) => (p.client === client ? { ...p, ...(typeof change === 'function' ? change(p) : change) } : p)) });

const notify = (who: string, what: string, detail: string) =>
  set({ notices: [{ id: `bdm-${state.notices.length}`, kind: 'registry', who, what, detail, ago: 'now', today: true, unread: true }, ...state.notices] });

/**
 * Starts the block over for a new account: no paperwork and no Registry
 * notices (the seeds are the demo business's couples, who are not this
 * account's clients), and a blank celebrant under the account's own name:
 * none of the demo celebrant's email, username or appointment, which
 * would otherwise go to BDM as this celebrant's. Idempotent, so a
 * remount or Strict Mode's second call is harmless.
 */
export function startFresh(name: string) {
  const [givenName = '', ...rest] = name.trim().split(/\s+/);
  set({ papers: [], notices: [], celebrant: { ...BLANK_CELEBRANT, givenName, familyName: rest.join(' ') } });
}

/** Starts a couple's paperwork, their names and email already in. Returns nothing if it exists. */
export function startPaperwork(client: string, names: [string, string], date: string, venue: string, email = '') {
  if (state.papers.some((p) => p.client === client)) return;
  set({ papers: [...state.papers, { client, names, date, venue, email, stage: 'draft', answers: prefill(names), checks: {}, certificate: 'none' }] });
}

/**
 * The client was renamed on their profile: their paperwork follows them
 * (it is kept by name), with the new names on it. A partner's name
 * answers change only while they still read what Zebri filled in, so
 * nothing the couple typed themselves is overwritten.
 */
export function renamePaperwork(from: string, to: string, names: [string, string]) {
  const p = state.papers.find((x) => x.client === from);
  if (!p || (from === to && p.names.join('|') === names.join('|'))) return;
  const answers = { ...p.answers };
  (['p1', 'p2'] as const).forEach((who, i) => {
    const before = nameParts(who, p.names[i] ?? '');
    const ours = (['givenName', 'familyName', 'otherNames'] as const).every(
      (f) => answerText(answers[`${who}.${f}`]).trim() === answerText(before[`${who}.${f}`]).trim(),
    );
    if (!ours) return;
    (['givenName', 'familyName', 'otherNames'] as const).forEach((f) => delete answers[`${who}.${f}`]);
    Object.assign(answers, nameParts(who, names[i] ?? ''));
  });
  patch(from, { client: to, names, answers });
}

/** Sent to the couple, at the address the celebrant confirmed in the send dialog. */
export const sendToCouple = (client: string, email: string) => patch(client, { stage: 'sent', sentOn: today(), email });
export const remind = (client: string) => patch(client, { remindedOn: today() });

export const setAnswer = (client: string, id: string, a: Answer) => patch(client, (p) => ({ answers: { ...p.answers, [id]: a } }));
export const setCheck = (client: string, id: string, a: Answer) => patch(client, (p) => ({ checks: { ...p.checks, [id]: a } }));

/** Applies a rule fix (`rules.ts`): the corrected answers and checks, at once. */
export const applyFix = (client: string, fix: { answers?: Record<string, Answer>; checks?: Record<string, Answer> }) =>
  patch(client, (p) => ({ answers: { ...p.answers, ...fix.answers }, checks: { ...p.checks, ...fix.checks } }));

/** The couple sent their details back. */
export function submitForm(client: string) {
  // The day it comes back is the notice's received date, so the celebrant never types it.
  patch(client, (p) => ({ stage: 'returned', returnedOn: todayIso(), checks: { received: todayIso(), ...p.checks } }));
  notify(client, 'sent their marriage details', 'Ready for you to check');
}

/**
 * Demo only: the couple fill in every answer still blank (what is in
 * stays), photograph their IDs and send it back, as if a few days had
 * passed (user, 2026-10-15: one press, from the paperwork, to see what
 * comes back). Works before it is sent too, so a draft can be tried
 * without a send.
 */
export function simulateReturn(client: string) {
  patch(client, (p) => {
    const blank = Object.entries(demoAnswers(p.names)).filter(([id]) => answerText(p.answers[id]).trim() === '');
    return { answers: { ...p.answers, ...Object.fromEntries(blank), 'p1.idPhoto': 'read', 'p2.idPhoto': 'read' }, sentOn: p.sentOn ?? today() };
  });
  submitForm(client);
}

/**
 * Sets the wedding's day on the paperwork, as the demo writes it ("Sat 6
 * Mar 2027"), for a client booked without one: lodging opens only once
 * the day has been, so with no date it never would (user, 2026-10-15:
 * "why is this stuck on this?").
 */
export function setWeddingDate(client: string, iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
  patch(client, { date: `${shortDate(iso)} ${iso.slice(0, 4)}` });
}

/** What a meeting's blank text checks are filled with: a real NSW venue, and plain reasons. */
const MEETING: Record<string, string> = {
  venueLine1: '1 North Head Scenic Drive',
  venueSuburb: 'Manly',
  venuePostcode: '2095',
  statDecReason: 'No birth certificate or passport',
  statDecPlace: 'Sydney',
  shorteningReason: 'Family travelling from overseas',
  shorteningPlace: 'Sydney Local Court',
};

/**
 * Demo only: the meeting where the notice is signed has happened. Every
 * Before the day tick is ticked, and any blank detail (the venue's
 * address, a stat dec's reason) filled in; what the celebrant typed
 * stays (user, 2026-10-16: one press a step, as their answers and the
 * wedding have).
 */
export function simulateMeeting(client: string) {
  const p = state.papers.find((x) => x.client === client);
  if (!p) return;
  const checks: Record<string, Answer> = {};
  beforeGroups(p)
    .flatMap((g) => g.checks)
    .forEach((c) => {
      const filler = MEETING[c.id];
      if (c.kind === 'tick') checks[c.id] = 'Yes';
      else if (c.kind === 'text' && !answerText(p.checks[c.id]).trim() && filler) checks[c.id] = filler;
      else if (c.kind === 'date' && !answerText(p.checks[c.id]).trim()) checks[c.id] = todayIso();
    });
  applyFix(client, { checks });
}

/**
 * Demo only: the wedding has been. Its day becomes yesterday, unless it
 * is already past, and the certificate of marriage is signed and filled
 * in, so Lodge with BDM can be tried at once (user, 2026-10-15). The
 * notice's received date moves back with the day when it would be late.
 */
export function simulateWedding(client: string) {
  const p = state.papers.find((x) => x.client === client);
  if (!p) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (!married(p)) setWeddingDate(client, isoOf(yesterday));
  // The notice has to have reached the celebrant a month before the day; moving the day back would leave it late, so it moves too.
  const day = weddingDate(state.papers.find((x) => x.client === client) ?? p) ?? yesterday;
  const latest = new Date(day);
  latest.setMonth(latest.getMonth() - 1);
  const received = answerText(p.checks.received);
  const noticed = received && received <= isoOf(latest) ? received : isoOf(new Date(day.getTime() - 35 * 86_400_000));
  applyFix(client, {
    checks: {
      received: noticed,
      'p1.signedCertificate': 'Yes',
      'p2.signedCertificate': 'Yes',
      witness1Signed: 'Yes',
      witness2Signed: 'Yes',
      celebrantSignedCertificate: 'Yes',
      certNumber: p.checks.certNumber || '1452639',
      witness1Family: p.checks.witness1Family || 'Nguyen',
      witness1Given: p.checks.witness1Given || 'Mai',
      witness2Family: p.checks.witness2Family || 'Brooks',
      witness2Given: p.checks.witness2Given || 'Oliver James',
    },
  });
}

/** The notice is in order; it waits for the wedding. */
export const markChecked = (client: string) => patch(client, { stage: 'checked' });

/** Why the Registry turned a lodgement away. Nothing is lodged when it does. */
export type LodgeError = 'login' | 'duplicate' | 'invalid' | 'down';

/** The Registry's answer: turned away (with its error detail, when it gives one), or taken with a status. */
export type RegistryReply = { error: LodgeError; detail?: string | undefined } | { status: 'Compliant' | 'Non Compliant' };

/**
 * What the Registry says to a lodgement, in the demo. A password under
 * eight characters is a wrong login; one containing "duplicate",
 * "invalid" or "offline" plays that answer, and "noncompliant" is taken
 * but held for BDM's staff, so every answer can be seen. Anything else
 * is taken as Compliant.
 */
export function registryAnswer(password: string): RegistryReply {
  if (password.length < 8) return { error: 'login' };
  if (password.includes('duplicate')) return { error: 'duplicate' };
  if (password.includes('invalid')) return { error: 'invalid', detail: 'Invalid Request Data: PlaceOfMarriage Postcode is not valid' };
  if (password.includes('offline')) return { error: 'down' };
  return { status: password.includes('noncompliant') ? 'Non Compliant' : 'Compliant' };
}

/** A notification number as LifeLink writes it: "4632/2026". */
const notificationId = (offset: number) => `${4632 + state.papers.filter((p) => p.notification).length * 2 + offset}/${new Date().getFullYear()}`;

/** Lodged with the Registry, after the wedding. The password is used once and dropped by the caller. */
export function lodge(client: string, status: 'Compliant' | 'Non Compliant', order: CertificateOrder | undefined) {
  const notification = notificationId(0);
  patch(client, {
    stage: 'lodged',
    lodgedOn: today(),
    notification,
    registry: status,
    certificate: order ? 'ordered' : 'none',
    order,
    // The application is its own notification, tracked apart from the notice.
    application: order ? notificationId(1) : undefined,
  });
  notify(client, 'lodged with NSW BDM', status === 'Compliant' ? `Notification ${notification}` : `Notification ${notification} · BDM will check it`);
  follow(client);
}

/**
 * Asks the Registry where a lodged notice is now (statusQuery, on
 * demand, beside the automatic polling). In the demo a Non Compliant
 * notice is one BDM's staff have since cleared: it comes back Compliant
 * and moves on to registered, as a real one does once BDM has what it
 * needed from the celebrant.
 */
export function checkStatus(client: string) {
  const p = state.papers.find((x) => x.client === client);
  if (p?.stage !== 'lodged' || p.registry !== 'Non Compliant') return;
  patch(client, { registry: 'Compliant' });
  notify(client, 'notice was cleared by BDM', `Notification ${p.notification ?? ''} · registering now`);
  follow(client);
}

/** How long the demo Registry takes to register a lodged marriage, then post its certificate. */
const REGISTRY_MS = 4000;

/**
 * The Registry moving on by itself (statusQuery, polled): Complete a
 * moment after lodging, then the certificate application Complete
 * (printed and posted), each with a notification. A Non Compliant notice
 * waits for BDM's staff, so it does not move on here. statusQuery gives
 * no registration number; that comes in BDM's email.
 */
function follow(client: string) {
  window.setTimeout(() => {
    const p = state.papers.find((x) => x.client === client);
    if (p?.stage !== 'lodged' || p.registry !== 'Compliant') return;
    patch(client, { stage: 'registered', registry: 'Complete' });
    notify(client, 'marriage is registered', state.celebrant.email ? `BDM emails the registration number to ${state.celebrant.email}` : 'BDM emails you the registration number');
    if (p.certificate !== 'ordered') return;
    window.setTimeout(() => {
      patch(client, { certificate: 'posted' });
      notify(client, 'certificate is in the post', p.order?.delivery ?? 'Posted');
    }, REGISTRY_MS);
  }, REGISTRY_MS);
}

'use client';

import { useSyncExternalStore } from 'react';

import { asked, filled, newId, today, type Answer, type Sent, type Template } from './questionnaire-data';

/**
 * The MC's questionnaires and the ones sent to clients, saved for this
 * visit. One store, so Documents, a client's Documents, the script's
 * details and journeys all read the same answers. Starts empty: every
 * questionnaire is the MC's own. Nothing persists past a reload: this is
 * the review mock.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/questionnaire-store
 */

let templates: Template[] = [];
let sent: Sent[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The MC's questionnaires, newest edit first. */
export function useTemplates(): Template[] {
  return useSyncExternalStore(subscribe, () => templates, () => templates);
}

/** Every sent questionnaire, newest first. Filter by client where needed. */
export function useSent(): Sent[] {
  return useSyncExternalStore(subscribe, () => sent, () => sent);
}

/** A client's sent questionnaires, outside React (for the script's details). */
export const sentFor = (client: string) => sent.filter((s) => s.client === client);

/** Saves a questionnaire, new or edited, to the top of the list. */
export function saveTemplate(t: Template) {
  templates = [{ ...t, edited: today() }, ...templates.filter((x) => x.id !== t.id)];
  notify();
}

/** Deletes a questionnaire. Copies already sent keep working. */
export function deleteTemplate(id: string) {
  templates = templates.filter((t) => t.id !== id);
  notify();
}

/** Sends a copy of a questionnaire to a client and returns it. */
export function sendQuestionnaire(templateId: string, client: string): Sent | null {
  const t = templates.find((x) => x.id === templateId);
  if (!t) return null;
  const s: Sent = {
    id: newId('qs'),
    client,
    templateId,
    copy: structuredClone(t),
    sentOn: today(),
    answers: {},
    status: 'sent',
  };
  sent = [s, ...sent];
  notify();
  return s;
}

function patch(id: string, fn: (s: Sent) => Sent) {
  sent = sent.map((s) => (s.id === id ? fn(s) : s));
  notify();
}

/** The MC types an answer in (from a call, say). The first one starts it. */
export function setAnswer(id: string, question: string, answer: Answer) {
  patch(id, (s) => {
    const answers = { ...s.answers, [question]: answer };
    const any = asked(s.copy).some((q) => filled(answers[q.id]));
    // Answering never completes it on its own: only Submit or Mark complete does.
    return { ...s, answers, status: s.status === 'completed' ? 'completed' : any ? 'started' : 'sent' };
  });
}

/** Marks it done, as the client's Submit will. */
export const markComplete = (id: string) => patch(id, (s) => ({ ...s, status: 'completed', completedOn: today() }));

/** Opens it again for more answers. */
export const reopen = (id: string) =>
  patch(id, (s) => ({ ...s, status: Object.keys(s.answers).length ? 'started' : 'sent', completedOn: undefined }));

/** Records a reminder sent today. */
export const remind = (id: string) => patch(id, (s) => ({ ...s, remindedOn: today() }));

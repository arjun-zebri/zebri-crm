'use client';

import { useSyncExternalStore } from 'react';

import type { StepEmail } from '../journeys/step-settings';
import { newId, today } from '../questionnaires/questionnaire-data';

/**
 * The MC's email templates, saved for this visit: the emails they send
 * by hand or from a journey (an enquiry reply, a booking confirmation,
 * a thank you), each written in the email itself and wearing the email
 * design they style once for every email. Email is a kind of document,
 * on every account, not a block of its own (2026-10-20 founder: email
 * templates come from Documents and can be styled, "and thats it").
 * Starts with Zebri's drafts for the everyday ones. Nothing persists
 * past a reload: this is the review mock.
 *
 * @module app/design-system/v2/pages/dashboard/documents/email-templates
 */

/** One email template. */
export interface EmailTemplate {
  id: string;
  name: string;
  email: StepEmail;
  /** What it asks them to do, as its closing button; none when null. */
  button: string | null;
  edited: string;
}

const hi = 'Hi {first names},\n\n';

/** Zebri's drafts, so the MC starts with the emails every booking sends. */
const SEEDS: EmailTemplate[] = [
  { id: 'enquiry-reply', name: 'Enquiry reply', button: 'Book a call', edited: '2 Sep', email: { subject: 'Your wedding at {venue}', body: `${hi}Thank you for getting in touch, and congratulations! {venue} is a beautiful spot and I would love to be part of your day.\n\nThe quickest next step is a 20 minute call, so I can hear about your plans.` } },
  { id: 'no-reply', name: 'Follow up, no reply', button: 'Hold my date', edited: '11 Aug', email: { subject: 'Still looking for an MC?', body: `${hi}I know wedding planning gets busy. I still have {wedding date} free, and I am happy to hold it for a few days while you decide.` } },
  { id: 'booking-confirmed', name: 'Booking confirmed', button: null, edited: '14 Sep', email: { subject: 'You are booked, {first names}!', body: `${hi}Your deposit is in and {wedding date} is yours. Next, tell me about the two of you so I can start writing.\n\nI will be in touch about three months out to plan the run sheet together.` } },
  { id: 'final-week', name: 'Final week check in', button: 'Confirm the details', edited: '8 May', email: { subject: 'One week to go!', body: `${hi}One week to go! I will arrive at {venue} an hour before guests. Is the guest count still {guest count}?` } },
  { id: 'thank-you', name: 'Thank you and review', button: 'Leave a review', edited: '3 Jul', email: { subject: 'Thank you, {first names}', body: `${hi}What a night. Thank you for trusting me with it. If you have two minutes, a review helps other couples find me.` } },
];

let templates: EmailTemplate[] = SEEDS;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The MC's email templates, newest edit first. */
export function useEmailTemplates(): EmailTemplate[] {
  return useSyncExternalStore(subscribe, () => templates, () => templates);
}

/** A blank template, not saved until the MC saves it. */
export const blankEmail = (): EmailTemplate => ({ id: newId('em'), name: '', button: null, edited: today(), email: { subject: '', body: '' } });

/** Saves a template, new or edited, to the top of the list. A nameless one is named by its subject. */
export function saveEmailTemplate(t: EmailTemplate) {
  const name = t.name || t.email.subject.replace(/\{([^}]+)\}/g, '$1').trim() || 'Untitled email';
  templates = [{ ...t, name, edited: today() }, ...templates.filter((x) => x.id !== t.id)];
  notify();
}

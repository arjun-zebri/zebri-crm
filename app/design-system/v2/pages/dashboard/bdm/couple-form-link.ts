'use client';

import { useEffect } from 'react';

import type { Brand } from '../../onboarding/use-onboarding-state';
import { UNNAMED } from '../first-run/use-new-account';
import type { Answer } from '../questionnaires/questionnaire-data';

import type { Paperwork } from './bdm-data';
import { setAnswer, submitForm } from './bdm-store';

/**
 * "See what they see" opens the couple's form on a page of its own, in a
 * new tab (user, 2026-10-15), the way the couple will meet it from their
 * link: `/design-system/v2/couple-form/<client>`. The preview's stores
 * live in the tab's memory, so the paperwork, the business and its brand
 * are handed over through `localStorage`; what the celebrant types on the
 * couple's page comes back the same way, and {@link useCoupleFormReturns}
 * applies it here, so the paperwork dialog keeps up.
 *
 * Demo only: the live app serves the couple's form from the database,
 * behind their link's token. Every read and write is guarded, so blocked
 * storage leaves the page saying the form could not be opened.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-link
 */

const KEY = 'zebri-v2-couple-form';
const BACK = 'zebri-v2-couple-form-back';

/** What the couple's page needs to draw the form as the business sends it. */
export interface CoupleFormHandoff {
  paper: Paperwork;
  /** Who it is from, as the couple knows them; empty when there is no real name yet. */
  from: string;
  brand: Brand | null;
  /** Their email, for the couple's "Questions? Email Sophie". */
  email?: string | undefined;
}

/**
 * Who the couple's form is from: the celebrant's own name from Settings >
 * Lodge with BDM, else the business; never the new account's placeholder
 * "You", which as a letterhead read as broken (user, 2026-10-15).
 */
export function senderOf(celebrant: { givenName: string; familyName: string }, business: string): string {
  const name = [celebrant.givenName, celebrant.familyName].map((n) => n.trim()).filter(Boolean).join(' ');
  return name || (business.trim() === UNNAMED ? '' : business.trim());
}

/** What the couple's page sends back: an answer, or their Submit. */
export type CoupleFormReturn =
  | { client: string; kind: 'answer'; id: string; answer: Answer; at: number }
  | { client: string; kind: 'submit'; at: number };

/** The couple's page's address for a client. */
export const coupleFormPath = (client: string) => `/design-system/v2/couple-form/${encodeURIComponent(client)}`;

/** Hands the form over and opens it in a new tab. */
export function openCoupleForm(handoff: CoupleFormHandoff) {
  try {
    localStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // Blocked storage: the page opens and says it could not load the form.
  }
  window.open(coupleFormPath(handoff.paper.client), '_blank', 'noopener');
}

/** The form handed over for this client, or null. */
export function readCoupleForm(client: string): CoupleFormHandoff | null {
  try {
    const raw = localStorage.getItem(KEY);
    const handoff = raw ? (JSON.parse(raw) as CoupleFormHandoff) : null;
    return handoff?.paper.client === client ? handoff : null;
  } catch {
    return null;
  }
}

/** Sends one change back to the tab the form was opened from. */
export function sendBack(change: CoupleFormReturn) {
  try {
    localStorage.setItem(BACK, JSON.stringify(change));
  } catch {
    // Nothing to sync to without storage; the couple's page still works on its own.
  }
}

/**
 * Applies what the couple's page sends back to this tab's store. The
 * `storage` event fires only in other tabs, so the page's own writes
 * never loop back to it.
 */
export function useCoupleFormReturns() {
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== BACK || !e.newValue) return;
      try {
        const change = JSON.parse(e.newValue) as CoupleFormReturn;
        if (change.kind === 'answer') setAnswer(change.client, change.id, change.answer);
        else submitForm(change.client);
      } catch {
        // A garbled write is ignored.
      }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
}

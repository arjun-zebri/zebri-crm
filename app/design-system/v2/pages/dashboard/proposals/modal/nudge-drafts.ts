import { shortDate } from '../../payments/dates';
import { personOf } from '../../payments/payments-data';
import type { Proposal } from '../proposals-data';
import { DEPOSIT } from '../templates-data';

/**
 * What Zebri writes for a nudge, and who it goes to. Three tones:
 * Friendly (a check-in), Helpful (answers the questions couples usually
 * sit on: payment plans, what is included, a quick call) and Last call
 * (the date it expires, and that the day may not stay free). Drafts
 * never mention what the couple read or how often: the MC sees that,
 * the couple should not feel watched. Email gets a subject; both carry
 * the proposal link, SMS in a shorter message.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/modal/nudge-drafts
 */

export const TONES = ['Friendly', 'Helpful', 'Last call'] as const;
export type Tone = (typeof TONES)[number];
export const CHANNELS = ['Email', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Each partner with their (made-up) email and mobile, shown in their chip. */
export function recipients(p: Proposal) {
  return p.names.filter(Boolean).map((first) => {
    const { email } = personOf(first);
    // A made-up mobile that stays the same for a name.
    const code = [...first].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 1_000_000;
    const mobile = `0412 ${String(code).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2')}`;
    return { first, email, mobile };
  });
}

const join = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? 'there'));

/** Zebri's draft for a proposal, tone and channel. */
export function draftFor(p: Proposal, tone: Tone, via: Channel, to: string[]) {
  const hi = `Hi ${join(to)},`;
  const day = `${shortDate(p.event)} at ${p.venue}`;
  const expires = p.expiresOn ? shortDate(p.expiresOn) : null;
  const body =
    tone === 'Friendly'
      ? `Just checking in on the proposal I sent for your wedding on ${day}. If anything's unclear or you'd like it tweaked, I'm happy to jump on a quick call.`
      : tone === 'Helpful'
        ? `A few things couples usually ask at this point: a ${DEPOSIT}% deposit holds your date, the rest can be split into payments, and every package can be tailored. If a 10 minute call would help, just reply with a time.`
        : `Your proposal for ${day} is open until ${expires ?? 'the end of the week'}. After that I can't promise the date will still be free, so let me know either way.`;
  return via === 'Email'
    ? {
        subject: tone === 'Last call' ? `Your date is held until ${expires ?? 'Friday'}` : tone === 'Helpful' ? 'A few quick answers about your proposal' : 'Checking in on your proposal',
        body: `${hi}\n\n${body}\n\nYour proposal: zebri.app/p/${p.id}\n\nThanks,\nArjun`,
      }
    : { subject: '', body: `${hi} ${body} zebri.app/p · Arjun` };
}

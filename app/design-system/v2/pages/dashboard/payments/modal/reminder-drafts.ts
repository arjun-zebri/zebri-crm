import { TODAY, addDays, shortDate } from '../dates';
import { money, personOf, type Contract, type Invoice } from '../payments-data';

/**
 * What Zebri writes for a reminder, and who it goes to. Three tones:
 * Friendly (a nudge), Firm (a clear date to pay by) and Final notice
 * (what happens if it is not paid). Email gets a subject; both carry
 * the pay or sign link in the text, SMS in a shorter message. Every draft names the amount, the package and the date, so
 * the couple needs nothing else to act. Demo contact details are made up
 * from the names.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/reminder-drafts
 */

export const TONES = ['Friendly', 'Firm', 'Final notice'] as const;
export type Tone = (typeof TONES)[number];
export const CHANNELS = ['Email', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];

/** When Zebri next follows up an unpaid invoice: five days on from today or the due date. */
export const followUpOn = (i: Invoice) => addDays(i.dueOn > TODAY ? i.dueOn : TODAY, 5);


/** Each partner with the note shown in their chip: who opened it last, else their email. */
export function recipients(doc: Invoice | Contract) {
  const opened = 'openedBy' in doc ? doc.openedBy : undefined;
  return doc.names.filter(Boolean).map((first) => {
    const { email } = personOf(first);
    // A made-up mobile that stays the same for a name.
    const code = [...first].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 1_000_000;
    const mobile = `0412 ${String(code).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2')}`;
    return { first, email, mobile, hint: first === opened ? 'opened last time' : email };
  });
}

const join = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? 'there'));

/** Zebri's draft for a document, tone and channel. */
export function draftFor(doc: Invoice | Contract, tone: Tone, via: Channel, to: string[]) {
  const hi = `Hi ${join(to)},`;
  if (!('number' in doc)) {
    const body =
      tone === 'Friendly'
        ? `Just a friendly nudge that your ${doc.title} is ready to sign. It takes two minutes and locks in your date.`
        : tone === 'Firm'
          ? `Your ${doc.title} still needs your signature. Please sign it by ${shortDate(addDays(TODAY, 7))} so your date stays held.`
          : `This is a final reminder to sign your ${doc.title}. If it isn't signed by ${shortDate(addDays(TODAY, 7))}, I'll need to release your date.`;
    return via === 'Email'
      ? { subject: `Your ${doc.title} is ready to sign`, body: `${hi}\n\n${body}\n\nSign here: zebri.app/sign/${doc.id}\n\nThanks,\nArjun` }
      : { subject: '', body: `${hi} ${body} Sign here: zebri.app/sign · Arjun` };
  }
  const what = `the ${money(doc.amount)} ${doc.label.toLowerCase()} for your ${doc.item.replace(/ package$/, '')} package`;
  const when = shortDate(doc.dueOn).split(' ').slice(1).join(' ');
  const late = doc.group === 'overdue';
  const by = shortDate(addDays(TODAY, 7));
  const body =
    tone === 'Friendly'
      ? `Just a friendly nudge that ${what} ${late ? 'was' : 'is'} due on ${when}.${doc.label === 'Deposit' ? ' It secures your date, so it\'d be great to get it sorted this week.' : ''}`
      : tone === 'Firm'
        ? `${what[0]!.toUpperCase()}${what.slice(1)} ${late ? `was due on ${when} and is still unpaid` : `is due on ${when}`}. Please pay it by ${by}.`
        : `This is a final notice: ${what} is now ${doc.late} days overdue. If it isn't paid by ${by}, I won't be able to hold your date.`;
  return via === 'Email'
    ? {
        subject: tone === 'Final notice' ? `Final notice: your ${doc.label.toLowerCase()}` : `Quick reminder: your ${doc.label.toLowerCase()}`,
        body: `${hi}\n\n${body}\n\nYou can pay in a minute here: zebri.app/pay/${doc.number}\n\nThanks,\nArjun`,
      }
    : { subject: '', body: `${hi} ${body} Pay here: zebri.app/pay · Arjun` };
}

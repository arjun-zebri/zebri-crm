import { FIELDS } from '../email/email-data';

import { textToDoc } from './email-editor/email-doc';
import type { JourneyStep } from './journeys-data';
import { amountLabel, amountOf, dueBackOf, dueInOf, expiresOf, payOf, signersOf, type StepEmail } from './step-settings';
import { timingOf } from './timing';

/**
 * The emails a journey sends, drafted for what each one is for. Every
 * document step goes out in an email (the proposal, with a line on how
 * long it is open; the contract, saying who signs; an invoice, with what
 * it asks for and when it is due), an email step is one, and each
 * "Remind them" follow-up is a short nudge about the step it follows.
 * Drafts are worked out from the step's settings every time, so changing
 * a setting rewrites the draft, until the MC writes their own; theirs is
 * kept on the step and never rewritten. `{field}`s fill in per client,
 * as they do in Email. The MC's signature follows every one, so no
 * draft signs off itself.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-email
 */

/** What the step asks of the client, for its email and its reminders. */
function askOf(step: JourneyStep): string {
  switch (step.kind) {
    case 'proposal':
      return 'accept your proposal';
    case 'contract':
      return 'sign your contract';
    case 'invoice':
      return `pay your ${step.name.toLowerCase()}`;
    case 'questionnaire':
      return 'fill in your questionnaire';
    case 'runSheet':
      return 'look over your run sheet';
    default:
      return 'reply';
  }
}

/** The email a step goes out in, as Zebri drafts it. `next` is the step after (an invoice going with a contract). */
export function draftOf(step: JourneyStep, next?: JourneyStep): StepEmail {
  const hi = 'Hi {first names},\n\n';
  switch (step.kind) {
    case 'proposal': {
      const days = expiresOf(step);
      const hold = days ? ` It holds {wedding date} for you for ${days} days.` : '';
      return { subject: 'Your proposal from {your first name}', body: `${hi}It was lovely hearing about your plans. Your proposal is ready, with my packages, what each includes and how booking works.\n\nPick the one that fits and accept it right on the page.${hold}` };
    }
    case 'contract': {
      const who = signersOf(step).startsWith('both') ? 'Each of you signs' : 'One of you signs';
      const then = signersOf(step).endsWith('you') ? ', then I countersign and send you a copy' : ', and you both get a copy';
      const pay = next?.kind === 'invoice' && next.withPrev ? ' Once it is signed, you can pay the deposit on the same page to lock in your date.' : '';
      return { subject: 'Your contract for {wedding date}', body: `${hi}Thank you for choosing me. Here is the contract for the package you picked. ${who} on the page${then}.${pay}` };
    }
    case 'invoice': {
      const rest = amountOf(step) === 'rest';
      const how = payOf(step) === 'both' ? 'by card on the page, or by bank transfer' : 'by card on the page';
      const what = rest ? 'With the big day close, here is your final invoice for what is left to pay.' : `Here is your invoice for ${amountLabel(step).toLowerCase()}.`;
      return { subject: rest ? 'Your final invoice' : `Your ${step.name.toLowerCase()} invoice`, body: `${hi}${what} It is due within ${dueInOf(step)} days, and you can pay ${how}.` };
    }
    case 'questionnaire':
      return { subject: 'A few questions before {wedding date}', body: `${hi}It is time to plan the night properly. Can you fill this in by ${dueBackOf(step)} weeks before? It saves as you go, so you can do it in a few sittings.` };
    case 'runSheet':
      return { subject: 'Your run sheet is ready', body: `${hi}Your run sheet for {venue} is ready. Have a read and approve it on the page, or tell me what to change.${step.suppliers ? ' Once you approve it, I will send it to your suppliers so everyone is working from the same plan.' : ''}` };
    default: {
      const t = timingOf(step);
      // First on the line with the proposal following on its own: thank them, and tell them it is on its way.
      if (t.at === 'start' && next?.kind === 'proposal' && timingOf(next).at === 'previous')
        return { subject: 'Thank you for choosing me, {first names}', body: `${hi}Thank you so much for choosing me for your wedding. I am already looking forward to it.\n\nKeep an eye on your inbox: your proposal is coming shortly, with my packages and everything we talked about.` };
      if (t.at === 'start') return { subject: 'Thanks for getting in touch, {first names}', body: `${hi}Thank you for getting in touch, and congratulations! {venue} is a beautiful spot and I would love to be part of your day.\n\nThe quickest next step is a 20 minute call, so we can talk it through.` };
      if (t.at === 'wedding' && t.side === 'after') return { subject: 'Thank you, {first names}', body: `${hi}What a night. Thank you for trusting me with it.\n\nIf you have two minutes, a review helps other couples find me.` };
      return { subject: 'A quick check in', body: `${hi}Just checking in to see how the planning is going. If anything has changed, let me know.` };
    }
  }
}

/** The email a step goes out in: the MC's own, or the draft. */
export const emailOf = (step: JourneyStep, next?: JourneyStep) => step.email ?? draftOf(step, next);

/** A reminder's draft: a short nudge about what the step still needs. */
export function reminderDraftOf(step: JourneyStep, next?: JourneyStep): StepEmail {
  return { subject: `Re: ${emailOf(step, next).subject}`, body: `Hi {first names},\n\nJust a gentle nudge in case this got buried: when you have a moment, can you ${askOf(step)}?` };
}

/** A reminder's email: the MC's own for that follow-up, or the draft. */
export const reminderOf = (step: JourneyStep, item: string, next?: JourneyStep) => step.reminderEmails?.[item] ?? reminderDraftOf(step, next);

/** An email's content as the editor and the preview read it: the MC's own, or the draft's text with `button` (what it asks them to do) last. */
export const docOf = (e: StepEmail, button?: string | null) => e.doc ?? textToDoc(e.body, button);

/** `{field}`s filled with the sample couple's values, for a card or an inbox line. */
export const filled = (text: string) => text.replace(/\{([^}]+)\}/g, (m, t: string) => FIELDS.find((f) => f.token === t)?.sample ?? m);

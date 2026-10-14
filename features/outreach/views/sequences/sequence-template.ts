/**
 * The starter sequence behind "Start from a template": four steps over two
 * weeks, email, Instagram DM, then two emails in the same thread.
 *
 * Why it reads the way it does (the reasoning, so edits keep it):
 * - Short (under ~100 words) and plain, written like one person to another.
 * - Leads with the celebrant's world, not with Zebri. No "CRM": that is
 *   our word, not theirs.
 * - The ask is always the same: reply "in" to join the early access list.
 *   It is free to say yes to, needs no link, and the sequencer stops the
 *   sequence on any reply, so the sender picks it up by hand from there.
 *   The booking link only appears in the last email, as a side door, so it
 *   is the only link in the sequence, which helps deliverability.
 * - Every factual claim must be true on the day it is sent. This is not
 *   style: a false claim in a commercial email is misleading conduct under
 *   the Australian Consumer Law. So:
 *   - BDM lodgement is described as what Zebri is BUILDING, not what it
 *     does today. When lodgement ships, change the tense, not before.
 *   - No "only" or "first" claims about the market. They are hard to prove
 *     and easy to be wrong about.
 *   - The excitement comes from things the founder controls and keeps:
 *     early access before launch, and founding members having a say in
 *     what gets built. Add a hard number or a closing date only once it is
 *     real, and then honour it.
 * - Each follow-up adds a new angle instead of "just bumping this".
 * - Both step 1 variants carry BDM: A leads with it as the problem, B folds
 *   it into the one-link package with a seasonal hook. The 50/50 split
 *   tests the framing, not whether to mention it.
 * - Written for NSW celebrants; for other states, duplicate it and adjust.
 * - The sender's name, business and contact details, and the opt-out line,
 *   are added to every email by the footer (lib/outreach/render.ts), so
 *   the bodies here do not repeat them.
 * - No emojis, anywhere.
 *
 * @module features/outreach/views/sequences/sequence-template
 */
import { type DraftSequence, type DraftStep, type DraftVariant, newKey } from './sequence-draft';

/** One message variant. */
function message(label: string, weight: number, subject: string, body: string): DraftVariant {
  return { key: newKey(), label, subject, body, weight, active: true, sentCount: 0 };
}

/** One step with its variants. */
function step(channel: 'email' | 'instagram', delayDays: number, newThread: boolean, variants: DraftVariant[]): DraftStep {
  return { key: newKey(), channel, delay_days: delayDays, is_new_thread: newThread, usedLabels: [], sentCount: 0, variants };
}

const lines = (...l: string[]) => l.join('\n');

/** Build a fresh copy of the starter sequence. Every call gets new row keys. */
export function templateSequence(): DraftSequence {
  const steps: DraftStep[] = [
    step('email', 0, true, [
      message('A', 50, 'lodging with BDM, without the portal', lines(
        'Hi {{first_name|there}},',
        '',
        "After the ceremony there's still the lodgement: retyping the couple's details into the BDM portal and waiting to hear it's registered.",
        '',
        "I'm building Zebri to take that off your plate. The couple enters their details once, you check them, and after the wedding Zebri lodges it with BDM for you.",
        '',
        "Before it launches, we're opening it to a small group of founding celebrants. They get in first and help decide what we build next.",
        '',
        "Want in? Reply 'in' and I'll add you to the early access list.",
      )),
      message('B', 50, 'early access for celebrants', lines(
        'Hi {{first_name|there}},',
        '',
        "I'm building Zebri, made in Australia for celebrants. The couple gets one link to sign your agreement, pay the deposit and fill in their details. Next, we're building lodgement straight with BDM, so the paperwork after the wedding is one step.",
        '',
        "Spring is the busy stretch, so I'll keep it short. We're taking a small founding group before launch.",
        '',
        "Reply 'in' and I'll add you to the early access list.",
      )),
    ]),
    step('instagram', 3, false, [
      message('A', 100, '', lines(
        "Hi {{first_name|there}}, {{sender_name}} from Zebri here. I emailed you a few days ago about the app we're building to lodge marriages with BDM for you. Thought I'd say hello here too in case email isn't your thing.",
        '',
        "We're taking a small founding group of celebrants before launch. Want in? Reply 'in' and I'll add you.",
      )),
    ]),
    step('email', 4, false, [
      message('A', 100, '', lines(
        'Hi {{first_name|there}},',
        '',
        "One more thought. The part that takes the most time usually isn't the ceremony, it's the chasing before it: the signed agreement, then the deposit, then the couple's details.",
        '',
        'With Zebri the couple does all three from one link, and you get a nudge when it is done. Founding celebrants get it before anyone else.',
        '',
        "If the chasing is a headache for you, reply 'in' and you're on the list. If it isn't, that's useful to know too.",
      )),
    ]),
    step('email', 7, false, [
      message('A', 100, '', lines(
        'Hi {{first_name|there}},',
        '',
        "Last one from me, so I'm not clogging your inbox.",
        '',
        "The early access list is still open. If you'd like to be one of the first NSW celebrants to try BDM lodgement from the app when it's ready, reply 'in' and I'll add you.",
        '',
        "If you'd rather see it first, grab 15 minutes with me here: {{booking_link}}.",
        '',
        'If things run fine as they are, no stress at all. Good luck with the season.',
      )),
    ]),
  ];
  return { name: 'Celebrant intro', steps };
}

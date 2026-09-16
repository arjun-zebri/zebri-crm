/**
 * Starter block trees for the proposal surface, one per role (D12). Each is
 * the `both` skeleton (hero, note, about, how it works, packages, testimonials,
 * FAQ, accept) with role-specific copy in the steps and FAQ. Built through
 * `blockTemplate` so the ids and defaults never drift from the palette.
 *
 * @module app/(dashboard)/branding/blocks/proposal-starters
 */
import type { ProposalRole } from '@/lib/proposals/types'

import { blockTemplate } from './defaults'
import type { Block, FaqBlock, HowItWorksBlock, HeroBlock, AboutMeBlock } from './types'

/**
 * Role-neutral starter tree for a proposal: hero, intro note, packages,
 * accept and footer, with no about-me / how-it-works / FAQ / testimonials
 * sections. Used when the MC has not (yet) told us whether they run
 * ceremonies, receptions, or both - `proposalStarterBlocks` picks role
 * copy and a testimonials block, and guessing a role on the MC's behalf
 * would risk shipping copy or "kind words" they never chose to a real
 * couple. Every call mints fresh block ids, same as `proposalStarterBlocks`.
 */
export function proposalNeutralBlocks(): Block[] {
  return [
    blockTemplate('hero'),
    blockTemplate('introNote'),
    blockTemplate('packages'),
    blockTemplate('accept'),
    blockTemplate('footer'),
  ]
}

let n = 0
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`

const STEPS: Record<ProposalRole, HowItWorksBlock['steps']> = {
  mc: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Build the run sheet', description: 'We map the night together: entrances, speeches, the first dance.', icon: 'calendar' },
    { id: id('st'), title: 'Vendors briefed', description: 'I coordinate with your venue, DJ and photographer on the day.', icon: 'message' },
    { id: id('st'), title: 'Your night', description: 'I keep it on time and on tone so you can enjoy it.', icon: 'mic' },
  ],
  celebrant: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Legal paperwork', description: 'We lodge the NOIM at least a month out. I handle the forms.', icon: 'file' },
    { id: id('st'), title: 'Your ceremony, written', description: 'A story ceremony drafted from our chats, yours to edit.', icon: 'pen' },
    { id: id('st'), title: 'Rehearsal and the day', description: 'A relaxed run-through, then a ceremony that feels like you.', icon: 'heart' },
  ],
  both: [
    { id: id('st'), title: 'Say yes', description: 'Choose a package and sign in a couple of minutes.', icon: 'check' },
    { id: id('st'), title: 'Ceremony and legals', description: 'NOIM lodged, ceremony written with you, rehearsal booked.', icon: 'pen' },
    { id: id('st'), title: 'Reception run sheet', description: 'Entrances, speeches and the dance floor, mapped together.', icon: 'calendar' },
    { id: id('st'), title: 'The whole day', description: 'One familiar voice from "I do" to the last song.', icon: 'party' },
  ],
}

const FAQ: Record<ProposalRole, FaqBlock['items']> = {
  mc: [
    { id: id('fi'), question: 'Do you run the speeches?', answer: 'Yes. I brief every speaker, keep them to time and cover the gaps.' },
    { id: id('fi'), question: 'What if the timeline slips?', answer: 'It usually does. I re-plan on the fly with your venue and vendors.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
  celebrant: [
    { id: id('fi'), question: 'When do we lodge the NOIM?', answer: 'At least one month and no more than 18 months before the day. I walk you through it.' },
    { id: id('fi'), question: 'Can we write our own vows?', answer: 'Absolutely. I give you prompts and a gentle edit if you want one.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
  both: [
    { id: id('fi'), question: 'Is it one person for both?', answer: 'Yes. The same voice that marries you hosts your reception.' },
    { id: id('fi'), question: 'When do we lodge the NOIM?', answer: 'At least one month before the day. I handle the forms.' },
    { id: id('fi'), question: 'Do you travel?', answer: 'Yes. Travel outside the metro area is an optional extra on each package.' },
  ],
}

const SUBHEADING: Record<ProposalRole, string> = {
  mc: 'A proposal to host your reception',
  celebrant: 'A proposal to marry you',
  both: 'A proposal for your whole wedding day',
}

const ABOUT: Record<ProposalRole, string> = {
  mc: 'I have hosted more than a hundred receptions. My job is simple: keep the night moving and make sure you never look at the clock.',
  celebrant: 'I write ceremonies that sound like the two of you, take care of every legal step, and keep the day calm.',
  both: 'From the vows to the last song, one familiar voice. I write your ceremony, handle the legals, and host the reception.',
}

/**
 * The starter tree for a role. Every call mints fresh block ids so two users
 * (or two resets) never share ids.
 *
 * @param role - `mc`, `celebrant`, or `both`.
 */
export function proposalStarterBlocks(role: ProposalRole): Block[] {
  const hero = blockTemplate('hero') as HeroBlock
  const about = blockTemplate('aboutMe') as AboutMeBlock
  const how = blockTemplate('howItWorks') as HowItWorksBlock
  const faq = blockTemplate('faq') as FaqBlock
  return [
    { ...hero, subheading: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: SUBHEADING[role] }] }] } },
    blockTemplate('introNote'),
    { ...about, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ABOUT[role] }] }] } },
    { ...how, steps: STEPS[role].map((s) => ({ ...s, id: id('st') })) },
    blockTemplate('packages'),
    blockTemplate('testimonials'),
    { ...faq, items: FAQ[role].map((f) => ({ ...f, id: id('fi') })) },
    blockTemplate('accept'),
    blockTemplate('footer'),
  ]
}

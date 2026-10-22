import type { TemplateId } from '../../../proposals/templates-data';

/**
 * The words each v2 template starts a proposal with: how it works, the
 * questions couples ask, and kind words from past couples. Written per
 * template, so a ceremony proposal never talks about hosting a reception
 * (2026-10-04 audit: every template opened the same page).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/starter-copy
 */

export interface StarterCopy {
  /** The line under the couple's names on the opening photo. */
  tagline: string;
  steps: [string, string][];
  faq: [string, string][];
  words: { quote: string; names: string; detail: string }[];
}

const WORDS = [
  { quote: 'Every speech landed, every entrance was on time, and we never once looked at the clock. Our guests still talk about it.', names: 'Priya & Sam', detail: 'Married at Stones of the Yarra Valley' },
  { quote: 'Calm, funny and so organised. It felt like having a friend running the whole night.', names: 'Grace & Oliver', detail: 'Married at Bells at Killcare' },
];

export const STARTER_COPY: Record<TemplateId, StarterCopy> = {
  'full-day': {
    tagline: 'Your day, from the first entrance to the last dance',
    steps: [
      ['Say yes', 'Pick a package and sign in a couple of minutes. Your date is held.'],
      ['Plan the night', 'We map it together: entrances, speeches, the first dance.'],
      ['On the day', 'I brief your venue, DJ and photographer, and keep it all on time.'],
      ['You enjoy it', 'You stay present with the people you love. I handle the rest.'],
    ],
    faq: [
      ['Do you run the speeches?', 'Yes. I meet each speaker beforehand, keep them to time and introduce them warmly.'],
      ['What if the timeline slips?', 'It happens at every wedding. I adjust on the fly with the venue so no one notices.'],
      ['Do you travel?', 'Anywhere in Victoria is included. Further afield, travel is quoted up front.'],
    ],
    words: WORDS,
  },
  ceremony: {
    tagline: 'A ceremony that feels like you',
    steps: [
      ['Say yes', 'Pick your package and sign. Your date is held.'],
      ['Write it together', 'We shape your story, your vows and the readings, line by line.'],
      ['Rehearse', 'A walk-through on site, so everyone knows where to stand.'],
      ['Say I do', 'I lodge the paperwork and you get on with celebrating.'],
    ],
    faq: [
      ['Can we write our own vows?', 'Of course. I can help you shape them, or leave them as a surprise for each other.'],
      ['Do you handle the legal side?', 'Yes. The Notice of Intended Marriage, the certificates and the lodgement are all included.'],
      ['How long is the ceremony?', 'Most run twenty to thirty minutes. We set the length together.'],
    ],
    words: WORDS,
  },
  celebrant: {
    tagline: 'One voice from “I do” to the last dance',
    steps: [
      ['Say yes', 'Pick a package and sign. One booking covers the whole day.'],
      ['Your story', 'We write your ceremony together, then plan the reception.'],
      ['Paperwork', 'I take care of every legal form, start to finish.'],
      ['One voice all day', 'Your guests hear the same warm voice from the vows to the speeches.'],
    ],
    faq: [
      ['Is it really one person all day?', 'Yes. I marry you, then host the reception, so nothing is lost between the two.'],
      ['Do you handle the legal side?', 'Every form and the lodgement are included.'],
      ['Do you run the speeches?', 'Yes, I meet each speaker beforehand and keep them to time.'],
    ],
    words: WORDS,
  },
  gala: {
    tagline: 'An evening that runs to the minute',
    steps: [
      ['Confirm', 'Pick a package and sign. The date is held for your team.'],
      ['Brief', 'One call with your events team on the run of the night.'],
      ['Run sheet', 'Awards, auctions and speeches timed to the minute.'],
      ['On the night', 'I host, keep the room with you and finish on time.'],
    ],
    faq: [
      ['Can you run an auction?', 'Yes, including live bidding and a paddle raise.'],
      ['Will you work from our script?', 'Happily. I can also write links between segments in your voice.'],
      ['Do you need a lectern?', 'A lectern and a handheld mic are ideal. I bring a backup.'],
    ],
    words: [{ quote: 'Our awards night finished on time for the first time in years.', names: 'Harbour Bank', detail: 'End of year gala, Doltone House' }],
  },
};

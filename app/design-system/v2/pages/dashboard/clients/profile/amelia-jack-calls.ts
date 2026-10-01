import type { CallsSeed, TranscriptLine } from './calls-data';

/**
 * Amelia & Jack's calls: the intro call in February, its notes long
 * since dealt with, and a planning call booked for today. Starting that
 * call and ending it produces `next`: the notes that settle both of
 * today's loose ends (guest count, timeline sign-off) once applied.
 * Demo data only.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/amelia-jack-calls
 */

type Line = [id: string, at: string, who: string, text: string];

const lines = (rows: Line[]): TranscriptLine[] =>
  rows.map(([id, at, who, text]) => ({ id, at, who, text, you: who === 'You' }));

const INTRO = lines([
  ['i1', '00:08', 'You', 'Hi both, lovely to meet you. How did you find me?'],
  ['i2', '00:15', 'Amelia', 'You MC’d my cousin Beth’s wedding last year. We didn’t stop talking about it.'],
  ['i3', '01:02', 'You', 'Tell me about the day. Do you have a date and a venue yet?'],
  ['i4', '01:10', 'Jack', 'Saturday the 10th of October, at Hawthorn Hall. Ceremony at 2:30.'],
  ['i5', '02:34', 'Amelia', 'We want it relaxed. Lots of dancing, not too many formalities.'],
  ['i6', '09:40', 'You', 'Premium covers the ceremony, the reception and a rehearsal. Does that sound right?'],
  ['i7', '09:52', 'Jack', 'Premium, yes. The rehearsal is a must for my family.'],
]);

const PLANNING = lines([
  ['p1', '00:12', 'You', 'Hi both! Fifteen days to go. How are you feeling?'],
  ['p2', '00:20', 'Amelia', 'Excited, and a little bit terrified.'],
  ['p3', '00:31', 'Jack', 'Mostly excited. Sorry I’ve been slow on the timeline.'],
  ['p4', '00:40', 'You', 'All good. Numbers first, the venue needs them Friday. Where did you land?'],
  ['p5', '00:52', 'Amelia', 'We’re at 138 now. That’s final, the last RSVPs came in last night.'],
  ['p6', '01:05', 'You', 'Perfect, 138. And Jack, the timeline: photos straight after the speeches?'],
  ['p7', '01:14', 'Jack', 'Yes, I read it last night. Photos after the speeches works. Consider it signed off.'],
  ['p8', '02:40', 'You', 'Great. Speeches: who is speaking, and in what order?'],
  ['p9', '02:51', 'Jack', 'My brother Tom is best man. He wants to go last, he’s the funny one.'],
  ['p10', '03:02', 'Amelia', 'Dad first then, then Tom, then the two of us.'],
  ['p11', '03:10', 'You', 'Love it. Can I grab Tom’s number to check his timing?'],
  ['p12', '03:15', 'Jack', 'Yep, Tom Moreno, 0433 210 987.'],
  ['p13', '05:22', 'You', 'What are you walking in to at the reception?'],
  ['p14', '05:30', 'Amelia', 'September, by Earth, Wind & Fire. Loud.'],
  ['p15', '07:48', 'You', 'Last one: rehearsal Friday at five still okay?'],
  ['p16', '07:55', 'Jack', 'Could we push it to 5:30? I finish work at five.'],
  ['p17', '08:02', 'You', '5:30 it is. I’ll let Priya know.'],
  ['p18', '08:40', 'Amelia', 'Oh, and Margaret is happy to stand for the vows. Just seated for the entrance.'],
]);

export const AMELIA_JACK_CALLS: CallsSeed = {
  calls: [
    { id: 'planning', title: 'Planning call', when: 'Today, 4:00pm', status: 'upcoming' },
    {
      id: 'intro',
      title: 'Intro call',
      when: 'Thu 12 Feb',
      length: '31 min',
      status: 'ready',
      notes: {
        summary:
          'Amelia and Jack found you through Beth’s wedding. Sat 10 Oct at Hawthorn Hall, ceremony at 2:30pm, and they chose Premium for the rehearsal.',
        updates: [
          { id: 'i-date', label: 'Date', from: '', to: 'Sat 10 Oct, 2:30pm', line: 'i4', quote: 'Saturday the 10th of October, at Hawthorn Hall. Ceremony at 2:30.', decided: 'applied' },
          { id: 'i-venue', label: 'Venue', from: '', to: 'Hawthorn Hall', line: 'i4', quote: 'At Hawthorn Hall.', decided: 'applied' },
          { id: 'i-package', label: 'Package', from: '', to: 'Premium', line: 'i7', quote: 'Premium, yes. The rehearsal is a must for my family.', decided: 'applied' },
        ],
        details: [
          { text: 'Found you through Beth’s wedding (Amelia’s cousin).', line: 'i2' },
          { text: 'Relaxed, lots of dancing, few formalities.', line: 'i5' },
        ],
        followUp: { channel: 'Email', to: 'Amelia', subject: 'Lovely to meet you both', body: '' },
        followUpSent: true,
        transcript: INTRO,
        covered: ['Date and venue', 'The feel of the day', 'Package'],
        missed: [],
      },
    },
  ],
  checklist: ['Final guest count', 'Timeline sign-off', 'Speeches order', 'Entrance song', 'Rehearsal time', 'Meal for the MC'],
  nextLength: '38 min',
  next: {
    summary:
      'Numbers and the timeline are settled: 138 guests, and Jack signed off Timeline v2 on the call. The rehearsal moves to 5:30pm. Jack’s brother Tom is best man and speaks second.',
    updates: [
      { id: 'p-guests', label: 'Guests', from: 'Missing', to: '138', line: 'p5', quote: 'We’re at 138 now. That’s final.', resolves: 'numbers' },
      { id: 'p-timeline', label: 'Timeline', from: 'v2 · awaiting sign-off', to: 'v2 · signed off by Jack', line: 'p7', quote: 'Photos after the speeches works. Consider it signed off.', resolves: 'timeline' },
      { id: 'p-rehearsal', label: 'Rehearsal', from: 'Fri 9 Oct, 5:00pm', to: 'Fri 9 Oct, 5:30pm', line: 'p16', quote: 'Could we push it to 5:30? I finish work at five.', upcoming: { id: 'rehearsal', label: 'Rehearsal, 5:30pm' } },
      {
        id: 'p-tom',
        label: 'People',
        from: '',
        to: 'Tom Moreno · Best man',
        line: 'p12',
        quote: 'Yep, Tom Moreno, 0433 210 987.',
        person: { name: 'Tom Moreno', role: 'Best man', prefers: 'no preference yet', email: '', phone: '0433 210 987' },
      },
    ],
    details: [
      { text: 'Speeches: Amelia’s dad, then Tom, then Amelia and Jack.', line: 'p10' },
      { text: 'Reception entrance: September, Earth, Wind & Fire.', line: 'p14' },
      { text: 'Margaret stands for the vows, seated for the entrance.', line: 'p18' },
    ],
    followUp: {
      channel: 'Email',
      to: 'Amelia',
      subject: 'Recap from today’s call',
      body: 'Hi Amelia and Jack,\n\nThanks for today! Here’s what we locked in:\n\n· 138 guests (I’ll pass this on to Priya)\n· Timeline v2 is signed off\n· Rehearsal moves to Fri 9 Oct at 5:30pm\n· Speeches: Amelia’s dad, then Tom, then you two\n· Entrance song: September\n\nI’ll give Tom a call this week about his timing.\n\nWarmly,\nArjun',
    },
    transcript: PLANNING,
  },
};

import type { CallsSeed } from './calls-data';

/**
 * Amelia & Jack's calls: the intro call in February, its notes long
 * since dealt with, and a planning call booked for today. Starting that
 * call and ending it produces `next`: the notes that settle both of
 * today's loose ends (guest count, timeline sign-off) once applied.
 * Demo data only.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/amelia-jack-calls
 */

export const AMELIA_JACK_CALLS: CallsSeed = {
  calls: [
    { id: 'planning', title: 'Planning call', when: 'Today, 4:00 pm', status: 'upcoming' },
    {
      id: 'intro',
      title: 'Intro call',
      when: 'Thu 12 Feb',
      length: '31 min',
      status: 'ready',
      notes: {
        summary:
          'Amelia and Jack found you through Beth’s wedding. Sat 10 Oct at Hawthorn Hall, ceremony at 2:30 pm, and they chose Premium for the rehearsal.',
        updates: [
          { id: 'i-date', label: 'Date', from: '', to: 'Sat 10 Oct, 2:30 pm', line: 'i4', quote: 'Saturday the 10th of October, at Hawthorn Hall. Ceremony at 2:30.', decided: 'applied' },
          { id: 'i-venue', label: 'Venue', from: '', to: 'Hawthorn Hall', line: 'i4', quote: 'At Hawthorn Hall.', decided: 'applied' },
          { id: 'i-package', label: 'Package', from: '', to: 'Premium', line: 'i7', quote: 'Premium, yes. The rehearsal is a must for my family.', decided: 'applied' },
        ],
        details: [
          { text: 'Found you through Beth’s wedding (Amelia’s cousin).', line: 'i2' },
          { text: 'Relaxed, lots of dancing, few formalities.', line: 'i5' },
        ],
        covered: ['Date and venue', 'The feel of the day', 'Package'],
        missed: [],
      },
    },
  ],
  checklist: ['Final guest count', 'Timeline sign-off', 'Speeches order', 'Entrance song', 'Rehearsal time', 'Meal for the MC'],
  nextLength: '38 min',
  next: {
    // Started on its own rather than from the booked planning call, Zebri names it for what it settled.
    title: 'Final numbers call',
    summary:
      'Numbers and the timeline are settled: 138 guests, and Jack signed off Timeline v2 on the call. The rehearsal moves to 5:30 pm. Jack’s brother Tom is best man and speaks second.',
    updates: [
      { id: 'p-guests', label: 'Guests', from: 'Missing', to: '138', line: 'p5', quote: 'We’re at 138 now. That’s final.', resolves: 'numbers' },
      { id: 'p-timeline', label: 'Timeline', from: 'v2 · awaiting sign-off', to: 'v2 · signed off by Jack', line: 'p7', quote: 'Photos after the speeches works. Consider it signed off.', resolves: 'timeline' },
      { id: 'p-rehearsal', label: 'Rehearsal', from: 'Fri 9 Oct, 5:00 pm', to: 'Fri 9 Oct, 5:30 pm', line: 'p16', quote: 'Could we push it to 5:30? I finish work at five.', upcoming: { id: 'rehearsal', label: 'Rehearsal, 5:30 pm' } },
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
  },
};

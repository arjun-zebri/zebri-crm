import type { ProposalSeed } from './proposals-data';

/**
 * The proposals written out by hand: the ones still in play, and the
 * recent wins the Payments page bills. Kept apart from the generated
 * history (`generated-proposals.ts`) so the stories stay easy to read.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/named-proposals
 */

export const NAMED: ProposalSeed[] = [
  // Opened, not accepted.
  {
    id: 'pr-sophie-max', names: ['Sophie', 'Max'], template: 'full-day', event: '2026-11-21', venue: 'Curzon Hall',
    createdOn: '2026-09-21', sentOn: '2026-09-22', openedOn: '2026-09-22', lastOpenedOn: '2026-09-27', opens: 5, reached: true, leaning: 'premium', expiresOn: '2026-10-06',
    read: 'Opened it 3 times today and lingered on Premium.',
    reading: [['Welcome', 30, 18], ['Video hello', 20, 11], ['How it works', 22, 14], ['Packages', 200, 62], ['Their words', 8, 4], ['Accept', 25, 16]],
    history: [{ when: 'Today', text: 'Opened by Sophie' }, { when: 'Thu 24 Sep', text: 'Opened by Max' }, { when: 'Tue 22 Sep', text: 'Opened by Sophie' }, { when: 'Tue 22 Sep', text: 'Sent to Sophie and Max' }],
  },
  {
    id: 'pr-ava-finn', names: ['Ava', 'Finn'], template: 'ceremony', event: '2026-12-05', venue: 'Royal Botanic Garden',
    createdOn: '2026-09-24', sentOn: '2026-09-24', openedOn: '2026-09-26', lastOpenedOn: '2026-09-26', opens: 2, reached: true, leaning: 'ceremony', expiresOn: '2026-10-22',
    read: 'Read every section, and went back to the price twice.',
    reading: [['Welcome', 30, 25], ['Video hello', 34, 30], ['How it works', 38, 32], ['Packages', 60, 58], ['Their words', 10, 10], ['Accept', 18, 15]],
    history: [{ when: 'Sat 26 Sep', text: 'Opened by Ava, twice' }, { when: 'Thu 24 Sep', text: 'Sent to Ava and Finn' }],
  },
  {
    id: 'pr-ruby-kai', names: ['Ruby', 'Kai'], template: 'celebrant', event: '2027-04-17', venue: 'The Boathouse Palm Beach',
    createdOn: '2026-09-17', sentOn: '2026-09-18', openedOn: '2026-09-19', lastOpenedOn: '2026-09-25', opens: 2, reached: true, leaning: 'celebrant', expiresOn: '2026-10-02', nudgedOn: '2026-09-25',
    read: 'Asked if the ceremony can move inside if it rains.',
    reading: [['Welcome', 30, 0], ['Video hello', 0, 0], ['How it works', 44, 0], ['Packages', 70, 26], ['Their words', 8, 0], ['Accept', 15, 0]],
    history: [{ when: 'Fri 25 Sep', text: 'Zebri sent a friendly nudge · opened by Ruby' }, { when: 'Sat 19 Sep', text: 'Opened by Ruby' }, { when: 'Fri 18 Sep', text: 'Sent to Ruby and Kai' }],
  },
  {
    id: 'pr-lucy-tom', names: ['Lucy', 'Tom'], template: 'full-day', event: '2027-01-30', venue: 'Bendooley Estate',
    createdOn: '2026-09-10', sentOn: '2026-09-10', openedOn: '2026-09-11', lastOpenedOn: '2026-09-16', opens: 2, reached: false, expiresOn: '2026-10-08',
    read: 'Stopped before the packages. Worth asking what they are after.',
    reading: [['Welcome', 25, 15], ['Video hello', 12, 0], ['How it works', 10, 12], ['Packages', 0, 0], ['Their words', 0, 0], ['Accept', 0, 0]],
    history: [{ when: 'Wed 16 Sep', text: 'Opened by Tom' }, { when: 'Fri 11 Sep', text: 'Opened by Lucy' }, { when: 'Thu 10 Sep', text: 'Sent to Lucy and Tom' }],
  },
  // Sent, not opened.
  {
    id: 'pr-olivia-ben', names: ['Olivia', 'Ben'], template: 'full-day', event: '2027-02-27', venue: 'Establishment Ballroom',
    createdOn: '2026-09-21', sentOn: '2026-09-21', expiresOn: '2026-10-05',
    read: 'Replies fast but hasn’t opened it. Emails may be landing in spam.',
    history: [{ when: 'Mon 21 Sep', text: 'Sent to Olivia and Ben' }],
  },
  {
    id: 'pr-nina-omar', names: ['Nina', 'Omar'], template: 'full-day', event: '2027-05-15', venue: 'Gunners Barracks',
    createdOn: '2026-09-26', sentOn: '2026-09-26', expiresOn: '2026-10-24',
    history: [{ when: 'Sat 26 Sep', text: 'Sent to Nina and Omar' }],
  },
  // Drafts.
  {
    id: 'pr-grace-sam', names: ['Grace', 'Sam'], template: 'full-day', event: '2027-05-02', venue: 'Bells at Killcare', createdOn: '2026-09-25',
    history: [{ when: 'Fri 25 Sep', text: 'Drafted from Full day MC, ready to send after your call' }],
  },
  {
    id: 'pr-mia-leo', names: ['Mia', 'Leo'], template: 'celebrant', event: '2027-03-14', venue: 'Hawthorn Hall', createdOn: '2026-09-27',
    history: [{ when: 'Today', text: 'Drafted from Celebrant + MC' }],
  },
  // Accepted.
  {
    id: 'pr-hannah-joe', names: ['Hannah', 'Joe'], template: 'full-day', event: '2027-01-23', venue: 'Stones of the Yarra Valley',
    createdOn: '2026-09-15', sentOn: '2026-09-15', openedOn: '2026-09-16', lastOpenedOn: '2026-09-23', opens: 4, reached: true, leaning: 'classic', acceptedOn: '2026-09-24', chosen: 'classic', expiresOn: '2026-10-13',
    reading: [['Welcome', 20, 16], ['Video hello', 22, 18], ['How it works', 14, 14], ['Packages', 80, 100], ['Their words', 7, 8], ['Accept', 30, 30]],
    history: [{ when: 'Thu 24 Sep', text: 'Accepted by Hannah, Classic MC' }, { when: 'Wed 23 Sep', text: 'Opened by Joe' }, { when: 'Wed 16 Sep', text: 'Opened by Hannah' }, { when: 'Tue 15 Sep', text: 'Sent to Hannah and Joe' }],
  },
  {
    id: 'pr-jess-ali', names: ['Jess', 'Ali'], template: 'full-day', event: '2027-04-10', venue: 'Gunners Barracks',
    createdOn: '2026-09-09', sentOn: '2026-09-10', openedOn: '2026-09-10', lastOpenedOn: '2026-09-14', opens: 3, reached: true, leaning: 'classic', acceptedOn: '2026-09-14', chosen: 'classic', signedOn: '2026-09-15', paidOn: '2026-09-18', expiresOn: '2026-09-24',
    reading: [['Welcome', 18, 12], ['Video hello', 30, 22], ['How it works', 15, 10], ['Packages', 100, 40], ['Their words', 10, 8], ['Accept', 25, 13]],
    history: [{ when: 'Fri 18 Sep', text: 'Deposit paid by Jess' }, { when: 'Tue 15 Sep', text: 'Contract signed by everyone' }, { when: 'Mon 14 Sep', text: 'Accepted by Jess, Classic MC' }, { when: 'Thu 10 Sep', text: 'Sent to Jess and Ali' }],
  },
  {
    id: 'pr-chloe-marcus', names: ['Chloe', 'Marcus'], template: 'full-day', event: '2026-12-12', venue: 'Doltone House',
    createdOn: '2026-08-02', sentOn: '2026-08-03', openedOn: '2026-08-03', lastOpenedOn: '2026-08-06', opens: 3, reached: true, leaning: 'classic', acceptedOn: '2026-08-06', chosen: 'classic', signedOn: '2026-08-07', paidOn: '2026-08-08', expiresOn: '2026-08-17',
    history: [{ when: 'Sat 8 Aug', text: 'Deposit paid by Chloe' }, { when: 'Fri 7 Aug', text: 'Contract signed by everyone' }, { when: 'Thu 6 Aug', text: 'Accepted by Marcus, Classic MC' }, { when: 'Mon 3 Aug', text: 'Sent to Chloe and Marcus' }],
  },
  // Declined or expired.
  {
    id: 'pr-emma-luca', names: ['Emma', 'Luca'], template: 'full-day', event: '2027-03-20', venue: 'Craigmoor',
    createdOn: '2026-09-03', sentOn: '2026-09-03', openedOn: '2026-09-04', lastOpenedOn: '2026-09-08', opens: 2, reached: true, leaning: 'classic', declinedOn: '2026-09-12', expiresOn: '2026-09-17',
    history: [{ when: 'Sat 12 Sep', text: 'Declined by Emma: “a family friend is doing it”' }, { when: 'Fri 4 Sep', text: 'Opened by Emma' }, { when: 'Thu 3 Sep', text: 'Sent to Emma and Luca' }],
  },
  {
    id: 'pr-sienna-jay', names: ['Sienna', 'Jay'], template: 'ceremony', event: '2027-02-13', venue: 'Centennial Park',
    createdOn: '2026-08-30', sentOn: '2026-08-30', openedOn: '2026-09-01', lastOpenedOn: '2026-09-01', opens: 1, reached: false, expiresOn: '2026-09-20',
    history: [{ when: 'Sun 20 Sep', text: 'Expired without an answer' }, { when: 'Tue 1 Sep', text: 'Opened by Sienna' }, { when: 'Sun 30 Aug', text: 'Sent to Sienna and Jay' }],
  },
];

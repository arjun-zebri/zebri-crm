import { describe, expect, it } from 'vitest';

import { isOptOut } from '@/lib/outreach/gmail/classify';

describe('isOptOut', () => {
  it.each([
    ['STOP', ''],
    ['stop', ''],
    ['Unsubscribe.', ''],
    ['Please remove me from your list.', ''],
    ['Not interested, remove me from your list', ''],
    ["Please don't contact me again.", ''],
    ['Take me off your mailing list', ''],
    ['No more emails please', ''],
    ['opt out thanks', ''],
    ['', 'unsubscribe'],
    ['', 'Re: Unsubscribe'],
    ['Thanks,\n\nSTOP', ''],
  ])('treats %j (subject %j) as an opt-out', (body, subject) => {
    expect(isOptOut(body, subject)).toBe(true);
  });

  it.each([
    ['Stop by Thursday?', ''],
    ['Can you stop by the office on Monday?', ''],
    ["Don't contact me until next month, I'm away", ''],
    ['Please remove the listing from your website', ''],
    ['Yes, sounds great. Could we talk Tuesday?', ''],
    ['Thanks for reaching out, I am not interested right now', ''],
    ['Hi, I would love to chat.\n\nOn Mon, Arjun wrote:\n> STOP', ''],
    ['', 'Quick question about your ceremonies'],
    ['', 'Re: Stop by Thursday?'],
  ])('does not treat %j (subject %j) as an opt-out', (body, subject) => {
    expect(isOptOut(body, subject)).toBe(false);
  });

  it('ignores a stop phrase buried in a long reply', () => {
    const long = `${'I have been a celebrant for twenty years and I really enjoy the work. '.repeat(3)} remove me from your list`;
    expect(isOptOut(long, '')).toBe(false);
  });
});

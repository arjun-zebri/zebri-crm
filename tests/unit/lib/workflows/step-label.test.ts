/**
 * What a stored step is called.
 *
 * A send is stored with `title = ''`, because the builder only asks for
 * a name on the manual steps. Every list rendered that as a blank row,
 * and on the queue the blank label was also the row's only click
 * target, so the step could not be opened at all.
 */
import { describe, expect, it } from 'vitest';

import { stepDisplayTitle } from '@/lib/workflows/step-label';

describe('stepDisplayTitle', () => {
  it("uses the MC's own words when there are any", () => {
    expect(
      stepDisplayTitle({ title: 'Ring the venue', type: 'todo', config: {} }),
    ).toBe('Ring the venue');
  });

  it('ignores a title that is only whitespace', () => {
    expect(stepDisplayTitle({ title: '   ', type: 'todo', config: {} })).toBe('To-do');
  });

  it('names an unnamed send by what it does and what it says', () => {
    expect(
      stepDisplayTitle({
        title: '',
        type: 'action',
        config: { actionType: 'send_email', subject: 'Welcome! We are excited' },
      }),
    ).toBe('Send email · Welcome! We are excited');
  });

  it('elides a long subject rather than filling the row', () => {
    const subject = 'A subject line that runs on well past the point of being scannable';
    const label = stepDisplayTitle({
      title: '',
      type: 'action',
      config: { actionType: 'send_email', subject },
    });
    expect(label.startsWith('Send email · ')).toBe(true);
    expect(label.endsWith('…')).toBe(true);
    const detail = label.slice('Send email · '.length);
    expect(detail.length).toBeLessThan(subject.length);
  });

  it('falls back to the action alone when there is nothing to quote', () => {
    expect(
      stepDisplayTitle({
        title: '',
        type: 'action',
        config: { actionType: 'update_couple_stage', toStatus: 'booked' },
      }),
    ).toBe('Update couple stage');
  });

  it('reads a send whose copy lives in its schema', () => {
    // The post-event emails store `{}` until edited and carry their
    // subject as a Zod default, so a fully written email has an empty
    // config. Reading it raw labelled it "Send thank you".
    const label = stepDisplayTitle({
      title: '',
      type: 'action',
      config: { actionType: 'send_thank_you_message' },
    });
    expect(label).toContain(' · ');
  });

  it('names the flow steps', () => {
    expect(stepDisplayTitle({ title: '', type: 'wait', config: {} })).toBe('Wait');
    expect(stepDisplayTitle({ title: '', type: 'branch', config: {} })).toBe('Branch');
    expect(stepDisplayTitle({ title: '', type: 'appointment', config: {} })).toBe(
      'Appointment',
    );
  });

  it('still returns something for a step it cannot place', () => {
    // A row that reads "Step" is a row that can still be clicked; a
    // blank one is not.
    expect(
      stepDisplayTitle({ title: '', type: 'action', config: { actionType: 'nonsense' } }),
    ).toBe('Step');
    expect(stepDisplayTitle({ title: null, type: 'action', config: null })).toBe('Step');
  });
});

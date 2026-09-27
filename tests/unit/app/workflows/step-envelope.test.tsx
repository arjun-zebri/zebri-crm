/**
 * The envelope line above a held send's preview (Task 29).
 *
 * The MC reads who it is from, who it goes to (and who is left out and
 * why), where replies land, when it goes and what is attached, before
 * pressing Send. These pin that each fact is on screen in words.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepEnvelope } from '@/app/(dashboard)/workflows/step-envelope';
import type { SendEnvelope } from '@/lib/workflows/send-envelope';

const base: SendEnvelope = {
  from: 'Zebri <noreply@app.zebri.com.au>',
  fromName: 'Zebri',
  fromAddress: 'noreply@app.zebri.com.au',
  via: 'zebri',
  to: [
    { name: 'Sarah', email: 'sarah@example.com', copy: false, skipped: null },
    { name: null, email: 'planner@x.test', copy: true, skipped: null },
    { name: null, email: 'gone@x.test', copy: true, skipped: 'suppressed' },
    { name: 'Jake', email: 'jake@example.com', copy: false, skipped: 'couple_opted_out' },
  ],
  mcCopy: 'alex@goldenmic.test',
  replyTo: 'bookings@goldenmic.test',
  sendAt: { kind: 'at', label: 'Thu 10 Sept, 4:00 pm AWST', timeZone: 'Australia/Perth' },
  attachments: ['Run sheet.pdf'],
  unresolved: [],
  unresolvedHolds: false,
  settled: false,
  notice: null,
};

describe('StepEnvelope', () => {
  it('names the sender, recipients, reply-to, time and attachments', () => {
    render(<StepEnvelope envelope={base} />);
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText(/noreply@app\.zebri\.com\.au/)).toBeInTheDocument();
    expect(screen.getByText(/sarah@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/planner@x\.test/)).toBeInTheDocument();
    expect(screen.getByText(/bookings@goldenmic\.test/)).toBeInTheDocument();
    expect(screen.getByText('Thu 10 Sept, 4:00 pm AWST')).toBeInTheDocument();
    expect(screen.getByText(/Run sheet\.pdf/)).toBeInTheDocument();
  });

  it("names the MC's own copy as a separate email, not a bcc on the couple's (I1)", () => {
    render(<StepEnvelope envelope={base} />);
    expect(screen.queryByText('Bcc')).not.toBeInTheDocument();
    const line = screen.getByText(/alex@goldenmic\.test/).closest('div');
    expect(line).toHaveTextContent('Your copy');
    expect(line).toHaveTextContent(/its own email/);
  });

  it('says who is left out, and why', () => {
    render(<StepEnvelope envelope={base} />);
    expect(screen.getByText(/gone@x\.test/).closest('li')).toHaveTextContent(/unsubscribed/i);
    expect(screen.getByText(/jake@example\.com/).closest('li')).toHaveTextContent(/opted out/i);
  });

  it('names a connected mailbox', () => {
    render(
      <StepEnvelope
        envelope={{ ...base, via: 'gmail', from: '"Alex" <alex@gmail.com>', fromName: 'Alex', fromAddress: 'alex@gmail.com' }}
      />,
    );
    expect(screen.getByText(/alex@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Gmail/)).toBeInTheDocument();
  });

  it('reads Now when the step is due', () => {
    render(<StepEnvelope envelope={{ ...base, sendAt: { kind: 'now' } }} />);
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('lists what could not be filled in', () => {
    render(<StepEnvelope envelope={{ ...base, unresolved: ['Venue name', 'Event date'] }} />);
    expect(screen.getByText(/Venue name, Event date/)).toBeInTheDocument();
  });

  it('says a legacy step will send with the gaps blank', () => {
    render(<StepEnvelope envelope={{ ...base, unresolved: ['Venue name'], unresolvedHolds: false }} />);
    expect(screen.getByText(/Venue name/)).toHaveTextContent(/will send with (this|these) left blank/i);
  });

  it('says a rich-text step will not send until the gaps are filled', () => {
    render(<StepEnvelope envelope={{ ...base, unresolved: ['Venue name'], unresolvedHolds: true }} />);
    expect(screen.getByText(/Venue name/)).toHaveTextContent(/will not send until/i);
  });

  it('reads held for a send parked on missing details', () => {
    render(<StepEnvelope envelope={{ ...base, sendAt: { kind: 'held' } }} />);
    expect(screen.getByText('Held until the missing details are filled in')).toBeInTheDocument();
  });

  it('shows only the notice once the step has run, not today’s recipients', () => {
    render(
      <StepEnvelope
        envelope={{ ...base, settled: true, notice: 'This step has run.', to: [], mcCopy: null }}
      />,
    );
    expect(screen.getByText('This step has run.')).toBeInTheDocument();
    expect(screen.queryByText('From')).not.toBeInTheDocument();
    expect(screen.queryByText('To')).not.toBeInTheDocument();
    expect(screen.queryByText(/bookings@goldenmic\.test/)).not.toBeInTheDocument();
  });

  it('shows a notice instead of an empty To line', () => {
    render(<StepEnvelope envelope={{ ...base, to: [], notice: 'No one to send this to.' }} />);
    expect(screen.getByText('No one to send this to.')).toBeInTheDocument();
  });

  it('dims while a newer render is on its way', () => {
    render(<StepEnvelope envelope={base} pending />);
    expect(screen.getByLabelText('Envelope')).toHaveAttribute('aria-busy', 'true');
  });

  // Live check B7: a variable Zebri does not know can never be filled
  // from the couple, so the advice is to change the message.
  it('names an unknown variable as one Zebri does not know, with no couple advice', () => {
    render(<StepEnvelope envelope={{ ...base, unknown: ['event.venue'], unresolvedHolds: true }} />);
    const line = screen.getByText(/not a variable Zebri knows/);
    expect(line).toHaveTextContent('{{event.venue}}');
    expect(line).toHaveTextContent(/will not send until/i);
    expect(line).toHaveTextContent(/edit the message/i);
    expect(screen.queryByText(/add the detail to the couple/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be filled in/)).not.toBeInTheDocument();
  });

  it('keeps the couple advice for a real gap beside an unknown variable', () => {
    render(
      <StepEnvelope
        envelope={{ ...base, unresolved: ['Venue name'], unknown: ['event.venue', 'guest.nmae'], unresolvedHolds: true }}
      />,
    );
    expect(screen.getByText(/Venue name could not be filled in/)).toHaveTextContent(/add the detail to the couple/i);
    expect(screen.getByText(/not variables Zebri knows/)).toHaveTextContent('{{event.venue}}, {{guest.nmae}}');
  });
});

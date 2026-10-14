import { describe, expect, it } from 'vitest';

import { addressOf, classifyInbound, isOptOut, replyLead } from '@/lib/outreach/gmail/classify';
import { plainTextOf } from '@/lib/outreach/gmail/client';
import { buildRawEmail, encodeHeader, newMessageId, replySubject } from '@/lib/outreach/gmail/mime';

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8');

describe('buildRawEmail', () => {
  it('builds threaded plain text with List-Unsubscribe and no header injection', () => {
    const raw = decode(buildRawEmail({
      from: { name: 'Arjun Punekar', email: 'arjun@zebri.com.au' },
      to: 'jane@x.com',
      subject: 'Re: Quick question\r\nBcc: evil@x.com',
      body: 'Hi Jane,\nthanks',
      inReplyTo: '<abc@zebri.com.au>',
      messageId: '<def@zebri.com.au>',
    }));
    const [head, body] = raw.split('\r\n\r\n');
    expect(head).toContain('From: Arjun Punekar <arjun@zebri.com.au>');
    expect(head).toContain('To: <jane@x.com>');
    expect(head).toContain('Subject: Re: Quick question Bcc: evil@x.com');
    expect(head).not.toMatch(/^Bcc:/m);
    expect(head).toContain('In-Reply-To: <abc@zebri.com.au>');
    expect(head).toContain('List-Unsubscribe: <mailto:arjun@zebri.com.au?subject=unsubscribe>');
    expect(head).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(Buffer.from(body!.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('Hi Jane,\r\nthanks');
  });

  it('sends multipart/alternative with a text and an HTML part when there is HTML', () => {
    const raw = decode(buildRawEmail({
      from: { name: 'Jo', email: 'jo@zebri.com.au' },
      to: 'jane@x.com',
      subject: 'Hello',
      body: 'Hi Jane',
      html: '<div>Hi <strong>Jane</strong></div>',
      messageId: '<m@zebri.com.au>',
    }, 'BOUNDARY'));
    const head = raw.split('\r\n\r\n')[0]!;
    expect(head).toContain('Content-Type: multipart/alternative; boundary="BOUNDARY"');
    expect(head).not.toContain('text/plain');
    const parts = raw.split('--BOUNDARY');
    // Preamble, text, html, closing marker.
    expect(parts).toHaveLength(4);
    const partBody = (p: string) => Buffer.from(p.split('\r\n\r\n')[1]!.replace(/\r\n/g, ''), 'base64').toString('utf8');
    expect(parts[1]).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(partBody(parts[1]!)).toBe('Hi Jane');
    expect(parts[2]).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(partBody(parts[2]!)).toBe('<div>Hi <strong>Jane</strong></div>');
    expect(parts[3]!.startsWith('--')).toBe(true);
  });

  it('encodes non-ASCII headers', () => {
    expect(encodeHeader('Café')).toMatch(/^=\?UTF-8\?B\?/);
    expect(encodeHeader('Plain')).toBe('Plain');
  });

  it('makes reply subjects and message ids', () => {
    expect(replySubject('Hello')).toBe('Re: Hello');
    expect(replySubject('RE: Hello')).toBe('RE: Hello');
    expect(newMessageId('a@zebri.com.au', () => 'x')).toBe('<x@zebri.com.au>');
  });
});

describe('classifyInbound', () => {
  const own = 'arjun@zebri.com.au';
  it('tells replies, bounces, auto-replies and our own mail apart', () => {
    expect(classifyInbound({ from: 'Jane <JANE@x.com>' }, own)).toBe('reply');
    expect(classifyInbound({ from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>' }, own)).toBe('bounce');
    expect(classifyInbound({ from: 'x@y.com', contentType: 'multipart/report; report-type=delivery-status' }, own)).toBe('bounce');
    expect(classifyInbound({ from: 'jane@x.com', autoSubmitted: 'auto-replied' }, own)).toBe('auto_reply');
    expect(classifyInbound({ from: 'jane@x.com', subject: 'Out of Office: back Monday' }, own)).toBe('auto_reply');
    expect(classifyInbound({ from: 'Arjun <arjun@zebri.com.au>' }, own)).toBe('own');
  });

  it('extracts bare addresses', () => {
    expect(addressOf('"Jane S" <Jane@X.com>')).toBe('jane@x.com');
  });
});

describe('opt-out detection', () => {
  it('matches STOP above the quote only', () => {
    expect(isOptOut('Stop\n\nOn Mon, Arjun wrote:\n> hi')).toBe(true);
    expect(isOptOut('please remove me from your list')).toBe(true);
    expect(isOptOut("Sounds great, tell me more!\n\nOn Mon, Arjun wrote:\n> Just reply STOP and I won't email again.")).toBe(false);
    expect(isOptOut("Don't stop, I'm keen")).toBe(false);
  });

  it('cuts the reply at the quote marker', () => {
    expect(replyLead('Yes please\n> quoted')).toBe('Yes please');
  });
});

describe('plainTextOf', () => {
  it('finds the text/plain part in a multipart tree', () => {
    const data = Buffer.from('hello').toString('base64url');
    expect(plainTextOf({ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: 'x' } }, { mimeType: 'text/plain', body: { data } }] })).toBe('hello');
  });
});

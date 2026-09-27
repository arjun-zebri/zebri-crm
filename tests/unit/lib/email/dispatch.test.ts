/**
 * Unit tests for `dispatchEmail` (`lib/email/dispatch`): the transport
 * router. Verifies OAuth sends hit the Gmail / Microsoft Graph endpoints,
 * default sends go through Resend, and all surface failures as
 * `{ ok: false }` rather than throwing. The Resend client + `fetch` are
 * mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resendSendMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: resendSendMock } })),
}));

process.env.RESEND_API_KEY = 'test-key';
 
global.fetch = fetchMock as any;

import { dispatchEmail, transportDeduplicates } from '@/lib/email/dispatch';
import type { ResolvedSender } from '@/lib/email/sender-identity';

const gmailSender: ResolvedSender = {
  transport: 'oauth',
  from: '"Jane" <jane@gmail.com>',
  oauth: { provider: 'google', accessToken: 'tok-g' },
};
const outlookSender: ResolvedSender = {
  transport: 'oauth',
  from: '"Jane" <jane@outlook.com>',
  oauth: { provider: 'microsoft', accessToken: 'tok-m' },
};
const resendSender: ResolvedSender = { transport: 'resend', from: 'Zebri <noreply@app.zebri.com.au>' };
const payload = { to: 'couple@example.com', subject: 'Hi', html: '<p>Hi</p>' };

beforeEach(() => {
  resendSendMock.mockReset();
  fetchMock.mockReset();
});

describe('dispatchEmail', () => {
  it('sends a Google mailbox via the Gmail API', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-1' }) });
    const res = await dispatchEmail(gmailSender, payload);
    expect(res).toEqual({ ok: true, messageId: 'g-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(JSON.parse(init.body).raw).toEqual(expect.any(String));
    expect(init.headers.Authorization).toBe('Bearer tok-g');
  });

  it('sends a Microsoft mailbox via Graph (202 = ok)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    const res = await dispatchEmail(outlookSender, payload);
    expect(res.ok).toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
  });

  it('sends the default sender through Resend', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-1' }, error: null });
    const res = await dispatchEmail(resendSender, payload);
    expect(res).toEqual({ ok: true, messageId: 'r-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds a copies tag beside the tenant tag when a Resend send carries bcc or cc', async () => {
    // A bounce event lists only the `to` recipients, so without this the
    // webhook could suppress the couple over a dead bcc mailbox.
    resendSendMock.mockResolvedValue({ data: { id: 'r-1' }, error: null });
    const tenant = { name: 'tenant', value: 'u1' };
    await dispatchEmail(resendSender, { ...payload, bcc: 'mc@example.com', tags: [tenant] });
    await dispatchEmail(resendSender, { ...payload, cc: ['florist@example.com'], tags: [tenant] });
    await dispatchEmail(resendSender, { ...payload, bcc: [], cc: [], tags: [tenant] });
    const tagsOf = (i: number) => resendSendMock.mock.calls[i]![0].tags;
    expect(tagsOf(0)).toEqual([tenant, { name: 'copies', value: '1' }]);
    expect(tagsOf(1)).toEqual([tenant, { name: 'copies', value: '1' }]);
    expect(tagsOf(2)).toEqual([tenant]);
  });

  it('returns ok:false when the Gmail API rejects', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid token' } }) });
    const res = await dispatchEmail(gmailSender, payload);
    // The code is what an alert may carry: a status, never the message.
    expect(res).toEqual({ ok: false, error: 'invalid token', code: 'http_401' });
  });

  it('returns ok:false (never throws) when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await dispatchEmail(outlookSender, payload);
    expect(res).toEqual({ ok: false, error: 'network down', code: 'thrown' });
  });

  it('passes an idempotency key to Resend when one is given', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-2' }, error: null });
    await dispatchEmail(resendSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      idempotencyKey: 'step-123:couple@example.com',
    });

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'couple@example.com' }),
      expect.objectContaining({ idempotencyKey: 'step-123:couple@example.com' }),
    );
  });

  it('omits the options argument when no key is given', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-3' }, error: null });
    await dispatchEmail(resendSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    });

    expect(resendSendMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'couple@example.com' }));
  });

  /**
   * The key reaches Resend and nowhere else. Anything deciding whether a
   * failed send may be retried has to know that, because on a transport
   * without deduplication the failures that most want a retry (a thrown
   * request, a timeout) are the ones where the message may already have
   * been accepted.
   */
  it('reports the Gmail and Graph transports as unable to deduplicate', async () => {
    expect(transportDeduplicates(resendSender)).toBe(true);
    expect(transportDeduplicates(gmailSender)).toBe(false);
    expect(transportDeduplicates(outlookSender)).toBe(false);
  });

  it('never sends the idempotency key over an OAuth transport', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-2' }) });
    await dispatchEmail(gmailSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      idempotencyKey: 'step-123:couple@example.com',
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.stringify(init)).not.toContain('step-123');
    expect(Object.keys(init.headers)).not.toContain('Idempotency-Key');
  });

  it('includes List-Unsubscribe headers on a commercial send via Resend', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-4' }, error: null });
    const res = await dispatchEmail(resendSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      listUnsubscribeUrl: 'https://app.example.com/unsubscribe/token123',
    });

    expect(res.ok).toBe(true);
    const [callPayload] = resendSendMock.mock.calls[0]!;
    expect(callPayload.headers).toEqual({
      'List-Unsubscribe': '<https://app.example.com/unsubscribe/token123>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('includes List-Unsubscribe headers in MIME output (Gmail)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-3' }) });
    await dispatchEmail(gmailSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      listUnsubscribeUrl: 'https://app.example.com/unsubscribe/token456',
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const mimeStr = Buffer.from(JSON.parse(init.body).raw, 'base64').toString('utf-8');
    expect(mimeStr).toContain('List-Unsubscribe: <https://app.example.com/unsubscribe/token456>');
    expect(mimeStr).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  });

  it('rejects a URL with CR or LF in List-Unsubscribe', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-5' }, error: null });
    const res = await dispatchEmail(resendSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      listUnsubscribeUrl: 'https://app.example.com/unsubscribe/token\r\nX-Injection: attack',
    });

    // Should reject the URL and not call Resend
    expect(res.ok).toBe(false);
    expect(res.error).toContain('invalid characters');
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('omits List-Unsubscribe headers when no URL is given', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-6' }, error: null });
    await dispatchEmail(resendSender, {
      to: 'couple@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
    });

    const [callPayload] = resendSendMock.mock.calls[0]!;
    expect(callPayload.to).toBe('couple@example.com');
    // Verify headers don't have the List-Unsubscribe keys
    if (callPayload.headers) {
      expect(callPayload.headers).not.toHaveProperty('List-Unsubscribe');
      expect(callPayload.headers).not.toHaveProperty('List-Unsubscribe-Post');
    } else {
      // No headers object at all is fine too
      expect(callPayload.headers).toBeUndefined();
    }
  });
});

/** The raw RFC-822 message handed to the Gmail API on call `i`. */
function gmailMime(i = 0): string {
  const [, init] = fetchMock.mock.calls[i]!;
  return Buffer.from(JSON.parse(init.body).raw, 'base64url').toString('utf-8');
}

/** The header block of a MIME message (everything before the first blank line). */
function headerBlock(mime: string): string {
  return mime.slice(0, mime.indexOf('\r\n\r\n'));
}

/**
 * The decoded body of the part whose Content-Type starts with `type`.
 * Parts are base64 since fix round 1, so a raw `toContain` on the message
 * can no longer see their content.
 */
function partBody(mime: string, type: string): string {
  const at = mime.indexOf(`Content-Type: ${type}`);
  expect(at, `no ${type} part`).toBeGreaterThan(-1);
  const rest = mime.slice(at);
  const bodyStart = rest.indexOf('\r\n\r\n') + 4;
  const bodyEnd = rest.indexOf('\r\n--', bodyStart);
  const head = rest.slice(0, bodyStart);
  const raw = rest.slice(bodyStart, bodyEnd);
  return /Content-Transfer-Encoding: base64/.test(head)
    ? Buffer.from(raw.replace(/\r\n/g, ''), 'base64').toString('utf8')
    : raw;
}

const footerUrl = 'https://app.zebri.com.au/unsubscribe/tok-9';
const footerHtml = `<p>Hi Sarah</p><p>Sent by Alex MC via Zebri</p><p><a href="${footerUrl}">Unsubscribe</a> from these emails</p>`;

describe('dispatchEmail text/plain alternative (M2)', () => {
  it('sends Resend a text part derived from the html, footer and unsubscribe URL included', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-t' }, error: null });
    await dispatchEmail(resendSender, { ...payload, html: footerHtml });
    const [sent] = resendSendMock.mock.calls[0]!;
    expect(sent.html).toBe(footerHtml);
    expect(sent.text).toContain('Hi Sarah');
    expect(sent.text).toContain('Sent by Alex MC via Zebri');
    expect(sent.text).toContain(footerUrl);
  });

  it('prefers a text part the caller supplied', async () => {
    resendSendMock.mockResolvedValue({ data: { id: 'r-t2' }, error: null });
    await dispatchEmail(resendSender, { ...payload, text: 'Given text' });
    expect(resendSendMock.mock.calls[0]![0].text).toBe('Given text');
  });

  it('builds Gmail mail as multipart/alternative, text before html', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-t' }) });
    await dispatchEmail(gmailSender, { ...payload, html: footerHtml });
    const mime = gmailMime();
    const boundary = /Content-Type: multipart\/alternative; boundary="([^"]+)"/.exec(headerBlock(mime))?.[1];
    expect(boundary).toBeTruthy();
    const textAt = mime.indexOf('Content-Type: text/plain; charset="UTF-8"');
    const htmlAt = mime.indexOf('Content-Type: text/html; charset="UTF-8"');
    // RFC 2046: the richest part goes last, so a client shows the html.
    expect(textAt).toBeGreaterThan(-1);
    expect(htmlAt).toBeGreaterThan(textAt);
    expect(partBody(mime, 'text/plain')).toContain(footerUrl);
    expect(partBody(mime, 'text/html')).toBe(footerHtml);
    expect(mime.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
  });

  it('nests the alternative inside multipart/mixed when there are attachments', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-a' }) });
    await dispatchEmail(gmailSender, {
      ...payload,
      html: footerHtml,
      attachments: [{ filename: 'run-sheet.pdf', content: Buffer.from('pdf') }],
    });
    const mime = gmailMime();
    const head = headerBlock(mime);
    const mixed = /Content-Type: multipart\/mixed; boundary="([^"]+)"/.exec(head)?.[1];
    expect(mixed).toBeTruthy();
    const alt = /Content-Type: multipart\/alternative; boundary="([^"]+)"/.exec(mime)?.[1];
    expect(alt).toBeTruthy();
    expect(alt).not.toBe(mixed);
    // The alternative is a part of the mixed body, not a top-level header.
    expect(head).not.toContain('multipart/alternative');
    const altAt = mime.indexOf('multipart/alternative');
    const attachmentAt = mime.indexOf('filename="run-sheet.pdf"');
    expect(mime.indexOf('text/plain')).toBeGreaterThan(altAt);
    expect(attachmentAt).toBeGreaterThan(mime.indexOf(`--${alt}--`));
  });

  it('keeps Microsoft Graph html-only: sendMail takes one body', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    await dispatchEmail(outlookSender, { ...payload, html: footerHtml });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.message.body).toEqual({ contentType: 'HTML', content: footerHtml });
  });
});

describe('dispatchEmail header hardening (M5)', () => {
  it('strips CR and LF from every Gmail header value, so no header can be injected', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-h' }) });
    const evilSender: ResolvedSender = {
      transport: 'oauth',
      from: '"Jane\r\nBcc: spy@evil.test" <jane@gmail.com>',
      oauth: { provider: 'google', accessToken: 'tok-g' },
    };
    await dispatchEmail(evilSender, {
      to: 'couple@example.com\r\nBcc: spy@evil.test',
      subject: 'Hello Sarah\r\nBcc: spy@evil.test',
      html: '<p>Hi</p>',
      replyTo: 'mc@example.com\nX-Evil: 1',
      cc: ['vendor@example.com\rX-Evil: 2'],
      bcc: 'mc@example.com\n\nbody-start',
      attachments: [{ filename: 'a"\r\nX-Evil: 3.pdf', content: Buffer.from('x') }],
    });
    const mime = gmailMime();
    // No line of the message may start a header the caller did not build.
    const lines = mime.split('\r\n');
    expect(lines.some((line) => /^Bcc: spy@evil\.test/.test(line))).toBe(false);
    expect(lines.some((line) => /^X-Evil:/.test(line))).toBe(false);
    expect(lines.some((line) => line === 'body-start')).toBe(false);
    // The values survive, flattened onto their own line.
    const head = headerBlock(mime);
    expect(head).toContain('Subject: Hello Sarah Bcc: spy@evil.test');
    expect(head).toContain('From: "Jane Bcc: spy@evil.test" <jane@gmail.com>');
    // No bare CR or LF anywhere in the header block other than the CRLF separators.
    for (const line of head.split('\r\n')) expect(line).not.toMatch(/[\r\n]/);
    // The quoted filename cannot close its own quotes either.
    expect(mime).toMatch(/filename="a X-Evil: 3\.pdf"/);
  });

  it('strips other control characters but keeps a tab', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-c' }) });
    await dispatchEmail(gmailSender, { ...payload, subject: 'A\u0000B\u0007C\tD\u007fE' });
    expect(headerBlock(gmailMime())).toContain('Subject: A B C\tD E');
  });

  it('still encodes a non-ASCII subject after stripping', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-u' }) });
    await dispatchEmail(gmailSender, { ...payload, subject: 'Café\r\nBcc: x@y.test' });
    const encoded = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(headerBlock(gmailMime()))?.[1];
    expect(Buffer.from(encoded!, 'base64').toString('utf8')).toBe('Café Bcc: x@y.test');
  });
});

describe('dispatchEmail failure codes', () => {
  it('carries the Resend error name as the code', async () => {
    resendSendMock.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad to' } });
    expect(await dispatchEmail(resendSender, payload)).toEqual({
      ok: false,
      error: 'bad to',
      code: 'validation_error',
    });
  });

  it('carries the Graph error code as the code', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'ErrorInvalidRecipients', message: 'x@y.test is invalid' } }),
    });
    expect(await dispatchEmail(outlookSender, payload)).toEqual({
      ok: false,
      error: 'x@y.test is invalid',
      code: 'ErrorInvalidRecipients',
    });
  });

  it('never lets a code carry anything but a short token', async () => {
    resendSendMock.mockResolvedValue({ data: null, error: { name: 'bad name with x@y.test', message: 'm' } });
    const res = await dispatchEmail(resendSender, payload);
    expect(res.code).toBe('unknown');
  });
});

describe('MIME transfer encoding and non-ASCII headers (fix round 1)', () => {
  it('base64-encodes both alternative parts, so no line of the message passes 998 characters', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-l' }) });
    // One 5,000-character line: what a TipTap body with no newlines looks like.
    const long = `<p>${'Zoë '.repeat(1250)}<a href="${footerUrl}">Unsubscribe</a></p>`;
    await dispatchEmail(gmailSender, { ...payload, html: long });
    const mime = gmailMime();
    for (const line of mime.split('\r\n')) expect(line.length).toBeLessThanOrEqual(998);
    expect(mime.match(/Content-Transfer-Encoding: base64/g)).toHaveLength(2);
    // The content survives the round trip, accents and unsubscribe URL included.
    expect(partBody(mime, 'text/html')).toBe(long);
    expect(partBody(mime, 'text/plain')).toContain(`Unsubscribe (${footerUrl})`);
    expect(partBody(mime, 'text/plain')).toContain('Zoë');
  });

  it('writes the text part with CRLF line ends, never a bare LF', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-n' }) });
    await dispatchEmail(gmailSender, { ...payload, html: '<p>One</p><p>Two</p>' });
    const text = partBody(gmailMime(), 'text/plain');
    expect(text).toBe('One\r\n\r\nTwo');
  });

  it('RFC 2047-encodes a non-ASCII From display name, keeping the address readable', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-f' }) });
    const zoe: ResolvedSender = { ...gmailSender, from: '"Zoë MC" <zoe@gmail.com>' };
    await dispatchEmail(zoe, payload);
    const from = /^From: (.*)$/m.exec(headerBlock(gmailMime()))?.[1];
    const word = /^=\?UTF-8\?B\?([^?]+)\?= <zoe@gmail\.com>$/.exec(from ?? '')?.[1];
    expect(word, from).toBeTruthy();
    expect(Buffer.from(word!, 'base64').toString('utf8')).toBe('Zoë MC');
  });

  it('leaves an ASCII From exactly as it was', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-a2' }) });
    await dispatchEmail(gmailSender, payload);
    expect(headerBlock(gmailMime())).toContain('From: "Jane" <jane@gmail.com>');
  });

  it('gives a non-ASCII attachment filename an RFC 2231 filename* beside an ASCII fallback', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'g-fn' }) });
    await dispatchEmail(gmailSender, {
      ...payload,
      attachments: [{ filename: 'Run sheet – Zoë.pdf', content: Buffer.from('x') }],
    });
    const mime = gmailMime();
    expect(mime).toContain(`filename*=UTF-8''${encodeURIComponent('Run sheet – Zoë.pdf')}`);
    expect(mime).toMatch(/filename="Run sheet _ Zo_\.pdf"/);
    // No RFC 2047 encoded-word inside a quoted `name=` (RFC 2047 section
    // 5 forbids it there): the same ASCII fallback, plus `name*` (RFC 2231)
    // for the full name, exactly as the disposition does.
    expect(mime).not.toMatch(/name="=\?UTF-8/);
    expect(mime).toMatch(/Content-Type: application\/octet-stream; name="Run sheet _ Zo_\.pdf"; name\*=UTF-8''/);
  });
});

describe('dispatchEmail Resend refusal code (fix round 1)', () => {
  it('names an unusable List-Unsubscribe URL in the code', async () => {
    const res = await dispatchEmail(resendSender, {
      ...payload,
      listUnsubscribeUrl: 'https://x.test/u\r\nX: 1',
    });
    expect(res).toMatchObject({ ok: false, code: 'invalid_unsubscribe_url' });
  });
});

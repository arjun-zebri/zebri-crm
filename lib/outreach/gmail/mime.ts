/**
 * Build the raw RFC 5322 message the Gmail API sends.
 *
 * multipart/alternative when there is an HTML part (the rich signature),
 * the same shape Gmail itself sends for anything composed in it, so it
 * reads as a personal email. The HTML mirrors the text line for line and
 * carries no tracking pixel. Follow-ups set
 * `In-Reply-To` / `References` so Gmail threads them under the first
 * email, the way a person's own follow-up looks.
 *
 * Pure.
 *
 * @module lib/outreach/gmail/mime
 */

/** Inputs for one outgoing email. */
export interface MimeInput {
  from: { name: string; email: string };
  to: string;
  subject: string;
  /** The text/plain part. */
  body: string;
  /** Optional text/html alternative. Without it the message is plain text only. */
  html?: string | null;
  /** RFC Message-ID of the message being followed up, for threading. */
  inReplyTo?: string | null;
  /** Message-ID to stamp on this message, so replies can be matched. */
  messageId: string;
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Refuse CR/LF in header values (header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Base64 a part body in 76-character lines, with CRLF line endings first. */
function base64Body(text: string): string {
  return Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{76}/g, '$&\r\n');
}

/** Build the raw message and return it base64url-encoded for `users.messages.send`. */
export function buildRawEmail(input: MimeInput, boundary: string = `zb_${crypto.randomUUID().replace(/-/g, '')}`): string {
  const fromName = encodeHeader(headerSafe(input.from.name));
  const headers = [
    `From: ${fromName ? `${fromName} ` : ''}<${headerSafe(input.from.email)}>`,
    `To: <${headerSafe(input.to)}>`,
    `Subject: ${encodeHeader(headerSafe(input.subject))}`,
    `Message-ID: ${headerSafe(input.messageId)}`,
    'MIME-Version: 1.0',
    `List-Unsubscribe: <mailto:${headerSafe(input.from.email)}?subject=unsubscribe>`,
  ];
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${headerSafe(input.inReplyTo)}`, `References: ${headerSafe(input.inReplyTo)}`);
  }
  const textPart = ['Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64'];
  let raw: string;
  if (input.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    raw = [
      headers.join('\r\n'),
      '',
      `--${boundary}`, ...textPart, '', base64Body(input.body),
      `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', base64Body(input.html),
      `--${boundary}--`,
      '',
    ].join('\r\n');
  } else {
    raw = `${[...headers, ...textPart].join('\r\n')}\r\n\r\n${base64Body(input.body)}`;
  }
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/** A fresh Message-ID on the sender's domain. */
export function newMessageId(senderEmail: string, random: () => string = () => crypto.randomUUID()): string {
  const domain = senderEmail.split('@')[1] ?? 'zebri.com.au';
  return `<${random()}@${domain}>`;
}

/** Subject for a follow-up in the same thread. */
export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

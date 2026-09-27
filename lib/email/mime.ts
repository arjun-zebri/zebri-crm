/**
 * The raw RFC 822 message the Gmail transport sends.
 *
 * Gmail's send endpoint takes a whole message, headers and all, so this
 * is the one place in the app that writes header lines by hand. Two
 * things it guarantees:
 *
 * - **No header injection (audit M5).** Every header value (From and its
 *   display name, To, Cc, Bcc, Reply-To, Subject, and each attachment's
 *   filename) goes through {@link headerValue}, which removes CR, LF and
 *   every other C0 control character except tab. A couple name from a
 *   lead form or a contact address with a pasted `\r\n` can otherwise
 *   start a header of its own, a hidden `Bcc:` included. The Zod schemas
 *   refuse line breaks in names and addresses at the boundary
 *   (`lib/utils/single-line`); this is the backstop for anything that got
 *   in another way or before that rule existed.
 * - **A text/plain alternative (audit M2).** The body is
 *   multipart/alternative, text first and HTML last (RFC 2046: the part
 *   the client prefers goes last), nested inside multipart/mixed when
 *   there are attachments.
 * - **No line over 998 characters (fix round 1).** Both parts are base64,
 *   wrapped at 76, with a `Content-Transfer-Encoding` header. A TipTap
 *   body has no newlines at all, so sent raw it was one very long line
 *   that a relay enforcing RFC 5322 may hard-wrap, and a wrap mid-URL
 *   breaks the unsubscribe link. Base64 also declares the 8-bit UTF-8
 *   (accents, CJK) that raw parts sent as an implied 7bit.
 * - **Non-ASCII header text is encoded.** The subject and a From display
 *   name use RFC 2047 encoded-words; an attachment filename gets an RFC
 *   2231 `filename*` beside an ASCII fallback.
 *
 * Resend and Microsoft Graph take JSON, never raw header lines, so
 * neither needs this module.
 *
 * @module lib/email/mime
 */
import { randomUUID } from 'node:crypto';

/** One attachment, as the dispatch layer holds it. */
export interface MimeAttachment {
  filename: string;
  content: Buffer;
}

/** Everything {@link buildMime} writes into the message. */
export interface MimeMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | undefined;
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  attachments?: MimeAttachment[] | undefined;
  /** Already validated by `validateHeaderUrl`; written as given. */
  listUnsubscribeUrl?: string | null | undefined;
}

/**
 * Make `value` safe to place on one header line.
 *
 * Each CR, LF (a CRLF pair counts once) and other C0 control or DEL
 * becomes a single space rather than being deleted outright, so
 * "Sarah\nJake" reads "Sarah Jake" instead of "SarahJake". Tab is legal
 * in a header and kept.
 */
export function headerValue(value: string): string {
  return value.replace(/\r\n|[\x00-\x08\x0a-\x1f\x7f]/g, ' ').trim();
}

/** True when `value` has any character outside ASCII. */
function hasNonAscii(value: string): boolean {
  return /[^\x00-\x7F]/.test(value);
}

/** RFC 2047 encoded-word for a header value that may contain non-ASCII. */
function encodeHeaderWord(value: string): string {
  if (!hasNonAscii(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/**
 * A From (or any `Name <address>`) value with a non-ASCII display name
 * encoded. The address itself is ASCII and stays readable; an encoded
 * word may not sit inside quotes, so the quotes go.
 */
function encodeMailbox(value: string): string {
  const clean = headerValue(value);
  if (!hasNonAscii(clean)) return clean;
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(clean);
  if (!match) return encodeHeaderWord(clean);
  const name = (match[1] ?? '').trim().replace(/^"(.*)"$/, '$1');
  return name ? `${encodeHeaderWord(name)} <${match[2]}>` : `<${match[2]}>`;
}

/**
 * A filename's header parameters: header-safe, with no quote or
 * backslash that could close the quotes early. A non-ASCII name gets
 * `filename*=UTF-8''...` (RFC 2231), which modern clients prefer, beside
 * an ASCII fallback for the rest, and the Content-Type `name` gets the
 * same pair. Not an RFC 2047 encoded-word inside the quoted `name=`: RFC
 * 2047 section 5 forbids one inside a quoted-string, and a strict parser
 * shows it literally.
 */
function filenameParams(filename: string): { name: string; disposition: string } {
  const clean = headerValue(filename).replace(/["\\]/g, '');
  if (!hasNonAscii(clean)) return { name: `name="${clean}"`, disposition: `filename="${clean}"` };
  const fallback = clean.replace(/[^\x20-\x7E]/g, '_');
  const extended = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return {
    name: `name="${fallback}"; name*=UTF-8''${extended}`,
    disposition: `filename="${fallback}"; filename*=UTF-8''${extended}`,
  };
}

/** Base64 of `content`, wrapped at 76 characters per line (RFC 2045). */
function base64Lines(content: Buffer): string {
  return content.toString('base64').replace(/(.{76})/g, '$1\r\n');
}

/**
 * A text part in MIME canonical form: every line end CRLF, never a bare
 * LF (`htmlToText` joins lines with `\n`), before it is base64-encoded.
 */
function canonicalText(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

/** A boundary no body can contain by accident. */
function boundary(kind: 'alt' | 'mixed'): string {
  return `zebri_${kind}_${randomUUID().replace(/-/g, '')}`;
}

/** The text and HTML parts, as one multipart/alternative entity. */
function alternativeEntity(text: string, html: string): { contentType: string; body: string } {
  const alt = boundary('alt');
  const body = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(Buffer.from(canonicalText(text), 'utf8')),
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(Buffer.from(html, 'utf8')),
    `--${alt}--`,
  ].join('\r\n');
  return { contentType: `multipart/alternative; boundary="${alt}"`, body };
}

/** Build the whole message: headers, a blank line, then the body. */
export function buildMime(message: MimeMessage): string {
  const addresses = (list: string[]) => list.map(headerValue).join(', ');
  const headers: string[] = [
    `From: ${encodeMailbox(message.from)}`,
    `To: ${addresses(message.to)}`,
    `Subject: ${encodeHeaderWord(headerValue(message.subject))}`,
    'MIME-Version: 1.0',
  ];
  if (message.replyTo) headers.push(`Reply-To: ${headerValue(message.replyTo)}`);
  if (message.cc?.length) headers.push(`Cc: ${addresses(message.cc)}`);
  if (message.bcc?.length) headers.push(`Bcc: ${addresses(message.bcc)}`);
  if (message.listUnsubscribeUrl) {
    headers.push(`List-Unsubscribe: <${message.listUnsubscribeUrl}>`);
    headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  }

  const alternative = alternativeEntity(message.text, message.html);
  if (!message.attachments?.length) {
    headers.push(`Content-Type: ${alternative.contentType}`);
    return `${headers.join('\r\n')}\r\n\r\n${alternative.body}`;
  }

  const mixed = boundary('mixed');
  headers.push(`Content-Type: multipart/mixed; boundary="${mixed}"`);
  const parts: string[] = [`--${mixed}`, `Content-Type: ${alternative.contentType}`, '', alternative.body];
  for (const a of message.attachments) {
    const params = filenameParams(a.filename);
    parts.push(
      `--${mixed}`,
      `Content-Type: application/octet-stream; ${params.name}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${params.disposition}`,
      '',
      base64Lines(a.content),
    );
  }
  parts.push(`--${mixed}--`);
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

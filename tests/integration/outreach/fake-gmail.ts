/**
 * In-memory stand-in for `GmailClient`, used by the outreach pipeline tests.
 *
 * Each test file wires it in with `vi.mock('@/lib/outreach/gmail/client')`,
 * keeping the real `GmailError` class (the send path checks `instanceof`).
 * Because the real class is only known inside that mock factory, the factory
 * hands it over through {@link bindGmailError}.
 *
 * The fake models Gmail's behaviour where the send path cares about it:
 * - a send can be dropped (never accepted), accepted with the response lost
 *   (the dangerous case), or refused with an HTTP status;
 * - `rfc822msgid:` search finds only messages that were really accepted;
 * - `from:(...)` search finds mail by sender, the way the fresh-reply sweep uses it;
 * - threads are the set of messages sharing a thread id, in arrival order.
 *
 * Test-only; state is module-level, so each test file gets its own copy.
 *
 * @module tests/integration/outreach/fake-gmail
 */
import { addressOf } from '@/lib/outreach/gmail/classify';
import type { GmailMessage, GmailThread } from '@/lib/outreach/gmail/client';

/** How the next `send` call misbehaves. Consumed one per call. */
export type SendFault =
  /** Gmail never accepted the message: the call times out with no response. */
  | { kind: 'timeout' }
  /** Gmail accepted the message, but the response was lost to a timeout. */
  | { kind: 'accepted-then-timeout' }
  /** Gmail answered with an error status; nothing was sent. */
  | { kind: 'status'; status: number };

/** One message in the fake mailbox (ours or inbound). */
export interface FakeMail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  /** The text/html part of a multipart send, or null for plain text. */
  html?: string | null;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  internalDate: number;
  /** Extra headers an inbound message carries (for example Content-Type on a bounce). */
  headers: Record<string, string>;
}

type GmailErrorCtor = new (message: string, status: number, permanent: boolean) => Error;

interface FakeState {
  ownEmail: string;
  mail: FakeMail[];
  /** Messages Gmail accepted from us, in send order. */
  sends: FakeMail[];
  sendCalls: number;
  faults: SendFault[];
  afterSendFaults: number;
  optOutFaults: number;
  alerts: { type: string; [k: string]: unknown }[];
  threadReads: string[];
  searches: string[];
  seq: number;
  GmailError: GmailErrorCtor | null;
}

const state: FakeState = {
  ownEmail: '',
  mail: [],
  sends: [],
  sendCalls: 0,
  faults: [],
  afterSendFaults: 0,
  optOutFaults: 0,
  alerts: [],
  threadReads: [],
  searches: [],
  seq: 0,
  GmailError: null,
};

/** Clear the mailbox and counters for a new test. */
export function resetFakeGmail(ownEmail: string): void {
  state.ownEmail = ownEmail.toLowerCase();
  state.mail = [];
  state.sends = [];
  state.sendCalls = 0;
  state.faults = [];
  state.afterSendFaults = 0;
  state.optOutFaults = 0;
  state.alerts = [];
  state.threadReads = [];
  state.searches = [];
  state.seq = 0;
}

/** Hand over the real `GmailError` class from inside the vi.mock factory. */
export function bindGmailError(ctor: GmailErrorCtor): void {
  state.GmailError = ctor;
}

/** Queue faults for the next send calls, in order. */
export function queueSendFaults(...faults: SendFault[]): void {
  state.faults.push(...faults);
}

/** Make the next `afterSend` call throw once (after Gmail accepted a send). */
export function failNextAfterSend(): void {
  state.afterSendFaults++;
}

/** Consumed by the wrapped `afterSend`: true when this call should throw. */
export function takeAfterSendFault(): boolean {
  if (state.afterSendFaults === 0) return false;
  state.afterSendFaults--;
  return true;
}

/** Make the next `optOut` call throw once, after it has already written its state. */
export function failNextOptOut(): void {
  state.optOutFaults++;
}

/** Consumed by the wrapped `optOut`: true when this call should throw. */
export function takeOptOutFault(): boolean {
  if (state.optOutFaults === 0) return false;
  state.optOutFaults--;
  return true;
}

/** Alerts the code under test raised (sendAlert is replaced by a recorder). */
export function recordedAlerts(): FakeState['alerts'] {
  return state.alerts;
}

/** Recorder used by the `@/lib/alerts/send-alert` mock. */
export function recordAlert(event: { type: string; [k: string]: unknown }): Promise<void> {
  state.alerts.push(event);
  return Promise.resolve();
}

/** Every message Gmail accepted from the connected mailbox. */
export function acceptedSends(): FakeMail[] {
  return [...state.sends];
}

/** Accepted sends to one address. */
export function sendsTo(address: string): FakeMail[] {
  return state.sends.filter((m) => m.to.toLowerCase() === address.toLowerCase());
}

/** Every thread id the code asked for, in order. */
export function threadReads(): string[] {
  return [...state.threadReads];
}

/** Every `send` call, including the ones that failed. */
export function sendCallCount(): number {
  return state.sendCalls;
}

/**
 * Put one of our earlier emails into a thread without going through the send
 * path. Used to set up a thread the reply poll should watch. Not counted as a send.
 */
export function seedOwnMail(input: { threadId: string; to: string; subject?: string; body?: string; rfcMessageId?: string }): FakeMail {
  const mail: FakeMail = {
    id: nextId('seed'),
    threadId: input.threadId,
    from: state.ownEmail,
    to: input.to,
    subject: input.subject ?? 'Hello Ava',
    body: input.body ?? 'First touch',
    rfcMessageId: input.rfcMessageId ?? `<${nextId('seedrfc')}@zebri.test>`,
    inReplyTo: null,
    internalDate: Date.now() - 3_600_000,
    headers: {},
  };
  state.mail.push(mail);
  return mail;
}

/** Put an inbound message into the mailbox. Defaults to arriving after any send so far. */
export function injectInbound(input: {
  from: string;
  threadId: string;
  subject?: string;
  body?: string;
  internalDate?: number;
  headers?: Record<string, string>;
  rfcMessageId?: string | null;
}): FakeMail {
  const mail: FakeMail = {
    id: nextId('in'),
    threadId: input.threadId,
    from: input.from,
    to: state.ownEmail,
    subject: input.subject ?? 'Re: hello',
    body: input.body ?? '',
    rfcMessageId: input.rfcMessageId ?? `<${nextId('rfc')}@example.com>`,
    inReplyTo: null,
    // Far enough ahead that it is later than any send made in the test.
    internalDate: input.internalDate ?? Date.now() + 60_000,
    headers: input.headers ?? {},
  };
  state.mail.push(mail);
  return mail;
}

function nextId(prefix: string): string {
  state.seq += 1;
  return `${prefix}${state.seq}`;
}

/** Decode a `=?UTF-8?B?...?=` header value; plain values pass through. */
function decodeHeader(value: string): string {
  const m = value.match(/^=\?UTF-8\?B\?(.+)\?=$/);
  return m ? Buffer.from(m[1]!, 'base64').toString('utf8') : value;
}

/** Split a header block and a base64 body; headers keyed lower-case. */
function splitPart(text: string): { headers: Map<string, string>; body: string } {
  const split = text.indexOf('\r\n\r\n');
  const headers = new Map<string, string>();
  for (const line of text.slice(0, split).split('\r\n')) {
    const i = line.indexOf(':');
    if (i > 0) headers.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim());
  }
  return { headers, body: text.slice(split + 4) };
}

/** Decode a base64 part body, ignoring its line breaks. */
function decodeBody(b64: string): string {
  return Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8');
}

/**
 * Read the headers, text body and (for multipart/alternative) HTML body the
 * app built into a raw RFC 5322 message, as Gmail would.
 */
function parseRaw(raw: string): { to: string; subject: string; messageId: string; inReplyTo: string | null; body: string; html: string | null } {
  const { headers, body: rest } = splitPart(Buffer.from(raw, 'base64url').toString('utf8'));
  let body = '';
  let html: string | null = null;
  const boundary = (headers.get('content-type') ?? '').match(/boundary="([^"]+)"/)?.[1];
  if (boundary) {
    for (const chunk of rest.split(`--${boundary}`).slice(1)) {
      if (chunk.startsWith('--')) break;
      const part = splitPart(chunk.replace(/^\r\n/, ''));
      const type = part.headers.get('content-type') ?? '';
      if (type.startsWith('text/plain')) body = decodeBody(part.body);
      if (type.startsWith('text/html')) html = decodeBody(part.body);
    }
  } else {
    body = decodeBody(rest);
  }
  return {
    to: (headers.get('to') ?? '').replace(/^<|>$/g, ''),
    subject: decodeHeader(headers.get('subject') ?? ''),
    messageId: headers.get('message-id') ?? '',
    inReplyTo: headers.get('in-reply-to') ?? null,
    body,
    html,
  };
}

function bare(rfcId: string): string {
  return rfcId.replace(/^<|>$/g, '');
}

function toGmailMessage(m: FakeMail): GmailMessage {
  const headers = [
    { name: 'From', value: m.from },
    { name: 'To', value: m.to },
    { name: 'Subject', value: m.subject },
    ...(m.rfcMessageId ? [{ name: 'Message-ID', value: m.rfcMessageId }] : []),
    ...Object.entries(m.headers).map(([name, value]) => ({ name, value })),
  ];
  return {
    id: m.id,
    threadId: m.threadId,
    internalDate: String(m.internalDate),
    payload: {
      mimeType: 'text/plain',
      headers,
      body: { data: Buffer.from(m.body, 'utf8').toString('base64url') },
    },
  };
}

/** The fake `GmailClient`. Constructed with a token it ignores. */
export class FakeGmailClient {
  constructor(accessToken: string) {
    // The fake accepts any token; the real client would use it for the Authorization header.
    void accessToken;
  }

  private error(message: string, status: number, permanent: boolean): Error {
    if (!state.GmailError) throw new Error('fake-gmail: bindGmailError was not called');
    return new state.GmailError(message, status, permanent);
  }

  async profileEmail(): Promise<string> {
    return state.ownEmail;
  }

  async send(raw: string, threadId?: string | null): Promise<{ id: string; threadId: string }> {
    state.sendCalls++;
    const fault = state.faults.shift();
    if (fault?.kind === 'timeout') throw this.error('Gmail request failed: timeout', 0, false);
    if (fault?.kind === 'status') throw this.error(`Gmail ${fault.status}: refused`, fault.status, fault.status === 401);

    const parsed = parseRaw(raw);
    const mail: FakeMail = {
      id: nextId('sent'),
      threadId: threadId ?? nextId('thread'),
      from: state.ownEmail,
      to: parsed.to,
      subject: parsed.subject,
      body: parsed.body,
      html: parsed.html,
      rfcMessageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo,
      internalDate: Date.now(),
      headers: {},
    };
    state.mail.push(mail);
    state.sends.push(mail);
    if (fault?.kind === 'accepted-then-timeout') throw this.error('Gmail request failed: timeout', 0, false);
    return { id: mail.id, threadId: mail.threadId };
  }

  async thread(threadId: string): Promise<GmailThread> {
    state.threadReads.push(threadId);
    const messages = state.mail
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.internalDate - b.internalDate)
      .map(toGmailMessage);
    if (messages.length === 0) throw this.error(`Gmail 404: no thread ${threadId}`, 404, false);
    return { id: threadId, messages };
  }

  async search(q: string, max = 100): Promise<{ id: string; threadId: string }[]> {
    state.searches.push(q);
    let hits: FakeMail[] = [];
    const rfc = q.match(/^rfc822msgid:(.+)$/);
    const from = q.match(/^from:\((.+?)\)/);
    if (rfc) {
      const want = bare(rfc[1]!.trim());
      hits = state.mail.filter((m) => m.rfcMessageId !== null && bare(m.rfcMessageId) === want);
    } else if (from) {
      const wanted = new Set(from[1]!.split(' OR ').map((a) => a.trim().toLowerCase()));
      hits = state.mail.filter((m) => m.from !== state.ownEmail && wanted.has(addressOf(m.from)));
    }
    return hits.slice(0, max).map((m) => ({ id: m.id, threadId: m.threadId }));
  }

  async message(id: string): Promise<GmailMessage> {
    const found = state.mail.find((m) => m.id === id);
    if (!found) throw this.error(`Gmail 404: no message ${id}`, 404, false);
    return toGmailMessage(found);
  }
}

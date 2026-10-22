/**
 * Classify inbound Gmail messages on outreach threads: a real reply, a
 * bounce, or an opt-out.
 *
 * Opt-out detection only reads the first few lines of the reply, above
 * any quoted text, so "STOP" in our own quoted footer never counts. The
 * founder ruled (2026-10-11) that a match auto-applies with an undo,
 * because the Spam Act requires honouring it within five business days.
 *
 * Pure.
 *
 * @module lib/outreach/gmail/classify
 */

/** Header subset the classifier reads. */
export interface InboundHeaders {
  from: string;
  contentType?: string | null;
  autoSubmitted?: string | null;
  subject?: string | null;
}

/** What an inbound message means for the sequence. */
export type InboundKind = 'reply' | 'bounce' | 'auto_reply' | 'own';

/** Bare lower-cased address from a From header (`"Jane" <jane@x.com>` → `jane@x.com`). */
export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1]! : from).trim().toLowerCase();
}

/** Classify one inbound message on an outreach thread. */
export function classifyInbound(h: InboundHeaders, ownEmail: string): InboundKind {
  const from = addressOf(h.from);
  if (from === ownEmail.toLowerCase()) return 'own';
  if (/^(mailer-daemon|postmaster)@/i.test(from) || /multipart\/report|delivery-status/i.test(h.contentType ?? '')) {
    return 'bounce';
  }
  // Out-of-office replies are not engagement and must not stop the sequence.
  if ((h.autoSubmitted && h.autoSubmitted.toLowerCase() !== 'no') ||
      /\b(out of (the )?office|auto(matic)?[- ]?reply|away from (my )?(email|desk))\b/i.test(h.subject ?? '')) {
    return 'auto_reply';
  }
  return 'reply';
}

/** The reply's own text: lines above the first quote marker. */
export function replyLead(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^>/.test(line) || /^On .+wrote:\s*$/.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From: /.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * Lower-case, ASCII-ish, punctuation as spaces. Keeps apostrophes so
 * "don't" still matches. Pure.
 */
function normaliseLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Subject prefixes ("Re:", "Fwd:") that carry no meaning for opt-outs. */
function stripSubjectPrefixes(subject: string): string {
  return normaliseLine(subject).replace(/^((re|fwd?|fw) )+/, '');
}

/**
 * A line that is nothing but a stop request, optionally polite. "Stop by
 * Thursday?" is not a match: a bare "stop" only counts as the whole line.
 */
const WHOLE_LINE_STOP_RE =
  /^(please )?(stop|unsubscribe|opt ?out|remove me|take me off|no more emails?|stop (emailing|contacting|messaging|sending)( me| emails| messages)?|(don't|do not) (contact|email|message) me( again| anymore)?)( (from|off) (your|the|this)? ?(mailing )?(list|emails?))?( please| thanks| thank you| thx| cheers)?$/;

/**
 * Stop requests that are unambiguous inside a sentence. Only tried on a
 * short reply, so a long conversation that happens to mention a list
 * doesn't stop a sequence. The lookahead keeps "don't contact me until
 * Monday" (a request to pause) from counting as a stop.
 */
const IN_SENTENCE_STOP_RE =
  /\b(remove me from (your|the|this) ([a-z]+ )?(list|mailing list|database|emails?)|take me off (your|the|this) ([a-z]+ )?(list|mailing list)|(please )?(don't|do not|dont) (contact|email|message) me(?! (until|till|before|for|this|next|on|at))( again| anymore| any more)?|stop (contacting|emailing|messaging) me|no more (emails?|messages?)|unsubscribe me|opt me out|never contact me)\b/;

/** A reply longer than this is a conversation, not an opt-out. */
const SHORT_REPLY_WORDS = 40;

/**
 * True when the reply (or its subject) asks to stop being contacted.
 *
 * Checked: the subject (a List-Unsubscribe mailto arrives as subject
 * "unsubscribe" with an empty body), then the reply's own lines above any
 * quote. A whole line counts when it is a stop request; a phrase inside a
 * short reply counts when it is unambiguous ("not interested, remove me
 * from your list").
 */
export function isOptOut(body: string, subject?: string | null): boolean {
  if (subject && WHOLE_LINE_STOP_RE.test(stripSubjectPrefixes(subject))) return true;
  const lead = replyLead(body);
  const lines = lead.split(/\r?\n/).map(normaliseLine).filter(Boolean);
  if (lines.slice(0, 3).some((l) => WHOLE_LINE_STOP_RE.test(l))) return true;
  const all = lines.join(' ');
  if (all.split(' ').length > SHORT_REPLY_WORDS) return false;
  return IN_SENTENCE_STOP_RE.test(all);
}

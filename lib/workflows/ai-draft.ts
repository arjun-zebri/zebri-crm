/**
 * Rewrite one held email, in the MC's own voice.
 *
 * The review gate already puts the real message in front of the MC
 * before it goes. The gap it leaves is what happens when the message is
 * nearly right: the MC either sends something slightly wrong or retypes
 * it. This closes that gap with one instruction ("warmer", "mention the
 * venue changed", "shorter") applied to the copy already on screen.
 *
 * Deliberately narrow: it rewrites a subject and a body and returns
 * them for the MC to read. It cannot send, cannot touch the saved
 * template, and cannot edit the workflow. The MC still presses Send.
 *
 * The prompt building and the response parsing live here, away from the
 * route, so both are unit-testable without an API key.
 *
 * @module lib/workflows/ai-draft
 */

/** Everything the model is told about the message it is rewriting. */
export interface DraftRequest {
  /** What the MC asked for, in their words. */
  instruction: string;
  /** The subject currently on screen, already rendered. */
  subject: string;
  /** The body currently on screen, already rendered. */
  body: string;
  /** Step title, which often carries the intent ("Two week check-in"). */
  stepTitle: string;
  /** Who it goes to, when known. */
  coupleName?: string | null;
  /** Wedding date as a friendly string, when the couple has one. */
  weddingDate?: string | null;
  /** The MC's own name, so the sign-off stays theirs. */
  senderName?: string | null;
}

/** The rewritten message. */
export interface DraftResult {
  subject: string;
  body: string;
}

/**
 * The system prompt.
 *
 * Wedding MCs and celebrants write to couples at one of the more
 * emotionally loaded moments of their lives, and the failure mode of a
 * generic assistant here is corporate warmth: exclamation marks,
 * "excited to partner with you", em dashes everywhere. The prompt
 * spends most of its length ruling that out.
 */
export const DRAFT_SYSTEM_PROMPT = `You rewrite emails for a wedding MC or celebrant writing to a couple they are working with.

How they write:
- Plain, warm and direct. Like a person who has done a hundred weddings and is glad to be doing this one.
- Short sentences. No corporate filler, no "I hope this email finds you well", no "excited to partner with you".
- Australian spelling and phrasing.
- Never use em dashes. Use a comma, a full stop or a new sentence instead.
- No exclamation marks unless the original had one.
- No emoji.

Rules:
- Keep any {{variable}} placeholders exactly as they appear. They are filled in automatically and breaking one breaks the send.
- Keep every fact from the original: dates, times, prices, links, attachments, questions asked. You are changing the wording, not the content, unless the instruction explicitly asks for a change.
- Keep roughly the same length unless asked to make it shorter or longer.
- Keep the sign-off name the same.
- Do not add a subject line into the body.

Reply in exactly this format, with nothing before or after:
SUBJECT: <the subject line>
BODY:
<the message body>`;

/** Compose the user turn from the message and the instruction. */
export function buildDraftPrompt(req: DraftRequest): string {
  const facts = [
    `Step: ${req.stepTitle || 'Email'}`,
    req.coupleName ? `Couple: ${req.coupleName}` : null,
    req.weddingDate ? `Wedding date: ${req.weddingDate}` : null,
    req.senderName ? `Sent by: ${req.senderName}` : null,
  ].filter(Boolean);

  return [
    `<context>\n${facts.join('\n')}\n</context>`,
    `<current_subject>\n${req.subject}\n</current_subject>`,
    `<current_body>\n${req.body}\n</current_body>`,
    `<instruction>\n${req.instruction}\n</instruction>`,
  ].join('\n\n');
}

/**
 * Pull the subject and body back out of the model's reply.
 *
 * Falls back to the copy that went in rather than throwing: a model
 * that ignores the format should cost the MC a re-press, not an error
 * screen over a message they were about to send.
 *
 * @param text - the raw model reply
 * @param fallback - what was on screen, used for any part not returned
 */
export function parseDraft(text: string, fallback: DraftResult): DraftResult {
  const trimmed = text.trim();
  const subjectMatch = trimmed.match(/^\s*SUBJECT:\s*(.*)$/im);
  const bodyIndex = trimmed.search(/^\s*BODY:\s*$/im);

  // No BODY marker means the model answered in prose. Anything after a
  // SUBJECT line is still more likely to be the message than not, so
  // take it; otherwise treat the whole reply as the body.
  let body: string;
  if (bodyIndex >= 0) {
    const after = trimmed.slice(bodyIndex);
    body = after.replace(/^\s*BODY:\s*\n?/i, '');
  } else if (subjectMatch) {
    body = trimmed.slice((subjectMatch.index ?? 0) + subjectMatch[0].length);
  } else {
    body = trimmed;
  }

  body = body.trim();
  const subject = subjectMatch?.[1]?.trim() ?? '';

  return {
    subject: subject.length > 0 ? subject : fallback.subject,
    body: body.length > 0 ? body : fallback.body,
  };
}

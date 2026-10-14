/**
 * Turn a queued email body into the two parts Gmail sends: plain text and
 * HTML, each with the footer (identity line, signature, opt-out line).
 *
 * Why at send time: the footer used to be baked into the body when the
 * email was queued, so a signature edit never reached emails already in
 * the queue. Now the queue holds the body alone and the signature is read
 * as the email goes out.
 *
 * @module lib/outreach/services/compose
 */
import type { JSONContent } from '@tiptap/core';

import { renderSignatureHtml } from '@/lib/email/signature';

import { OPT_OUT_LINE, textToHtml, withEmailFooter, withEmailFooterHtml } from '../render';
import { textToSignatureDoc } from '../signature';
import type { OutreachSettings } from '../types';

/** The two parts of one outgoing email. */
export interface ComposedEmail {
  /** text/plain part; also what is stored as the sent body. */
  text: string;
  /** text/html alternative. */
  html: string;
}

/**
 * Compose one email from its queued body and the current settings.
 *
 * A body that already ends with the opt-out line was queued before the
 * footer moved to send time. It is sent as it stands, so it never gets a
 * second footer.
 *
 * @param body - The rendered template text, as queued.
 * @param settings - Sender name and signature (rich document and its text copy).
 */
export function composeEmail(
  body: string,
  settings: Pick<OutreachSettings, 'sender_name' | 'signature' | 'signature_doc'>,
): ComposedEmail {
  if (body.trimEnd().endsWith(OPT_OUT_LINE)) {
    return { text: body, html: `<div dir="ltr">${textToHtml(body)}</div>` };
  }
  const doc = (settings.signature_doc as JSONContent | null) ?? textToSignatureDoc(settings.signature);
  return {
    text: withEmailFooter(body, settings.signature, settings.sender_name),
    html: withEmailFooterHtml(body, renderSignatureHtml(doc), settings.sender_name),
  };
}

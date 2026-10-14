/**
 * Fill a variant with the sample celebrant and check it for mistakes.
 *
 * The footer is added the same way the sender adds it, so the founder
 * sees the signature placeholder and the opt-out line exactly where a
 * recipient would. Pure.
 *
 * @module features/outreach/views/sequences/variant-preview
 */
import { countLinks, renderTemplate, templateFields, withEmailFooter } from '@/lib/outreach/render';

import { SAMPLE_SIGNATURE, SAMPLE_VALUES } from './merge-fields';
import type { Channel } from './sequence-draft';

/** A variant as the recipient would see it, with sample values filled in. */
export interface PreviewResult {
  subject: string;
  body: string;
  /** Fields with no value and no fallback. Shown when a template is broken. */
  missing: string[];
}

/**
 * Render a variant against the sample celebrant. When a field can't be
 * filled, the raw template is shown instead of a half-filled message,
 * so the gap is visible.
 */
export function previewVariant(channel: Channel, subject: string, body: string): PreviewResult {
  const b = renderTemplate(body, SAMPLE_VALUES);
  const s = renderTemplate(subject, SAMPLE_VALUES);
  const missing = [...new Set([...(b.ok ? [] : b.missing), ...(s.ok ? [] : s.missing)])];
  const text = b.ok ? b.text : body;
  return {
    subject: s.ok ? s.text : subject,
    body: channel === 'email' ? withEmailFooter(text, SAMPLE_SIGNATURE, SAMPLE_VALUES.sender_name ?? '') : text,
    missing,
  };
}

/**
 * Plain-language warnings for one variant. Warnings never block the save:
 * an unknown field still saves, and the founder decides what to do.
 *
 * Link count runs on the rendered text, because `{{booking_link}}` only
 * becomes a URL once it is filled in.
 */
export function variantWarnings(channel: Channel, subject: string, body: string): string[] {
  const warnings: string[] = [];
  const unknown = [...new Set([...templateFields(body).unknown, ...templateFields(subject).unknown])];
  if (unknown.length > 0) {
    warnings.push(`Unknown merge field: ${unknown.map((u) => `{{${u}}}`).join(', ')}.`);
  }
  if (channel === 'email' && countLinks(previewVariant(channel, subject, body).body) > 1) {
    // Why: several links are a common spam signal, so the founder should know before sending.
    warnings.push('Emails with more than one link land in spam more often.');
  }
  return warnings;
}

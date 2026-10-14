/**
 * The outreach signature as a rich document (the same TipTap JSON as
 * Settings > Signature) and its plain-text copy.
 *
 * Every email goes out as HTML with a plain-text alternative. The HTML
 * part shows the document as designed; the text part, and the Spam Act
 * contact-details check, use {@link signatureDocToText}. A link keeps its
 * address in the text copy, so a phone number or website behind a label
 * still counts as a way to reach the sender.
 *
 * Pure.
 *
 * @module lib/outreach/signature
 */
import type { JSONContent } from '@tiptap/core';

/** Block nodes that start a new line in the text copy. */
const LINE_BLOCKS = new Set(['paragraph', 'heading', 'blockquote', 'listItem']);

/** Strip `mailto:` / `tel:` so the text copy shows the address or number itself. */
function hrefLabel(href: string): string {
  return href.replace(/^(mailto|tel):/i, '');
}

/** Inline text of one block: marks dropped, links kept with their address. */
function inlineText(node: JSONContent): string {
  if (node.type === 'text') {
    const text = node.text ?? '';
    const link = node.marks?.find((m) => m.type === 'link');
    const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : '';
    if (!href) return text;
    const label = hrefLabel(href);
    // Why: "Website" alone is useless in plain text; a bare URL is already its own label.
    return text.trim() === label || text.trim() === href ? text : `${text} <${label}>`;
  }
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineText).join('');
}

/** Collect each line-starting block's text, depth first. Images contribute nothing. */
function collectLines(node: JSONContent, out: string[]): void {
  if (node.type && LINE_BLOCKS.has(node.type) && !(node.content ?? []).some((c) => c.type && LINE_BLOCKS.has(c.type))) {
    out.push(inlineText(node));
    return;
  }
  for (const child of node.content ?? []) collectLines(child, out);
}

/**
 * Plain-text copy of a signature document: one line per paragraph,
 * formatting dropped, link addresses kept, images left out.
 *
 * @returns The text, trimmed; `''` for an empty or missing document.
 */
export function signatureDocToText(doc: JSONContent | null | undefined): string {
  if (!doc) return '';
  const lines: string[] = [];
  collectLines(doc, lines);
  return lines.map((l) => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * A document for a signature saved before the rich editor: one paragraph
 * per line. Used once, when the settings form first loads an old signature.
 */
export function textToSignatureDoc(text: string): JSONContent {
  const lines = text.trim() === '' ? [''] : text.trim().split(/\r?\n/);
  return {
    type: 'doc',
    content: lines.map((line) => (line === '' ? { type: 'paragraph' } : { type: 'paragraph', content: [{ type: 'text', text: line }] })),
  };
}

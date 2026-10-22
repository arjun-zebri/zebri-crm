import type { JSONContent } from '@tiptap/core';

import type { EmailBlock } from '../../email/email-data';

/**
 * A journey email's content as the editor holds it (TipTap JSON: text,
 * `variable` chips and the email blocks in `email-nodes.tsx`) and the
 * ways in and out of it: Zebri's drafts are written as plain text with
 * `{field}`s, so `textToDoc` turns one into a document (a paragraph per
 * blank-line break, a chip per field, the email's button last); and
 * `docToBlocks` turns a document into the blocks `EmailBody` draws, a
 * chip back into `{field}` for it to fill. The subject is one line of
 * the same text and chips, kept as a string (`lineToDoc`, `docToLine`).
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-doc
 */

/** "Hi {first names}," as text and chips. */
export function inlineOf(text: string): JSONContent[] {
  return text
    .split(/(\{[^}]+\}|\n)/)
    .filter(Boolean)
    .map((part) => {
      if (part === '\n') return { type: 'hardBreak' };
      const token = /^\{([^}]+)\}$/.exec(part)?.[1];
      return token ? { type: 'variable', attrs: { id: token } } : { type: 'text', text: part };
    });
}

/** Text and chips back into "Hi {first names},". */
function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'variable') return `{${String(node.attrs?.id ?? '')}}`;
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(textOf).join('');
}

/** A drafted body (paragraphs split by blank lines) as a document, with its button last. */
export function textToDoc(body: string, button?: string | null): JSONContent {
  const paragraphs = body
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => ({ type: 'paragraph', content: inlineOf(p) }));
  return { type: 'doc', content: [...paragraphs, ...(button ? [{ type: 'emailButton', attrs: { label: button, href: '' } }] : [])] };
}

/** The subject line as a one-paragraph document. */
export const lineToDoc = (line: string): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph', content: line ? inlineOf(line) : [] }] });

/** A one-line document back to the subject string. */
export const docToLine = (doc: JSONContent) => textOf(doc).replace(/\n/g, ' ');

/** A document as the blocks an email is drawn from. */
export function docToBlocks(doc: JSONContent): EmailBlock[] {
  return (doc.content ?? []).flatMap((n): EmailBlock[] => {
    const a = n.attrs ?? {};
    switch (n.type) {
      case 'paragraph': {
        const text = textOf(n);
        return text.trim() ? [{ kind: 'text', text }] : [];
      }
      case 'heading':
        return [{ kind: 'heading', text: textOf(n), level: a.level === 3 ? 3 : 2 }];
      case 'blockquote':
        return [{ kind: 'quote', text: (n.content ?? []).map(textOf).join('\n') }];
      case 'emailVideo':
        return [{ kind: 'video', caption: String(a.caption ?? ''), length: String(a.length ?? ''), thumb: a.thumb ? String(a.thumb) : undefined }];
      case 'emailSpacer':
        return [{ kind: 'spacer' }];
      case 'bulletList':
      case 'orderedList':
        return [{ kind: 'text', text: (n.content ?? []).map((li, i) => `${n.type === 'orderedList' ? `${i + 1}.` : '•'} ${textOf(li)}`).join('\n') }];
      case 'emailButton':
        return [{ kind: 'button', label: String(a.label ?? 'Button') }];
      case 'emailImage':
        return [{ kind: 'image', alt: String(a.alt ?? ''), tone: 'sky', src: a.src ? String(a.src) : undefined, header: Boolean(a.header) }];
      case 'horizontalRule':
        return [{ kind: 'divider' }];
      case 'emailPackages':
        return [{ kind: 'packages' }];
      case 'emailLink':
        return [{ kind: 'attachment', what: a.what === 'form' ? 'form' : 'document', name: String(a.name ?? 'Document'), note: String(a.note ?? '') }];
      default:
        return [];
    }
  });
}

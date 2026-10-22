import type { RichDoc } from '@/features/proposals';

/**
 * Turns variable chips into the words they stand for. A proposal is
 * written for one couple, so the MC should see "Mia & Leo" on the page,
 * never a "Couple name" chip (2026-10-04 audit). Templates keep their
 * variables; this runs when a section lands in a proposal.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/model/resolve-variables
 */

/** `doc` with every variable node replaced by its value (or its fallback), as plain text; an empty value is dropped. */
export function resolveDoc(doc: RichDoc, values: Record<string, string>): RichDoc {
  if (!doc.content) return doc;
  const content = doc.content.flatMap((c): RichDoc[] => {
    if (c.type !== 'variable') return [resolveDoc(c, values)];
    const attrs = (c.attrs ?? {}) as { id?: string; fallback?: string };
    const value = (attrs.id ? values[attrs.id] : '') || attrs.fallback || '';
    return value ? [{ type: 'text', text: value }] : [];
  });
  return { ...doc, content: mergeText(content) };
}

/** Joins neighbouring unmarked text nodes, so a resolved value reads as one run of words. */
function mergeText(nodes: RichDoc[]): RichDoc[] {
  const out: RichDoc[] = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && n.type === 'text' && !prev.marks && !n.marks) out[out.length - 1] = { ...prev, text: `${prev.text ?? ''}${n.text ?? ''}` };
    else out.push(n);
  }
  return out;
}

/** `section` with its text (content and intro) resolved for one couple. */
export function resolveSection<S extends { content?: RichDoc | undefined; intro?: RichDoc | undefined }>(section: S, values: Record<string, string>): S {
  return {
    ...section,
    ...(section.content ? { content: resolveDoc(section.content, values) } : {}),
    ...(section.intro ? { intro: resolveDoc(section.intro, values) } : {}),
  };
}

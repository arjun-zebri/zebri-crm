'use client';

import { Extension, type Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

import { DocumentsIcon, Heading2Icon, ListChecksIcon, Heading3Icon, ImageIcon, ListIcon, ListOrderedIcon, MinusIcon, MoveVerticalIcon, PackageIcon, PanelTopIcon, PlayCircleIcon, QuoteIcon, RectangleIcon, TextIcon } from '@/components/ui-v2/icons';


import { FIELDS } from '../../email/email-data';
import { FIELD_MARK } from '../../email/render/email-body';

import { suggestion, type ListItem } from './floating-list';

/**
 * What a journey email's two triggers offer, as production's proposal
 * editor does. `@` lists the fields that fill in per client; picking one
 * puts it in as a green chip. `/` lists the sections an email is built
 * from, grouped (Text, Media, Content), then the fields again at the
 * bottom, so `/` alone reaches everything. A section picked on an empty
 * line takes that line's place; one picked mid-paragraph goes in under it.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-suggest
 */

/**
 * Puts a block in with a line to keep writing on under it, and the caret
 * on that line. On an empty top-level line it takes the line's place;
 * after a picked block it goes under the block, not over it; anywhere
 * else it goes under the caret's top-level block, never splitting it (a
 * plain insert left the caret on the text after the block, so the next
 * `/quote` wrapped that text, live-found 2026-10-08).
 */
function put(e: Editor, block: Record<string, unknown>) {
  e.chain()
    .focus()
    .command(({ tr, state }) => {
      const s = tr.selection;
      const $f = s.$from;
      const empty = !(s instanceof NodeSelection) && $f.depth === 1 && $f.parent.content.size === 0;
      const from = s instanceof NodeSelection || !$f.depth ? s.to : empty ? $f.before(1) : $f.after(1);
      const nodes = [state.schema.nodeFromJSON(block), state.schema.nodes.paragraph!.create()];
      tr.replaceWith(from, empty ? $f.after(1) : from, nodes);
      tr.setSelection(TextSelection.create(tr.doc, from + nodes[0]!.nodeSize + 1));
      return true;
    })
    .run();
}

/** A field as a list row: its green tag and sample value. */
const fieldItem = (f: (typeof FIELDS)[number], group?: string): ListItem => ({
  id: `field:${f.token}`,
  label: f.token,
  group,
  tag: <span className={FIELD_MARK}>{f.token}</span>,
  aside: f.sample,
  run: (e) => e.chain().focus().insertContent([{ type: 'variable', attrs: { id: f.token } }, { type: 'text', text: ' ' }]).run(),
});

/** Every section, in the order the `/` list shows them. */
const SECTIONS: ListItem[] = [
  { id: 'heading', label: 'Heading', group: 'Text', icon: Heading2Icon, run: (e) => e.chain().focus().setNode('heading', { level: 2 }).run() },
  { id: 'subheading', label: 'Subheading', group: 'Text', icon: Heading3Icon, run: (e) => e.chain().focus().setNode('heading', { level: 3 }).run() },
  { id: 'text', label: 'Text', group: 'Text', icon: TextIcon, run: (e) => e.chain().focus().setParagraph().run() },
  { id: 'bullets', label: 'Bulleted list', group: 'Text', icon: ListIcon, run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'numbers', label: 'Numbered list', group: 'Text', icon: ListOrderedIcon, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'quote', label: 'Quote', group: 'Text', icon: QuoteIcon, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'header', label: 'Header photo', group: 'Media', icon: PanelTopIcon, run: (e) => put(e, { type: 'emailImage', attrs: { header: true } }) },
  { id: 'image', label: 'Image', group: 'Media', icon: ImageIcon, run: (e) => put(e, { type: 'emailImage' }) },
  { id: 'video', label: 'Video', group: 'Media', icon: PlayCircleIcon, run: (e) => put(e, { type: 'emailVideo' }) },
  { id: 'button', label: 'Button', group: 'Content', icon: RectangleIcon, run: (e) => put(e, { type: 'emailButton' }) },
  { id: 'divider', label: 'Divider', group: 'Content', icon: MinusIcon, run: (e) => put(e, { type: 'horizontalRule' }) },
  { id: 'spacer', label: 'Spacer', group: 'Content', icon: MoveVerticalIcon, run: (e) => put(e, { type: 'emailSpacer' }) },
  { id: 'packages', label: 'Your packages', group: 'Content', icon: PackageIcon, run: (e) => put(e, { type: 'emailPackages' }) },
  { id: 'document', label: 'Document link', group: 'Content', icon: DocumentsIcon, run: (e) => put(e, { type: 'emailLink' }) },
  { id: 'form', label: 'Form link', group: 'Content', icon: ListChecksIcon, run: (e) => put(e, { type: 'emailLink', attrs: { name: 'Your questionnaire', what: 'form' } }) },
];

const match = (q: string) => (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());

/** `@`: the fields. */
export const FieldSuggest = Extension.create({
  name: 'emailFieldSuggest',
  addProseMirrorPlugins() {
    return [suggestion(this.editor, '@', (q) => FIELDS.filter((f) => match(q)(f.token)).map((f) => fieldItem(f)), 'No field called that')];
  },
});

/** `/`: the sections, then the fields. */
export const SectionSuggest = Extension.create({
  name: 'emailSectionSuggest',
  addProseMirrorPlugins() {
    return [
      suggestion(
        this.editor,
        '/',
        (q) => [...SECTIONS.filter((s) => match(q)(s.label)), ...FIELDS.filter((f) => match(q)(f.token)).map((f) => fieldItem(f, 'Fields'))],
        'Nothing called that',
      ),
    ];
  },
});

'use client';

import { Node, type JSONContent } from '@tiptap/core';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { EmailImage, EmailVideo } from './email-media';
import { EmailButton, EmailLink, EmailPackages, EmailSpacer, EmailVariable } from './email-nodes';
import { FieldSuggest, SectionSuggest } from './email-suggest';

/**
 * The two editors a journey email is written in, built the way
 * production's proposal editor is: the body takes `/` for a section
 * (headings, text, lists, a quote, a header photo, an image, a video, a
 * button, a divider, a spacer, the MC's packages, a document link) and
 * `@` for a field that fills in per client (`email-suggest.tsx`); the
 * subject is one line of text and fields (Enter does nothing). Both hand
 * back plain JSON on every change. The body's look (paragraph spacing,
 * headings, a quote with its bar, a divider as a hairline) is set on its
 * wrapper, so the editor reads exactly as the email will.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-editor
 */

/** Placeholder text, shown in an empty editor. */
const placeholder = (text: string) =>
  Placeholder.configure({ placeholder: text, showOnlyWhenEditable: true, showOnlyCurrent: true });

/** An editor's JSON as plain objects (TipTap attrs are null-prototype; see the TipTap RSC note in memory). */
const plain = (e: Editor) => JSON.parse(JSON.stringify(e.getJSON())) as JSONContent;

/** The body editor. */
export function useEmailEditor(content: JSONContent, onChange: (doc: JSONContent) => void): Editor | null {
  return useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, autolink: true, HTMLAttributes: { class: 'underline' } } }),
      placeholder('Type / to add a section, or @ for a field'),
      EmailVariable,
      EmailButton,
      EmailImage,
      EmailVideo,
      EmailPackages,
      EmailLink,
      EmailSpacer,
      FieldSuggest,
      SectionSuggest,
    ],
    content,
    immediatelyRender: false,
    // The toolbar shows what is on at the caret, so it redraws as the caret moves.
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'min-h-full outline-none', 'aria-label': 'Email' } },
    onUpdate: ({ editor }) => onChange(plain(editor)),
  });
}

/** One paragraph and nothing else: the subject line. */
const OneLine = Node.create({ name: 'doc', topNode: true, content: 'paragraph' });

/** The subject editor. */
export function useSubjectEditor(content: JSONContent, onChange: (doc: JSONContent) => void): Editor | null {
  return useEditor({
    extensions: [
      OneLine,
      StarterKit.configure({ document: false, heading: false, bulletList: false, orderedList: false, listItem: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false, hardBreak: false, trailingNode: false, bold: false, italic: false, strike: false, underline: false, link: false }),
      placeholder('Subject'),
      EmailVariable,
      FieldSuggest,
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'outline-none', 'aria-label': 'Subject' },
      // One line: Enter would start a second paragraph the subject cannot hold.
      handleKeyDown: (_view, e) => e.key === 'Enter',
    },
    onUpdate: ({ editor }) => onChange(plain(editor)),
  });
}

/** The empty-editor placeholder, drawn from `data-placeholder` (TipTap's Placeholder sets it). */
const EMPTY =
  '[&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:float-left [&_.is-empty::before]:h-0 [&_.is-empty::before]:text-zebra-400 [&_.is-empty::before]:content-[attr(data-placeholder)]';

/**
 * The body, styled as the email reads: every rule here mirrors a block in
 * `EmailBody` (text zebra-700, a heading in the brand's face and colour at
 * type-display, a subheading at type-heading, the quote's bar, 24px
 * between blocks). The editing surface is a text field, so, like every
 * v2 text field, it takes no focus mark: the caret is its focus.
 */
export function EmailEditorBody({ editor }: { editor: Editor | null }) {
  return (
    <EditorContent
      editor={editor}
      className={`type-body text-zebra-700 font-[family-name:var(--b-body)] [&_.ProseMirror]:min-h-40 [&_.ProseMirror]:space-y-6 [&_a]:text-[var(--b-primary)] [&_blockquote]:border-l-2 [&_blockquote]:border-zebra-950 [&_blockquote]:pl-5 [&_blockquote]:type-subheading [&_blockquote]:text-zebra-950 [&_h2]:type-display [&_h2]:text-[var(--b-primary)] [&_h2]:font-[family-name:var(--b-heading)] [&_h3]:type-heading [&_h3]:text-zebra-950 [&_hr]:my-6 [&_hr]:border-hairline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 ${EMPTY}`}
    />
  );
}

/** The subject, one line. */
export function SubjectEditorLine({ editor }: { editor: Editor | null }) {
  return <EditorContent editor={editor} className={`min-w-0 flex-1 type-label text-zebra-950 ${EMPTY}`} />;
}

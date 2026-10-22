'use client';

import Placeholder from '@tiptap/extension-placeholder';
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from '@tiptap/react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { FLOATING_BAR } from '@/components/ui-v2/control-styles';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  BoldIcon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
} from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { SIGNATURE_EXTENSIONS } from '@/lib/email/signature-extensions';

import { BarButton, BarRule } from '../doc-builder/editor/section-bar/bar-parts';

/**
 * The email signature, written the way production's is (user, 2026-10-15:
 * "the signature should be like the one currently in production"): a
 * Gmail / Outlook style rich-text block the MC writes themselves, not a
 * set of switches. Built on production's own extension set
 * (`SIGNATURE_EXTENSIONS`), so the JSON it saves renders the same through
 * `renderSignatureHtml` when an email goes out. A v2 toolbar over the
 * text (bold, italic, underline, lists, alignment, a link, an image by
 * its address), the editor on a white sheet with a hairline edge.
 *
 * @module app/design-system/v2/pages/dashboard/settings/signature-editor
 */

export interface SignatureEditorProps {
  /** The signature, as TipTap JSON. */
  value: JSONContent;
  /** Every edit, as TipTap JSON. */
  onChange: (value: JSONContent) => void;
  /**
   * Written in place, in an email as it is sent: no sheet, and the
   * toolbar floats over its top right (clear of the sign-off on the
   * left, and of the scrolling edge under it) only while it is being
   * written or one of its menus is open, so nothing moves as it shows.
   */
  inline?: boolean | undefined;
}

/** A field in a toolbar popover, then its button: the link and the image share it. */
function AskForm({
  label,
  start,
  action,
  onSave,
  onRemove,
}: {
  label: string;
  start: string;
  action: string;
  onSave: (value: string) => void;
  onRemove?: (() => void) | undefined;
}) {
  const [value, setValue] = useState(start);
  const ok = /^https?:\/\/\S+\.\S+/.test(value.trim()) || /^(mailto|tel):\S+/.test(value.trim());
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (ok) onSave(value.trim());
  };
  return (
    <form onSubmit={save} className="w-72 space-y-3">
      <Input
        boxed
        label={label}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {onRemove ? (
          <Button variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
        <Button type="submit" disabled={!ok}>
          {action}
        </Button>
      </div>
    </form>
  );
}

/** A toolbar button that opens a small form under it. */
function AskButton({
  label,
  on,
  icon,
  children,
}: {
  label: string;
  on: boolean;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <BarButton label={label} on={on || open} toggle={false}>
          {icon}
        </BarButton>
      </PopoverTrigger>
      <PopoverContent size="card" side="bottom" align="start" aria-label={label}>
        {open ? children(() => setOpen(false)) : null}
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, className = 'flex flex-wrap items-center gap-0.5 border-b border-hairline p-1' }: { editor: Editor; className?: string }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bullets: e.isActive('bulletList'),
      numbers: e.isActive('orderedList'),
      centre: e.isActive({ textAlign: 'center' }),
      href: (e.getAttributes('link').href as string | undefined) ?? null,
    }),
  });
  const run = (f: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
    f(editor.chain().focus()).run();
  const glyph = 'size-4';
  return (
    <div
      role="toolbar"
      aria-label="Signature formatting"
      className={className}
    >
      <BarButton label="Bold" on={s.bold} onClick={run((c) => c.toggleBold())}>
        <BoldIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarButton label="Italic" on={s.italic} onClick={run((c) => c.toggleItalic())}>
        <ItalicIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarButton label="Underline" on={s.underline} onClick={run((c) => c.toggleUnderline())}>
        <UnderlineIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarRule />
      <BarButton label="Bullet list" on={s.bullets} onClick={run((c) => c.toggleBulletList())}>
        <ListIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarButton label="Numbered list" on={s.numbers} onClick={run((c) => c.toggleOrderedList())}>
        <ListOrderedIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarRule />
      <BarButton label="Align left" on={!s.centre} onClick={run((c) => c.setTextAlign('left'))}>
        <AlignLeftIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarButton label="Centre" on={s.centre} onClick={run((c) => c.setTextAlign('center'))}>
        <AlignCenterIcon aria-hidden="true" className={glyph} />
      </BarButton>
      <BarRule />
      <AskButton
        label="Link"
        on={Boolean(s.href)}
        icon={<LinkIcon aria-hidden="true" className={glyph} />}
      >
        {(close) => (
          <AskForm
            label="Link"
            start={s.href ?? 'https://'}
            action="Save"
            onSave={(href) => (
              editor.chain().focus().extendMarkRange('link').setLink({ href }).run(),
              close()
            )}
            onRemove={
              s.href
                ? () => (editor.chain().focus().extendMarkRange('link').unsetLink().run(), close())
                : undefined
            }
          />
        )}
      </AskButton>
      <AskButton
        label="Image"
        on={false}
        icon={<ImagePlusIcon aria-hidden="true" className={glyph} />}
      >
        {(close) => (
          <AskForm
            label="Image address"
            start="https://"
            action="Add image"
            onSave={(src) => (editor.chain().focus().setImage({ src }).run(), close())}
          />
        )}
      </AskButton>
    </div>
  );
}

/** The written text's look: the body type, links underlined, lists marked, the empty placeholder. */
const SHEET_TEXT =
  'type-body text-zebra-950 [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-zebra-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_a]:text-zebra-950 [&_a]:underline [&_img]:max-w-[200px] [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6';

/** The signature editor. See {@link SignatureEditorProps}. */
export function SignatureEditor({ value, onChange, inline = false }: SignatureEditorProps) {
  const extensions = useMemo(
    () => [
      ...SIGNATURE_EXTENSIONS,
      Placeholder.configure({ placeholder: 'Your name, business and any links…' }),
    ],
    [],
  );
  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });
  if (!editor) return null;
  if (inline)
    return (
      <div className="group/sig relative">
        <Toolbar
          editor={editor}
          className={`absolute bottom-full right-0 z-10 mb-2 ${FLOATING_BAR} pointer-events-none opacity-0 transition-opacity duration-150 group-focus-within/sig:pointer-events-auto group-focus-within/sig:opacity-100 group-has-[[data-state=open]]/sig:pointer-events-auto group-has-[[data-state=open]]/sig:opacity-100 motion-reduce:transition-none`}
        />
        <EditorContent editor={editor} className={`${SHEET_TEXT} rounded-check transition-colors duration-150 [&:not(:focus-within)]:hover:bg-hover motion-reduce:transition-none`} />
      </div>
    );
  return (
    <div className="overflow-hidden rounded-panel bg-field ring-1 ring-zebra-200 transition-shadow duration-150 focus-within:ring-zebra-400 motion-reduce:transition-none">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={`min-h-40 px-4 py-3 [&_.ProseMirror]:min-h-32 ${SHEET_TEXT}`}
      />
    </div>
  );
}

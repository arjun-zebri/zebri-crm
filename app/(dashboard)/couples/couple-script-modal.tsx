'use client';

import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Printer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ScriptEditor } from '@/components/documents/script-editor';
import { ScriptToolbar } from '@/components/documents/script-toolbar';
import { useScriptFonts } from '@/components/documents/use-script-fonts';
import { printScript } from '@/components/print/print-script';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useAutosave } from '@/lib/branding/use-autosave';
import { scriptDocEquals } from '@/lib/documents/script-extensions';
import { SCRIPT_FONT_IDS } from '@/lib/documents/script-fonts';

import { timeAgo } from './couple-scripts-list';
import { updateScriptAction } from './script-actions';
import type { CoupleScript } from './use-couple-scripts';

export interface CoupleScriptModalProps {
  script: CoupleScript;
  onClose: () => void;
  /** Called after any successful save so the list's "updated" time stays true. */
  onSaved: () => void;
}

/**
 * One open script, in a fullscreen modal over the couple profile: the
 * editable title and the save state / Print in the header; the toolbar and
 * the editor in the body. Backdrop, X or Esc close it.
 * Content autosaves 800 ms after the last keystroke and flushes on close.
 *
 * The editor is seeded from the script once (the parent keys this by script
 * id); later refetches of the row are never pushed back into a live editor.
 */
export function CoupleScriptModal({ script, onClose, onSaved }: CoupleScriptModalProps) {
  const { toast } = useToast();
  const [initialContent] = useState<JSONContent>(script.content);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState(script.title);
  const [content, setContent] = useState<JSONContent>(script.content);

  // The whole catalogue, not just the faces in use: the toolbar's font menu
  // shows each face in itself, so every family has to be available. Google
  // serves the files lazily per face actually rendered.
  useScriptFonts(SCRIPT_FONT_IDS);

  const save = useCallback(
    async (next: JSONContent) => {
      const result = await updateScriptAction({ id: script.id, content: next });
      if (!result.ok) throw new Error(result.error);
      onSaved();
    },
    [script.id, onSaved],
  );
  const { status, lastSavedAt, retry } = useAutosave(content, save);

  // Flush a pending edit when the modal closes: the debounce may not have
  // fired yet. The box tracks the latest content and the last content known
  // to be saved.
  const latest = useRef({ content, saved: script.content });
  useEffect(() => {
    latest.current.content = content;
  }, [content]);
  useEffect(() => {
    if (status === 'saved') latest.current.saved = latest.current.content;
  }, [status]);
  useEffect(() => {
    const box = latest;
    return () => {
      const { content: pending, saved } = box.current;
      // A flush during page unload is cancelled by the browser; nothing can
      // be shown for it, so swallow rather than surface an unhandled rejection.
      if (!scriptDocEquals(pending, saved)) {
        void updateScriptAction({ id: script.id, content: pending }).catch(() => undefined);
      }
    };
  }, [script.id]);

  const patch = async (input: { title?: string }) => {
    const result = await updateScriptAction({ id: script.id, ...input });
    if (!result.ok) toast(result.error);
    else onSaved();
  };

  const commitTitle = () => {
    const next = title.trim();
    if (!next) { setTitle(script.title); return; }
    if (next !== script.title) void patch({ title: next });
  };

  const saveLabel =
    status === 'saving' ? 'Saving…'
    : status === 'error' ? 'Not saved'
    : lastSavedAt ? `Saved ${timeAgo(new Date(lastSavedAt).toISOString())}`
    : `Saved ${timeAgo(script.updated_at)}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="fullscreen"
      title={
        <div className="w-64 sm:w-96 font-normal">
          <Input aria-label="Script title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>
      }
      headerActions={
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-body font-normal text-text-subtle" aria-live="polite">
            {saveLabel}
            {status === 'error' ? (
              <button type="button" onClick={retry} className="ml-1 underline">Retry</button>
            ) : null}
          </span>
          <Button onClick={() => printScript({ title, content, font: script.font })}>
            <Printer size={14} strokeWidth={1.5} /> Print
          </Button>
        </div>
      }
    >
      {/* `data-save-status` is the hook for tests and the one place the
          state is readable at every breakpoint; the label itself is hidden
          on phones, where the header has no room and the list's "Updated
          just now" carries the same news. */}
      <div className="flex h-full flex-col gap-3 min-h-0" data-save-status={status}>
        {editor ? <ScriptToolbar editor={editor} /> : null}
        <div className="flex-1 min-h-[16rem] overflow-y-auto rounded-control border border-border bg-surface px-4 py-3 sm:px-6">
          <ScriptEditor value={initialContent} onChange={setContent} font={script.font} onEditorReady={setEditor} />
        </div>
      </div>
    </Modal>
  );
}

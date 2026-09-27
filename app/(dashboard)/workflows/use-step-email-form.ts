'use client';

/**
 * The held send's message as the step detail modal edits it.
 *
 * The editor holds the message as written (the subject with its
 * `{{variables}}`, the body as a TipTap doc), not the rendered text, so
 * an edit keeps bold, lists, links, the signature and every variable, and
 * an unfilled variable still holds the send (live check B2). The rendered
 * email sits under it in the preview.
 *
 * Edits are per field. Only a field that differs from what it was seeded
 * with travels, so a subject edit never rewrites the body. "Differs" for
 * the body is measured against the editor's OWN form of the seed, which
 * it reports once on mount (`onBaseline`): the stored doc lacks defaults
 * the editor fills in, so comparing against it would read an undo as an
 * edit.
 *
 * @module app/(dashboard)/workflows/use-step-email-form
 */

import type { JSONContent } from '@tiptap/react';
import { useState } from 'react';

import { toPlainJSON } from '@/lib/utils';
import type { ReviewEdits, StepPreview } from '@/lib/workflows/review';

/** An editor needs a paragraph to put a caret in. */
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/** What the fields were last seeded with, and from which step. */
interface Seed {
  stepId: string;
  /** Serialised server source, to notice a refetch that changed it. */
  key: string;
  subject: string;
  content: JSONContent;
}

/** The form's state and its handlers. */
export interface StepEmailForm {
  subject: string;
  setSubject: (value: string) => void;
  /** The body the editor opens with. Re-seeding remounts the editor. */
  initialContent: JSONContent;
  /** Every change the editor emits, already plain JSON. */
  setContent: (doc: JSONContent) => void;
  /** The editor's own form of `initialContent`, reported on mount. */
  setBaseline: (doc: JSONContent) => void;
  /** Changes on every re-seed; the editor is keyed by it. */
  editorKey: number;
  /** The step stores a pre-composer plain-text body. */
  legacyText: boolean;
  /** True once either field differs from its seed. */
  dirty: boolean;
  /** Only the changed fields, or undefined when nothing changed. */
  edits: ReviewEdits | undefined;
}

/**
 * @param stepId - The open step, or null when the modal is closed.
 * @param preview - The step's preview; only an email one has a source.
 */
export function useStepEmailForm(stepId: string | null, preview: StepPreview | null | undefined): StepEmailForm {
  const source = preview?.kind === 'email' ? preview.source : undefined;
  const server = { subject: source?.subject ?? '', content: source?.content ?? EMPTY_DOC };
  const serverKey = JSON.stringify(server);

  const [seed, setSeed] = useState<Seed | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState<JSONContent | null>(null);
  const [baseline, setBaselineJson] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const subjectDirty = seed !== null && subject !== seed.subject;
  const bodyDirty = content !== null && baseline !== null && JSON.stringify(content) !== baseline;
  const dirty = source !== undefined && (subjectDirty || bodyDirty);

  // Seeded during render, not in an effect, so the step's own words are
  // in the fields on the first frame the step is. Re-seeds on another
  // step, and on a refetch while untouched (a reworded step from another
  // tab); once edited, the fields are the MC's and a refetch never
  // overwrites them.
  const stale = seed === null || seed.stepId !== stepId || (!dirty && seed.key !== serverKey);
  if (source && stepId && stale) {
    setSeed({ stepId, key: serverKey, subject: server.subject, content: server.content });
    setSubject(server.subject);
    setContent(null);
    setBaselineJson(null);
    setEditorKey((n) => n + 1);
  }
  if (stepId === null && seed !== null) setSeed(null);

  return {
    subject,
    setSubject,
    initialContent: seed?.content ?? server.content,
    setContent,
    setBaseline: (doc) => setBaselineJson(JSON.stringify(doc)),
    editorKey,
    legacyText: source?.legacyText ?? false,
    dirty,
    edits: dirty
      ? {
          ...(subjectDirty ? { subject } : {}),
          // The editor already emits plain JSON; normalised again here
          // because this is the value that crosses the server-action
          // boundary, where a null-prototype attrs object loses its
          // variable id.
          ...(bodyDirty && content ? { content: toPlainJSON(content) } : {}),
        }
      : undefined,
  };
}

'use client';

import { useEffect, useRef, useState } from 'react';

import { freeze } from '../../doc-builder/doc-types/proposal/composed';
import { DocEditorView } from '../../doc-builder/editor/doc-editor-view';
import type { DocLayout, DocType } from '../../doc-builder/model/types';
import { useDocEditor, type BookingTerms, type DocFor, type DocMode, type FillSection } from '../../doc-builder/state/use-doc-editor';

import { PreviewOverlay } from './preview-overlay';
import { SendSheet } from './send-sheet';
import { WorkspaceHeader } from './workspace-header';

/**
 * The open editor, for a couple's proposal or a template: its header
 * (`WorkspaceHeader`) and the editor under it. It keeps the work as the
 * MC goes, says so in the header, and owns the ways out: Send for a
 * proposal (the send sheet, never blind), Use template or Done for a
 * template, which saves as it goes. The questionnaire, contract and
 * invoice designs open in it too, as templates of their `type`.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/editor-workspace
 */

/** A proposal's way out: the send sheet, and what sending does. */
export interface WorkspaceSend {
  couple: string;
  /** "Mia and Leo", for the note's greeting. */
  greet: string;
  onSend: (message: string, page: ReturnType<typeof freeze>) => void;
}

export interface EditorWorkspaceProps {
  mode: DocMode;
  /** What kind of document it is; a proposal unless said. */
  type?: DocType | undefined;
  /** Close's name, when the mode's own ("Close, the template is saved") does not fit. */
  closeLabel?: string | undefined;
  /** "Proposal for Mia & Leo", "Full day MC template". */
  title: string;
  /** The line under the title while nothing has changed; none for a template, whose title says it all. */
  detail?: string | undefined;
  /** Whose details the page shows. */
  who: DocFor;
  initial: DocLayout;
  initialTerms: BookingTerms | undefined;
  /** It opened from earlier work (a kept draft, an edited template). */
  restored: boolean;
  /** The page from scratch, for Reset. */
  fresh: () => DocLayout;
  /** A new section filled for this page, for Add. */
  fill: FillSection;
  /** Keeps the work as it changes. */
  keep: (page: { layout: DocLayout; terms: BookingTerms }) => void;
  /** Drops the kept work (Reset). */
  discard: () => void;
  /** A proposal's send; a template has none and closes with Done. */
  send?: WorkspaceSend | undefined;
  /** A template's way on: start a proposal from it ("Use template"); Done when left out. */
  onUse?: (() => void) | undefined;
  onClose: () => void;
}

/** What the header says, per mode. */
const WORDS: Record<DocMode, { kept: string; restored: string; over: string; close: string }> = {
  proposal: { kept: 'Draft kept', restored: 'Draft kept', over: 'Reset', close: 'Close, the draft is kept' },
  template: { kept: 'Saved', restored: 'Saved', over: 'Reset', close: 'Close, the template is saved' },
};

/** The workspace. See {@link EditorWorkspaceProps}. */
export function EditorWorkspace({ mode, type, closeLabel, title, detail, who, initial, initialTerms, restored, fresh, fill, keep, discard, send, onUse, onClose }: EditorWorkspaceProps) {
  const builder = useDocEditor(initial, { who, terms: initialTerms, fill, mode, type });
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const { layout } = builder.state;
  const { terms } = builder;
  const words = WORDS[mode];
  // Keep the work as they go; the page as it opened is not a change.
  // The text editors tidy their documents as they mount, which changes
  // the layout without anyone touching it (live-found), so the page to
  // compare against is the one in hand when the MC first reaches for
  // anything, not the one that opened. Opening a panel is not an edit.
  const [baseline, setBaseline] = useState<{ layout: DocLayout; terms: BookingTerms } | null>(null);
  const reach = () => setBaseline((b) => b ?? { layout, terms });
  const edited = baseline !== null && (layout !== baseline.layout || terms !== baseline.terms);
  // `keep` is a fresh closure each render; the latest one is used, but only a real change runs it.
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  });
  useEffect(() => {
    if (edited) keepRef.current({ layout, terms });
  }, [edited, layout, terms]);
  // Reset drops the kept work too, so the header reads as a fresh page again.
  const [fromEarlier, setFromEarlier] = useState(restored);
  const status = edited ? words.kept : fromEarlier ? words.restored : null;

  function startOver() {
    builder.dispatch({ type: 'replaceLayout', layout: fresh() }, { commit: true });
    discard();
    setFromEarlier(false);
    setBaseline(null);
  }

  // From the send sheet to the thing to fix: that section, picked and in view; or a packages section added before the accept.
  function fix(sectionId: string | null) {
    setSending(false);
    let id = sectionId;
    if (!id) {
      const section = builder.newSection('packages');
      const accept = layout.sections.findIndex((s) => s.kind === 'accept');
      builder.dispatch({ type: 'addSection', at: accept === -1 ? layout.sections.length : accept, section }, { commit: true });
      id = section.id;
    }
    builder.select(id);
    requestAnimationFrame(() => document.querySelector(`[data-canvas-section-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  return (
    <>
      <WorkspaceHeader
        title={title}
        status={status}
        detail={detail}
        close={closeLabel ?? words.close}
        over={status ? words.over : null}
        action={send ? { label: 'Send', run: () => setSending(true) } : onUse ? { label: 'Use template', run: onUse } : null}
        onClose={onClose}
        onStartOver={startOver}
        onPreview={() => setPreviewing(true)}
        onReach={reach}
      />
      <div className="flex min-h-0 flex-1" onPointerDownCapture={reach} onKeyDownCapture={reach}>
        <DocEditorView builder={builder} />
      </div>
      <PreviewOverlay open={previewing} onClose={() => setPreviewing(false)} builder={builder} />
      {send ? (
        <SendSheet open={sending} onClose={() => setSending(false)} builder={builder} couple={send.couple} greet={send.greet} onSend={(message) => send.onSend(message, freeze(builder))} onFix={fix} />
      ) : null}
    </>
  );
}


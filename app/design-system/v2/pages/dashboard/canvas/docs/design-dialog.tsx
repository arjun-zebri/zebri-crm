'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';
import { BrushIcon } from '@/components/ui-v2/icons';

import { useAccount } from '../../account';
import { useBrandKit } from '../../brand/brand-provider';
import { isEngineDesign } from '../../doc-builder/doc-types/designed';
import { DocShell } from '../../doc-builder/shell/doc-shell';
import { CanvasEditor } from '../canvas-editor';
import { EditorHeader } from '../editor-header';
import { useCanvas } from '../use-canvas';

import { closeDesign, designOf, saveDesign, useOpenDesign } from './design-store';
import { EngineDesignEditor } from './engine-design';
import { SPECS } from './registry';
import type { DesignKind } from './spec';

/**
 * The design editor every document opens: full screen, the shared canvas
 * (rail, pages, floating toolbar) on the kind's design, filled with the
 * document it was opened from (or a sample), so the MC designs around
 * real words. The design is kept for every document of the kind however
 * the editor is left (Close, Escape with nothing picked, the backdrop), as
 * Canva saves as you go, so its header says "Saved" once anything changed,
 * as the brand kit's does (the one `EditorHeader`); undo is the way back.
 * Each dashboard page renders it once. A questionnaire, contract or
 * invoice opens in the proposal editor instead (`EngineDesignEditor`, in
 * its `DocShell`), which saves as it goes the same way.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/design-dialog
 */

/** The dialog. */
export function DesignDialog() {
  const open = useOpenDesign();
  // Every way out keeps the work, as Canva saves as you go: the editor
  // registers its save here, and Escape or a backdrop click runs it too.
  const keep = useRef<(() => void) | null>(null);
  const close = () => {
    keep.current?.();
    closeDesign();
  };
  const engine = open !== null && isEngineDesign(open.kind) ? open.kind : null;
  return (
    <>
      <Dialog open={open !== null && !engine} onClose={close} size="xl" expanded aria-labelledby="design-title">
        {/* Keyed by kind, so each opening starts from that kind's saved design with fresh history. */}
        {open && !engine ? <Editor key={open.kind} kind={open.kind} data={open.data} keepRef={keep} onDone={close} /> : null}
      </Dialog>
      <DocShell open={engine !== null} onClose={closeDesign} aria-labelledby="editor-title">
        {open && engine ? <EngineDesignEditor key={engine} kind={engine} data={open.data} onClose={closeDesign} /> : null}
      </DocShell>
    </>
  );
}

function Editor({ kind, data, keepRef, onDone }: { kind: DesignKind; data: unknown; keepRef: RefObject<(() => void) | null>; onDone: () => void }) {
  const account = useAccount();
  const { kit } = useBrandKit();
  const spec = SPECS[kind];
  const canvas = useCanvas(designOf(kind));
  const [editing, setEditing] = useState<string | null>(null);
  const fills = spec.fill(data ?? spec.sample(account), account);
  const { doc } = canvas;
  useEffect(() => {
    keepRef.current = () => saveDesign(kind, doc);
  }, [keepRef, kind, doc]);
  return (
    <>
      <EditorHeader
        id="design-title"
        icon={BrushIcon}
        title={`${spec.label} design`}
        // Any edit in this opening, kept however the editor is left.
        saved={canvas.canUndo || canvas.canRedo}
        detail={`Every ${spec.label.toLowerCase()} you send wears it. Locked parts move and restyle, and stay.`}
        history={canvas}
        onClose={onDone}
      />
      <CanvasEditor canvas={canvas} editing={editing} onEditing={setEditing} data={{ kit, business: account.business, ...fills }} />
    </>
  );
}

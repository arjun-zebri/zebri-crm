'use client';

import { useState } from 'react';

import { newSectionFor } from '@/features/proposals';

import { useAccount } from '../../account';
import { engineDesignOf, type EngineDesignData, type EngineDesignKind } from '../../doc-builder/doc-types/designed';
import { DocPartsProvider } from '../../doc-builder/sections/parts/parts';
import { EditorWorkspace } from '../../proposals/editor/editor-workspace';

import { isCustomised, layoutOf, resetLayout, saveLayout } from './design-store';

/**
 * A questionnaire, contract or invoice design, in the proposal editor
 * (founder, 2026-10-20: these looked nothing like it). The same window,
 * header, page and bars a proposal template opens in (`EditorWorkspace`
 * as a template of this kind), on the kind's one design, with the
 * document it was opened from (or a sample) drawn in the parts Zebri
 * fills in. For a contract it is the whole contract: its wording is text
 * on the page (`doc-builder/doc-types/contract/starter.ts`).
 * It saves as the MC works, and Reset goes back to Zebri's starter.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/engine-design
 */

export interface EngineDesignEditorProps {
  kind: EngineDesignKind;
  /** The document to design around, as its Design button handed it over; the sample when left out. */
  data: unknown;
  onClose: () => void;
}

/** The editor. Keyed by the caller per kind, so each opening starts from the saved design. See {@link EngineDesignEditorProps}. */
export function EngineDesignEditor({ kind, data, onClose }: EngineDesignEditorProps) {
  const account = useAccount();
  const design = engineDesignOf(kind);
  // The Design button hands over its own kind's data (see `design-button.tsx`).
  const filled = (data ?? design.sample(account)) as EngineDesignData[EngineDesignKind];
  // Read once per opening: the work then lives in the editor and is saved from it.
  const [initial] = useState(() => layoutOf(kind, account));
  const [restored] = useState(() => isCustomised(kind));
  return (
    <DocPartsProvider parts={design.parts(filled, account)} fields={design.fields(filled, account)}>
      <EditorWorkspace
        mode="template"
        type={kind}
        // The MC's own document, words and look together, so not "design" (founder, 2026-10-21).
        title={`Your ${design.label.toLowerCase()}`}
        closeLabel="Close, your changes are saved"
        who={design.who(filled, account)}
        initial={initial}
        initialTerms={undefined}
        restored={restored}
        fresh={() => design.starter(account)}
        fill={(k) => newSectionFor(k)}
        keep={({ layout }) => saveLayout(kind, layout)}
        discard={() => resetLayout(kind)}
        onClose={onClose}
      />
    </DocPartsProvider>
  );
}

'use client';

import { useState } from 'react';

import { ShapesIcon } from '@/components/ui-v2/icons';

import { DEMO_ACCOUNT } from '../account';
import { BrandKitDialog } from '../brand/brand-kit-dialog';
import { BrandProvider, useBrandKit } from '../brand/brand-provider';

import { CanvasEditor } from './canvas-editor';
import { EditorHeader } from './editor-header';
import { SAMPLE_DOC } from './sample';
import { useCanvas } from './use-canvas';

/**
 * The canvas on its own, for building and checking the editor before
 * each document moves into it: the sample proposal in the demo brand,
 * under the design editor's header (Undo and Redo).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/canvas-playground
 */

function Playground() {
  const { kit } = useBrandKit();
  const canvas = useCanvas(SAMPLE_DOC);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="flex h-dvh flex-col bg-field">
      <h1 className="sr-only">Canvas</h1>
      <EditorHeader id="canvas-title" icon={ShapesIcon} title={canvas.doc.title} saved={false} history={canvas} />
      <CanvasEditor
        canvas={canvas}
        editing={editing}
        onEditing={setEditing}
        data={{
          kit,
          business: DEMO_ACCOUNT.business,
          fields: { couple: 'Mia and James · 14 Mar 2027', total: '$2,640.00' },
          fieldNames: { couple: 'Couple and date', total: 'Total' },
          widgets: {},
        }}
      />
    </div>
  );
}

/** The playground, in the live brand. */
export function CanvasPlayground() {
  return (
    <BrandProvider>
      <Playground />
      <BrandKitDialog />
    </BrandProvider>
  );
}

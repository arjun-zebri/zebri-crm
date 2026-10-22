'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { DEMO_ACCOUNT } from '../../account';
import { BrandKitDialog } from '../../brand/brand-kit-dialog';
import { BrandProvider } from '../../brand/brand-provider';
import { EditorWorkspace } from '../../proposals/editor/editor-workspace';
import { sampleOf } from '../../proposals/proposal-preview';
import { packagesOf, templateOf } from '../../proposals/templates-data';
import { filledSection, templateLayout } from '../doc-types/proposal/starter';
import { useStarterFrom } from '../doc-types/proposal/use-starter-from';
import { DocShell } from '../shell/doc-shell';

/**
 * The document engine on its own, for building and checking it before
 * each document type moves onto it: the Full day proposal template in
 * the live brand. Nothing is saved: closing throws the edits away, so
 * trying it never changes the demo dashboard.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/showroom/engine-demo
 */

/** The open proposal, its edits kept only while open. */
function DemoProposal({ onClose }: { onClose: () => void }) {
  const { from } = useStarterFrom();
  const template = templateOf('full-day');
  const sample = sampleOf(template);
  const packages = DEMO_ACCOUNT.packages?.length ? DEMO_ACCOUNT.packages : packagesOf(template);
  const fresh = () => templateLayout(template, from, packages);
  const [initial] = useState(fresh);
  return (
    <EditorWorkspace
      mode="template"
      title="Full day MC template"
      who={{ couple: sample.couple, date: sample.date, venue: sample.venue }}
      initial={initial}
      initialTerms={undefined}
      restored={false}
      fresh={fresh}
      fill={(kind) => filledSection(kind, template, packages)}
      keep={() => {}}
      discard={() => {}}
      onClose={onClose}
    />
  );
}

/** The demo page: one button that opens the engine. */
export function EngineDemo() {
  const [open, setOpen] = useState(false);
  return (
    <BrandProvider>
      <main className="flex min-h-dvh items-center justify-center bg-zebra-50 px-4">
        <Button onClick={() => setOpen(true)}>Open a proposal</Button>
      </main>
      <DocShell open={open} onClose={() => setOpen(false)} aria-labelledby="editor-title">
        {open ? <DemoProposal onClose={() => setOpen(false)} /> : null}
      </DocShell>
      <BrandKitDialog />
    </BrandProvider>
  );
}

'use client';

import { useState } from 'react';


import { useAccount } from '../../account';
import { filledSection, templateLayout } from '../../doc-builder/doc-types/proposal/starter';
import { choiceOf, clearTemplate, readTemplate, writeTemplate } from '../../doc-builder/doc-types/proposal/template-store';
import { useStarterFrom } from '../../doc-builder/doc-types/proposal/use-starter-from';
import { DocShell } from '../../doc-builder/shell/doc-shell';
import { sampleOf } from '../proposal-preview';
import { packagesOf } from '../templates-data';

import { EditorWorkspace } from './editor-workspace';

/**
 * A proposal template, open in the same editor a proposal uses. The
 * couple's name, date and venue are chips, shown on the page for the
 * template's sample couple; every new proposal from it gets them as that
 * couple's words. It saves as the MC works (no Save to forget), and
 * "Back to Zebri's" returns a built-in to the page it shipped with.
 * Proposals already sent keep the page they went out as.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/template-editor
 */

export interface TemplateEditorProps {
  /** The template key to edit; closed while null. */
  id: string | null;
  onClose: () => void;
  /** Starts a proposal from the template ("Use template"); Done only when left out. */
  onUse?: ((id: string) => void) | undefined;
}

/** The template editor. Keyed by the caller per template. See {@link TemplateEditorProps}. */
export function TemplateEditor({ id, onClose, onUse }: TemplateEditorProps) {
  return (
    <DocShell open={id !== null} onClose={onClose} aria-labelledby="editor-title">
      {id ? <TemplateBody id={id} onClose={onClose} onUse={onUse ? () => onUse(id) : undefined} /> : null}
    </DocShell>
  );
}

/** The open template. */
function TemplateBody({ id, onClose, onUse }: { id: string; onClose: () => void; onUse: (() => void) | undefined }) {
  const account = useAccount();
  const { from } = useStarterFrom();
  const { template, custom } = choiceOf(id);
  const sample = sampleOf(template);
  const packages = account.packages?.length ? account.packages : packagesOf(template);
  const fresh = () => templateLayout(template, from, packages);
  // Read once per opening: the caller keys this per template.
  const [edited] = useState(() => readTemplate(id));
  const [initial] = useState(() => edited?.layout ?? fresh());
  return (
    <EditorWorkspace
      mode="template"
      title={custom ? template.name : `${template.name} template`}
      who={{ couple: sample.couple, date: sample.date, venue: sample.venue }}
      initial={initial}
      initialTerms={edited?.terms}
      // A new template of the MC's own has nothing to go back to yet.
      restored={edited !== null && !custom}
      fresh={fresh}
      fill={(kind) => filledSection(kind, template, packages)}
      keep={(page) => writeTemplate(id, { ...page, at: Date.now() })}
      discard={() => clearTemplate(id)}
      onUse={onUse}
      onClose={onClose}
    />
  );
}

/**
 * Contract body editor — TipTap-based rich-text editor plus the
 * template-picker dropdown that lets the MC drop a saved contract
 * template into the editor.
 *
 * Two render modes:
 * - **Editable** (`canEdit=true`): renders `RichTextEditor` with
 *   the live JSON document; "Apply template" Popover sits above
 *   it. Variable-substitution hint underneath ("Variables like
 *   `{{couple_name}}` are replaced when you send the contract").
 * - **Locked** (`canEdit=false`): renders `locked_content_html`
 *   verbatim — the snapshot the MC sent + the couple sees. No
 *   template picker, no variable hint.
 *
 * @module components/builders/parts/contract-body-editor
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';

import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { findUnknownVariables } from '@/lib/contracts/contract-variables';

import type { JSONContent } from './contract-types';

export interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  content: JSONContent;
}

export interface ContractBodyEditorProps {
  content: JSONContent;
  onChange: (next: JSONContent) => void;
  canEdit: boolean;
  /** Locked snapshot, shown when canEdit is false. */
  lockedHtml?: string | null;
  templates?: ContractTemplate[];
  onApplyTemplate?: (template: ContractTemplate) => void;
}

export function ContractBodyEditor({
  content,
  onChange,
  canEdit,
  lockedHtml,
  templates,
  onApplyTemplate,
}: ContractBodyEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Merge fields with no backing variable render as the literal "{{id}}" in
  // the snapshot the couple signs, and that snapshot is immutable once sent,
  // so flag them in the editor rather than letting them reach the document.
  const unknownVars = useMemo(() => findUnknownVariables(content), [content]);

  if (!canEdit) {
    return (
      <div
        // `.contract-content` is the canonical class defined in
        // app/globals.css — same one the public /contract/[token]
        // page + the right-pane preview use. Spacing, heading
        // sizes, list markers all match the live couple-facing
        // surface exactly. Previously this used `prose prose-sm`
        // which rendered noticeably tighter than what the couple
        // actually saw.
        className="contract-content rounded-control border border-border bg-surface-muted/40 p-4 text-body"
        // Locked HTML is server-rendered from the TipTap JSON at
        // send time via `renderContractHtml` — sanitised on the way
        // out. Safe to dangerouslySetInnerHTML here.
        dangerouslySetInnerHTML={{ __html: lockedHtml ?? '' }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {templates && templates.length > 0 && onApplyTemplate ? (
        <div className="flex items-center justify-end">
          <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1 text-body text-text-muted hover:bg-surface-muted hover:text-text transition-colors cursor-pointer"
              >
                <FileText size={12} strokeWidth={1.5} />
                Apply template
                <ChevronDown size={12} strokeWidth={1.5} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={4}
                className="z-[90] w-72 rounded-control border border-border bg-surface shadow-lg p-2 animate-fade-in"
              >
                <div className="max-h-64 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onApplyTemplate(t);
                        setPickerOpen(false);
                      }}
                      className="block w-full rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-muted cursor-pointer"
                    >
                      <p className="text-body text-text">{t.name}</p>
                      {t.description ? (
                        <p className="text-body text-text-muted truncate">
                          {t.description}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ) : null}

      {/* `scrollBody` caps the typing area so the formatting toolbar stays
          visible on a long contract. The builder's left pane already scrolls,
          so without it the editor grew until the toolbar left the viewport. */}
      <RichTextEditor
        value={content}
        onChange={onChange}
        editable={canEdit}
        tables
        scrollBody
      />

      {unknownVars.length > 0 ? (
        <p className="text-body text-danger">
          {unknownVars.length === 1 ? 'This field is' : 'These fields are'} no
          longer available and{' '}
          {unknownVars.length === 1 ? 'will print' : 'will print'} as raw text
          on the signed contract:{' '}
          {unknownVars.map((id, i) => (
            <span key={id}>
              {i > 0 ? ', ' : ''}
              <span className="font-mono bg-surface-muted px-1 py-0.5 rounded-control">
                {`{{${id}}}`}
              </span>
            </span>
          ))}
          . Remove {unknownVars.length === 1 ? 'it' : 'them'} before sending.
        </p>
      ) : null}
    </div>
  );
}

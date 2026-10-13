'use client';

/**
 * Sequence editor modal: name, ordered steps, and a live preview of the
 * focused message. Saving sends the whole sequence (replace semantics).
 *
 * Closing by any route (Cancel, X, Escape, backdrop) asks before it
 * throws away unsaved edits. On phones the steps and the preview take
 * turns; on md and up they sit side by side.
 *
 * @module features/outreach/views/sequences/sequence-editor
 */
import { useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { saveSequenceAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import { type MergeField } from '@/lib/outreach/render';

import { MergeFieldMenu } from './merge-field-menu';
import { type DraftSequence, isDraftChanged } from './sequence-draft';
import { EditorFooter, PaneToggle, SaveBlockers, type EditorPane } from './sequence-editor-chrome';
import { patchVariant, resolveVariant } from './sequence-ops';
import { SequencePreview } from './sequence-preview';
import { draftProblems, toSavePayload } from './sequence-save';
import { StepsPane } from './steps-pane';

interface SequenceEditorProps {
  /** Starting state. The parent remounts the editor (new key) to start over. */
  initial: DraftSequence;
  onClose: () => void;
}

/**
 * Editor for one sequence. The modal keeps a fixed height and scrolls
 * inside, so the footer never jumps as steps are added.
 */
export function SequenceEditor({ initial, onClose }: SequenceEditorProps) {
  const [draft, setDraft] = useState<DraftSequence>(initial);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [pane, setPane] = useState<EditorPane>('steps');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Textareas by variant key, so merge fields can be inserted at the cursor.
  const bodies = useRef(new Map<string, HTMLTextAreaElement>());
  const save = useOutreachMutation(saveSequenceAction, 'Sequence saved');

  const problems = draftProblems(draft);
  const target = resolveVariant(draft, focusedKey);
  const targetLabel = target ? `Message ${target.index + 1}, version ${target.variant.label}` : '';

  // Why: every close route funnels here, so no path can silently drop typed text.
  function requestClose() {
    if (isDraftChanged(draft, initial)) setConfirmDiscard(true);
    else onClose();
  }

  /** Insert `{{field}}` at the cursor when the target message has focus, otherwise at the end. */
  function insertField(field: MergeField) {
    if (!target) return;
    const token = `{{${field}}}`;
    const { body } = target.variant;
    const el = bodies.current.get(target.variant.key);
    const atCursor = !!el && focusedKey === target.variant.key;
    const start = atCursor && el ? el.selectionStart : body.length;
    const end = atCursor && el ? el.selectionEnd : body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setDraft((d) => patchVariant(d, target.step.key, target.variant.key, { body: next }));
    setFocusedKey(target.variant.key);
    const caret = start + token.length;
    // Why: the textarea re-renders with the new value first; the caret can only be placed after that.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  function bindBody(variantKey: string) {
    return (el: HTMLTextAreaElement | null) => {
      if (el) bodies.current.set(variantKey, el);
      else bodies.current.delete(variantKey);
    };
  }

  return (
    <>
      <Modal
        isOpen
        onClose={requestClose}
        size="fullscreen"
        title={draft.id ? 'Edit sequence' : 'New sequence'}
        footer={
          <EditorFooter
            problems={problems}
            saving={save.isPending}
            onCancel={requestClose}
            onSave={() => save.mutate(toSavePayload(draft), { onSuccess: onClose })}
          />
        }
      >
        {/* Fills the modal; the steps and the preview each scroll on their
            own, so the preview stays beside the message being edited. */}
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-md">
              <Input
                label="Name"
                value={draft.name}
                maxLength={120}
                placeholder="For example, Celebrant intro"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <MergeFieldMenu onPick={insertField} targetLabel={targetLabel || 'the first message'} />
          </div>
          <SaveBlockers problems={problems} />
          <PaneToggle pane={pane} onChange={setPane} />
          <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <StepsPane
              steps={draft.steps}
              focusedKey={focusedKey}
              visible={pane === 'steps'}
              setDraft={setDraft}
              onFocusVariant={setFocusedKey}
              bindBody={bindBody}
            />
            <div className={`min-h-0 overflow-y-auto pb-2 ${pane === 'preview' ? '' : 'hidden'} md:block`}>
              {target ? (
                <SequencePreview
                  channel={target.step.channel}
                  subject={target.variant.subject}
                  body={target.variant.body}
                  caption={`Previewing ${targetLabel}`}
                />
              ) : (
                <p className="text-body text-text-muted">Add a step to see a preview.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        description="Your edits to this sequence haven't been saved. Discarding closes the editor without saving them."
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={onClose}
      />
    </>
  );
}

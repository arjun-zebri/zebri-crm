'use client';

/**
 * Outreach > Sequences: the message plans that campaigns send.
 *
 * Loads the list, opens the editor for a new, blank or template-based
 * sequence, and confirms before archiving or deleting. `?new=template` and `?new=1`
 * open the editor straight away, so the Today setup guide can link here.
 *
 * @module features/outreach/views/sequences-view
 */
import { ListOrdered } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import type { SequenceWithSteps } from '@/lib/outreach/services/queries';

import { archiveSequenceAction, deleteSequenceAction } from '../actions';
import { useOutreachMutation, useSequences } from '../hooks';

import { blankSequence, draftFromSequence, type DraftSequence, newKey } from './sequences/sequence-draft';
import { SequenceEditor } from './sequences/sequence-editor';
import { SequenceList } from './sequences/sequence-list';
import { templateSequence } from './sequences/sequence-template';
import { useNewFromUrl } from './sequences/use-new-from-url';

/** The editor that is open. A fresh key remounts it with a new draft. */
interface OpenEditor {
  key: string;
  draft: DraftSequence;
}

/** Sequences tab. */
export function SequencesView() {
  const sequences = useSequences();
  const archive = useOutreachMutation(archiveSequenceAction, 'Sequence archived');
  const remove = useOutreachMutation(deleteSequenceAction, 'Sequence deleted');
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const [toArchive, setToArchive] = useState<SequenceWithSteps | null>(null);
  const [toDelete, setToDelete] = useState<SequenceWithSteps | null>(null);

  const open = (draft: DraftSequence) => setEditor({ key: newKey(), draft });
  const openTemplate = () => open(templateSequence());
  const openBlank = () => open(blankSequence());
  // Why: the URL param is cleared on close, so a refresh does not reopen the editor.
  const clearNewParam = useNewFromUrl('sequences', !sequences.isPending, (value) =>
    value === 'template' ? openTemplate() : openBlank(),
  );
  const closeEditor = () => {
    setEditor(null);
    clearNewParam();
  };

  if (sequences.isPending) return <Loading label="Loading sequences" />;
  if (sequences.isError) {
    return <ErrorState error={sequences.error} onRetry={() => void sequences.refetch()} />;
  }

  const list = sequences.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-text-muted">
          A sequence is the plan a campaign follows: email, then Instagram, then follow-ups.
        </p>
        {list.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openTemplate}>
              Start from a template
            </Button>
            <Button onClick={openBlank}>New sequence</Button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Empty
          icon={ListOrdered}
          title="No sequences yet"
          description="Start from the template, then change the wording to suit you."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={openTemplate}>Start from a template</Button>
              <Button variant="outline" onClick={openBlank}>
                New sequence
              </Button>
            </div>
          }
        />
      ) : (
        <SequenceList
          sequences={list}
          onEdit={(seq) => open(draftFromSequence(seq))}
          onArchive={setToArchive}
          onDelete={setToDelete}
        />
      )}

      {editor && <SequenceEditor key={editor.key} initial={editor.draft} onClose={closeEditor} />}

      <ConfirmDialog
        open={toArchive !== null}
        title="Archive this sequence?"
        description="It disappears from this list and can't be picked for new campaigns. Its past results stay in Analytics."
        confirmLabel="Archive"
        loading={archive.isPending}
        onCancel={() => setToArchive(null)}
        onConfirm={() => {
          if (!toArchive) return;
          archive.mutate(toArchive.id, { onSuccess: () => setToArchive(null) });
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this sequence?"
        description="Removes the sequence and its wording for good. One that anyone has been through can only be archived."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) });
        }}
      />
    </div>
  );
}

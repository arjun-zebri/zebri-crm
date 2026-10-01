'use client';

import { ArrowUp, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { PromptBox } from '@/components/ui-v2/prompt-box';

import { STARTERS } from '../zebri-chat';

/**
 * Starting a workflow: say what should happen in a sentence and Zebri
 * builds it, emails written, ready to read. Four starters fill the box
 * rather than building straight away, so the MC can make one theirs
 * ("…and ask for a review") first. Start blank is there for anyone who
 * would rather lay it out by hand.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/new/new-workflow-dialog
 */

const BUILD_MS = 1200;

export interface NewWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  /** Builds from the description (or blank when empty) and opens the builder. */
  onBuild: (description: string) => void;
}

/** The New workflow dialog. See {@link NewWorkflowDialogProps}. */
export function NewWorkflowDialog({ open, onClose, onBuild }: NewWorkflowDialogProps) {
  const [text, setText] = useState('');
  const [building, setBuilding] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const build = (description: string) => {
    setBuilding(true);
    window.setTimeout(() => {
      setBuilding(false);
      setText('');
      onBuild(description);
    }, description ? BUILD_MS : 0);
  };
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-workflow-title">
      <div className="space-y-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 id="new-workflow-title" className="type-subheading text-zebra-950">
              New workflow
            </h2>
            <p className="type-body text-zebra-500">Say what should happen and Zebri builds it. Nothing sends until you turn it on.</p>
          </div>
          <Button variant="ghost" square aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Button>
        </header>
        <PromptBox
          label="Describe the workflow"
          placeholder="When someone books, welcome them, chase the questionnaire, thank them after the day"
          value={text}
          onChange={setText}
          onSubmit={build}
          inputRef={input}
          actions={
            <Button type="submit" variant={text.trim() ? 'primary' : 'ghost'} square loading={building} disabled={!text.trim()} aria-label="Build it">
              <ArrowUp aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <Button
              key={s.label}
              variant="secondary"
              disabled={building}
              onClick={() => {
                setText(s.text);
                input.current?.focus();
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="plain" disabled={building} onClick={() => build('')}>
            Start blank
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

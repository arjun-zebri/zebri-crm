'use client';

/**
 * One step of a sequence: channel, wait, thread setting, then its variants.
 *
 * Removing a step asks first. A step that has already sent messages cannot
 * be removed at all (the server refuses), so its Remove is disabled with the
 * reason shown beside it.
 *
 * @module features/outreach/views/sequences/step-editor
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';

import {
  type Channel, type DraftStep, MAX_VARIANTS, type StepPatch, type VariantPatch, startsThread,
} from './sequence-draft';
import { VariantEditor } from './variant-editor';

interface StepEditorProps {
  step: DraftStep;
  index: number;
  total: number;
  focusedKey: string | null;
  onPatch: (patch: StepPatch) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddVariant: () => void;
  onRemoveVariant: (variantKey: string) => void;
  onPatchVariant: (variantKey: string, patch: VariantPatch) => void;
  onFocusVariant: (variantKey: string) => void;
  bindBody: (variantKey: string) => (el: HTMLTextAreaElement | null) => void;
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram DM' },
];

/** One step card: header controls, then the variants. */
export function StepEditor(props: StepEditorProps) {
  const { step, index, total, focusedKey } = props;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const threaded = startsThread(step, index);
  const email = step.channel === 'email';
  const hasSends = step.sentCount > 0;
  return (
    <section aria-label={`Step ${index + 1}`} className="rounded-control border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-body font-semibold text-text">Step {index + 1}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" iconOnly aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => props.onMove(-1)}>
            <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <Button variant="ghost" iconOnly aria-label={`Move step ${index + 1} down`} disabled={index === total - 1} onClick={() => props.onMove(1)}>
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            iconOnly
            aria-label={`Remove step ${index + 1}`}
            disabled={total <= 1 || hasSends}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="space-y-5 p-5">
      {hasSends && (
        <p className="text-body text-text-muted">
          This step has sent messages, so it can&apos;t be removed. Turn its variants off instead, or make a new sequence.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <Select
          label="Channel"
          ariaLabel={`Step ${index + 1} channel`}
          options={CHANNEL_OPTIONS}
          value={step.channel}
          onValueChange={(v) => props.onPatch({ channel: v as Channel })}
        />
        <Input
          label={index === 0 ? 'Days after enrolling' : 'Days after previous step'}
          tooltip={
            index === 0
              ? 'Counted from the day the celebrant is enrolled in the campaign.'
              : 'Counted from when the previous message is actually sent, not from the plan.'
          }
          tooltipMultiline
          type="number"
          min={0}
          max={90}
          value={step.delay_days}
          onChange={(e) => {
            const n = Number(e.target.value);
            props.onPatch({ delay_days: Number.isFinite(n) ? Math.min(90, Math.max(0, Math.round(n))) : 0 });
          }}
        />
      </div>
      {email && (
        <Toggle
          checked={threaded}
          disabled={index === 0}
          onChange={(v) => props.onPatch({ is_new_thread: v })}
          label="Start a new email thread"
          description={index === 0 ? 'The first email always starts a thread.' : 'Off keeps this email in the thread before it.'}
          ariaLabel={`Step ${index + 1} starts a new email thread`}
        />
      )}
      <div className="divide-y divide-border border-t border-border">
        {step.variants.map((v) => (
          <VariantEditor
            key={v.key}
            variant={v}
            label={v.label}
            channel={step.channel}
            startsThread={threaded}
            canRemove={step.variants.length > 1}
            focused={focusedKey === v.key}
            onChange={(patch) => props.onPatchVariant(v.key, patch)}
            onRemove={() => props.onRemoveVariant(v.key)}
            onFocus={() => props.onFocusVariant(v.key)}
            bodyRef={props.bindBody(v.key)}
          />
        ))}
      </div>
      <Button variant="outline" disabled={step.variants.length >= MAX_VARIANTS} onClick={props.onAddVariant}>
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        Add version
      </Button>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove step ${index + 1}?`}
        description="It's removed from the sequence when you save. You can still cancel the whole edit."
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          props.onRemove();
        }}
      />
    </section>
  );
}

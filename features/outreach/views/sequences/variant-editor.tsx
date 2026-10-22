'use client';

/**
 * One variant of a step: subject, message, weight and on/off.
 *
 * Focus is reported upward so the merge-field menu and the preview know
 * which message the founder is working on.
 *
 * @module features/outreach/views/sequences/variant-editor
 */
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';

import { parseShare } from '../campaigns/share-input';

import { type Channel, type DraftVariant, type VariantPatch } from './sequence-draft';
import { variantWarnings } from './variant-preview';

interface VariantEditorProps {
  variant: DraftVariant;
  label: string;
  channel: Channel;
  /** Subject is required when this email starts a new thread. */
  startsThread: boolean;
  canRemove: boolean;
  focused: boolean;
  onChange: (patch: VariantPatch) => void;
  onRemove: () => void;
  onFocus: () => void;
  /** Gives the editor the textarea, so merge fields can go in at the cursor. */
  bodyRef: (el: HTMLTextAreaElement | null) => void;
}

/** Editing block for one A/B/C variant. */
export function VariantEditor({
  variant, label, channel, startsThread, canRemove, focused, onChange, onRemove, onFocus, bodyRef,
}: VariantEditorProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Why: the field holds its own text so a cleared box stays empty while typing; the saved share only changes on a number.
  const [shareDraft, setShareDraft] = useState<string | null>(null);
  const warnings = variantWarnings(channel, variant.subject, variant.body);
  const email = channel === 'email';
  const hasSends = variant.sentCount > 0;
  return (
    <div className="space-y-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-medium text-text">
          Variant {label}
          {focused && <span className="ml-2 font-normal text-info">Previewing</span>}
        </p>
        {canRemove && (
          <Button
            variant="ghost"
            iconOnly
            aria-label={`Remove version ${label}`}
            disabled={hasSends}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        )}
      </div>
      {canRemove && hasSends && (
        <p className="text-body text-text-muted">
          This variant has sent messages, so it can&apos;t be removed. Switch it off instead to stop using it.
        </p>
      )}
      {email && (
        <Input
          label="Subject"
          value={variant.subject}
          maxLength={200}
          onFocus={onFocus}
          onChange={(e) => onChange({ subject: e.target.value })}
          help={startsThread ? 'Required, because this email starts a new thread.' : 'Optional. Leave blank to stay in the same thread.'}
        />
      )}
      <Textarea
        ref={bodyRef}
        label="Message"
        rows={10}
        maxLength={5000}
        value={variant.body}
        onFocus={onFocus}
        onSelect={onFocus}
        onChange={(e) => onChange({ body: e.target.value })}
        help="Use {{first_name|there}} for a fallback when the name is missing. Keep emails to one link."
      />
      <div className="flex flex-wrap items-end gap-6">
        <div className="w-32">
          <Input
            label="Share of people"
            tooltip="This version's share of people, compared with the other versions of this message. Equal shares give each version an equal chance."
            tooltipMultiline
            type="number"
            min={0}
            max={100}
            value={shareDraft ?? String(variant.weight)}
            onFocus={onFocus}
            onBlur={() => setShareDraft(null)}
            onChange={(e) => {
              setShareDraft(e.target.value);
              const n = parseShare(e.target.value);
              if (n !== null) onChange({ weight: n });
            }}
          />
        </div>
        <Toggle checked={variant.active} onChange={(active) => onChange({ active })} label="Active" ariaLabel={`Version ${label} active`} />
      </div>
      {warnings.length > 0 && (
        <ul className="space-y-1 text-body text-warning">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove version ${label}?`}
        description="It's removed from this step when you save."
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove();
        }}
      />
    </div>
  );
}

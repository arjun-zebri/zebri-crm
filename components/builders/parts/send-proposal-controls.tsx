'use client';

/**
 * The one control row of the Send a proposal modal: who it goes to, which
 * template it is, and when it expires.
 *
 * Deliberately nothing else. The founder's review of the old builder was
 * that the intro note, hero, packages, add-ons and terms "should just come
 * from the template", so the only decisions left here are the three that
 * genuinely change from one send to the next.
 *
 * Reuses `BuilderMetaRow` rather than a picker of its own, so the couple
 * search, the tab order and the 32px control height are the same ones the
 * quote and invoice builders already use.
 *
 * @module components/builders/parts/send-proposal-controls
 */
import { Select } from '@/components/ui/select';
import type { TemplateListItem } from '@/features/proposals';

import { BuilderMetaRow, type CoupleOption } from './builder-meta-row';

/** Props for {@link SendProposalControls}. */
export interface SendProposalControlsProps {
  couples: CoupleOption[];
  selectedCoupleId: string | null;
  selectedCoupleName: string | null;
  onSelectCouple: (couple: CoupleOption) => void;
  templates: TemplateListItem[];
  /** The template being previewed, or null while the list is loading or empty. */
  selectedTemplate: TemplateListItem | null;
  onSelectTemplate: (templateId: string) => void;
  /** `YYYY-MM-DD`, or null while the template's expiry default is still loading. */
  expiresAt: string | null;
  onExpiresAtChange: (next: string | null) => void;
  /** Locks every control while a send or a create is in flight. */
  disabled: boolean;
}

/** See {@link SendProposalControlsProps}. */
export function SendProposalControls({
  couples,
  selectedCoupleId,
  selectedCoupleName,
  onSelectCouple,
  templates,
  selectedTemplate,
  onSelectTemplate,
  expiresAt,
  onExpiresAtChange,
  disabled,
}: SendProposalControlsProps) {
  return (
    <BuilderMetaRow
      selectedCoupleId={selectedCoupleId}
      selectedCoupleName={selectedCoupleName}
      coupleOptions={couples}
      canEditCouple={!disabled}
      onSelectCouple={onSelectCouple}
      // Rendered only once there is a real template to name: a Radix
      // Select whose value is the empty string crashes, and an empty
      // dropdown is nothing to offer anyway (memory:
      // select_empty_value_constraint).
      extra={
        selectedTemplate ? (
          <Select
            ariaLabel="Proposal template"
            className="w-48"
            value={selectedTemplate.id}
            onValueChange={onSelectTemplate}
            disabled={disabled}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        ) : null
      }
      dateValue={expiresAt}
      dateLabel="Set expiry date"
      datePrefix="Expires"
      onDateChange={onExpiresAtChange}
      canEdit={!disabled}
    />
  );
}

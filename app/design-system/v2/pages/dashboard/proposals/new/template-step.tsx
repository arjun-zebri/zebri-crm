import { ChoiceCard } from '@/components/ui-v2/choice-card';

import { TemplateThumb } from '../templates/template-thumb';
import { TEMPLATES, type TemplateId } from '../templates-data';

/**
 * The second step of a new proposal: which template to start from, as
 * thumbnails. Shared by New proposal on the Proposals page and Send a
 * proposal on Home.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/new/template-step
 */

export interface TemplateStepProps {
  /** Who the proposal is for, named in the prompt. */
  who: string | null;
  value: TemplateId | null;
  onChange: (t: TemplateId) => void;
}

/** The template step. See {@link TemplateStepProps}. */
export function TemplateStep({ who, value, onChange }: TemplateStepProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="pb-2 type-body text-zebra-500">Start from a template for {who}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <ChoiceCard key={t.id} selected={value === t.id} onClick={() => onChange(t.id)} className="overflow-hidden p-0">
            <TemplateThumb template={t} size="pick" />
            <span className="px-4 py-3 type-label">{t.name}</span>
          </ChoiceCard>
        ))}
      </div>
    </fieldset>
  );
}

'use client';

/**
 * The picker's first view: the MC's workflows, each with a Start button.
 *
 * Start only chooses the workflow; the picker then shows the preview,
 * and nothing is applied until the MC confirms there.
 *
 * @module app/(dashboard)/couples/workflow-apply-list
 */

import { Button } from '@/components/ui/button';

/** One workflow the picker can start. */
export interface ApplicableTemplate {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkflowApplyListProps {
  templates: ApplicableTemplate[];
  /** Template ids already running on this couple. */
  appliedTemplateIds: string[];
  onChoose: (template: ApplicableTemplate) => void;
}

/** The workflow list. See {@link WorkflowApplyListProps}. */
export function WorkflowApplyList({
  templates,
  appliedTemplateIds,
  onChoose,
}: WorkflowApplyListProps) {
  return (
    <ul className="divide-y divide-border">
      {templates.map((template) => {
        const already = appliedTemplateIds.includes(template.id);
        return (
          <li key={template.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-body text-text">{template.name}</span>
              {template.description ? (
                <span className="block truncate text-body text-text-muted">
                  {template.description}
                </span>
              ) : already ? (
                <span className="block text-body text-text-muted">Already running</span>
              ) : null}
            </div>
            <Button variant={already ? 'outline' : 'primary'} onClick={() => onChoose(template)}>
              {already ? 'Start again' : 'Start'}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

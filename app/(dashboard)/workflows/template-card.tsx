'use client';

/**
 * One workflow, as a card in the library grid.
 *
 * Rows were the wrong shape here. A workflow is a thing an MC owns and
 * reasons about ("is this one running, and on how many couples?"), not
 * a record in a table, and the two facts that decide whether they touch
 * it, the switch and the couples running, were the two hardest to see
 * in a row of columns.
 *
 * The switch is on the card rather than buried in an overflow menu
 * because turning a workflow on and off is the single most common thing
 * done to one, and it is also the most consequential: a card that shows
 * you which of your workflows are live, at a glance, is the whole point
 * of the page.
 *
 * @module app/(dashboard)/workflows/template-card
 */

import { Copy, Tags, Trash2 } from 'lucide-react';

import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { Toggle } from '@/components/ui/toggle';
import { TAG_PILL_CLASS, toTagColor, type TemplateStatus } from '@/types/workflows';

import type { TemplateListRow } from './actions';
import { applyRuleLabel } from './apply-rule-label';

export interface TemplateCardProps {
  template: TemplateListRow;
  tags: { id: string; name: string; color: string; position: number }[];
  onOpen: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onSetStatus: (templateId: string, status: TemplateStatus) => void;
  /** Opens the tag picker for this workflow. */
  onEditTags: (templateId: string) => void;
}

/** The running line, which is the honest version of the status pill. */
function runningLine(template: TemplateListRow): string {
  const n = template.activeInstances;
  const couples = n === 0 ? 'no couples running' : `${n} ${n === 1 ? 'couple' : 'couples'} running`;
  // Archiving is no longer offered - the toggle pauses a workflow and
  // Delete removes it, which is the whole vocabulary an MC wanted - but
  // rows archived before it went keep reading honestly, and turning one
  // on revives it.
  if (template.status === 'archived') return `Archived · ${couples}`;
  // "Paused" rather than "Draft": an MC is deciding whether it runs, not
  // what stage of authorship it is at.
  return template.status === 'active' ? `Live · ${couples}` : `Paused · ${couples}`;
}

/** A workflow card. See {@link TemplateCardProps}. */
export function TemplateCard({
  template,
  tags,
  onOpen,
  onDuplicate,
  onDelete,
  onSetStatus,
  onEditTags,
}: TemplateCardProps) {
  const tagList = tags.filter((t) => template.tagIds.includes(t.id));
  const isActive = template.status === 'active';

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => onOpen(template.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(template.id);
        }
      }}
      className="flex h-full cursor-pointer flex-col rounded-control border border-border bg-card p-4 transition-colors hover:border-border-strong focus:outline-none focus-visible:border-border-strong"
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-body font-semibold text-text">{template.name}</span>

        {/* Stops the card's own click handler: flipping the switch must
            not also open the builder. */}
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Toggle
            checked={isActive}
            onChange={(next) => onSetStatus(template.id, next ? 'active' : 'draft')}
            ariaLabel={`${isActive ? 'Turn off' : 'Turn on'} ${template.name}`}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <RowActionsMenu
            size="sm"
            alwaysVisible
            actions={[
              {
                label: 'Tags',
                icon: <Tags size={16} strokeWidth={1.5} />,
                onSelect: () => onEditTags(template.id),
              },
              {
                label: 'Duplicate',
                icon: <Copy size={16} strokeWidth={1.5} />,
                onSelect: () => onDuplicate(template.id),
              },
              {
                label: 'Delete',
                icon: <Trash2 size={16} strokeWidth={1.5} />,
                destructive: true,
                onSelect: () => onDelete(template.id),
              },
            ]}
          />
        </div>
      </div>

      <p className="mt-2 mb-3 line-clamp-2 min-h-10 text-body text-text-muted">
        {template.description || 'No description yet.'}
      </p>

      {/* `mb-3` matches the description's own gap: without it the pills
          sit on the footer rule. */}
      {tagList.length > 0 ? (
        <div className="mt-2 mb-3 flex flex-wrap gap-1">
          {tagList.map((tag) => (
            <span
              key={tag.id}
              className={`rounded-pill px-2 py-0.5 text-body ring-1 ring-inset ${TAG_PILL_CLASS[toTagColor(tag.color)]}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* `mt-auto` pins the footer to the bottom so cards in a row line
          their stats up, however long the descriptions are. */}
      <div className="mt-auto border-t border-border pt-3">
        <p className="text-body text-text-muted">
          {template.stepCount} {template.stepCount === 1 ? 'step' : 'steps'} ·{' '}
          {applyRuleLabel(template.apply_rule_type, template.apply_rule_config)}
        </p>
        <p className="mt-1 text-body text-text-muted">{runningLine(template)}</p>
      </div>
    </div>
  );
}

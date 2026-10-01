import { MediaCard } from '@/components/ui-v2/media-card';

import { templateStats } from '../insights';
import type { Proposal } from '../proposals-data';
import { TEMPLATES, type TemplateId } from '../templates-data';

import { TemplateThumb } from './template-thumb';

/**
 * The Templates tab: a v2 `MediaCard` per template, its cover in
 * miniature over its name, when to use it, and how it has done (times
 * sent and the share accepted of those answered). The whole card opens
 * the template's preview. New template, in the toolbar, is the tab's one
 * primary.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/templates/templates-view
 */

export interface TemplatesViewProps {
  proposals: Proposal[];
  onOpen: (id: TemplateId) => void;
}

/** The Templates tab. See {@link TemplatesViewProps}. */
export function TemplatesView({ proposals, onOpen }: TemplatesViewProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TEMPLATES.map((t) => {
        const s = templateStats(proposals, t.id);
        return (
          <li key={t.id}>
            <MediaCard media={<TemplateThumb template={t} />} title={t.name} onOpen={() => onOpen(t.id)}>
              <p className="type-body text-zebra-500">{t.use}</p>
              <p className="type-body tabular-nums text-zebra-700">
                {s.sent ? `Sent ${s.sent} times${s.rate === null ? '' : ` · ${s.rate}% accepted`}` : 'Not sent yet'}
              </p>
            </MediaCard>
          </li>
        );
      })}
    </ul>
  );
}

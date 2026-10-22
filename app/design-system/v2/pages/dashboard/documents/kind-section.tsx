import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { ROW } from '@/components/ui-v2/control-styles';
import { ChevronRightIcon } from '@/components/ui-v2/icons';
import { RowSections } from '@/components/ui-v2/row-sections';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import type { KindInfo } from './kinds';

/**
 * One kind of document on the Documents page, as a v2 `RowSections`
 * section (2026-10-14: space between kinds, rows on a glass panel, no
 * rules): its name and how many, folding shut from the heading, then a
 * row per template (its name, when to use it, and on the right
 * the journey step that sends it, or how it has done). A row opens that
 * template's preview, which holds Edit. No icons or per-kind +: the
 * page's New makes any kind (2026-10-09 founder mockup). Kinds with no
 * template show as setup cards instead (`setup-cards.tsx`); the empty
 * row here is only for marriage paperwork, which has no template.
 *
 * @module app/design-system/v2/pages/dashboard/documents/kind-section
 */

/** One template as a row. */
export interface TemplateRow {
  key: string;
  name: string;
  /** When to use it: "Ceremony to last dance · 3 packages". */
  detail: string;
  /** How it has done, quiet on the right: "Sent 4 times". */
  note: string;
  /** Opens its preview. */
  onOpen: () => void;
  /** A button of its own on the row (a couple's Send form), above the row's hit area. */
  action?: ReactNode;
}

export interface KindSectionProps {
  kind: KindInfo;
  rows: TemplateRow[];
  /** The row the journey sends, by key, and its step counted from 1. */
  journey: { key: string | null; step: number } | null;
  /** What the kind is for, under "No … yet" when there is no step waiting. */
  use: string;
  onNew: () => void;
  /** Above the rows, e.g. Zebri's line the first time a block lands here. */
  lead?: ReactNode;
}

/** Stands in for the rows of a kind with no template: one "No … yet" row. */
const EMPTY = { key: '', name: '', detail: '', note: '', onOpen: () => undefined } satisfies TemplateRow;

/** A kind's section. See {@link KindSectionProps}. */
export function KindSection({ kind, rows, journey, use, onNew, lead }: KindSectionProps) {
  const one = kind.one.toLowerCase();
  return (
    // The id is where arriving on a kind scrolls to.
    <div id={`kind-${kind.id}`} className="space-y-3">
      {lead}
      <RowSections
        // A grass dot when the journey sends one of these, grey otherwise.
        sections={[{ id: kind.id, title: kind.label, dot: journey ? 'bg-grass-500' : 'bg-zebra-300' }]}
        items={rows.length ? rows : [EMPTY]}
        sectionOf={() => kind.id}
        count={() => rows.length}
        renderRow={(r) => {
          if (r === EMPTY)
            return (
              // The first-run guide points at a kind's first row: `new-proposal`, `new-contract`, …
              <li key="empty" data-tour={`new-${one}`} className="flex items-center gap-4 rounded-button px-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="type-body text-zebra-950">No {one} yet</p>
                  <p className="type-body text-zebra-500">
                    {journey ? `Step ${journey.step} of your journey is waiting on this` : use}
                  </p>
                </div>
                <Button variant="secondary" onClick={onNew}>
                  Set up
                </Button>
              </li>
            );
          const sent = journey !== null && journey.key === r.key;
          return (
            <li
              key={r.key}
              data-tour={r === rows[0] ? `new-${one}` : undefined}
              className={`relative flex items-center gap-4 rounded-button px-3 py-4 ${ROW}`}
            >
              <div className="min-w-0 flex-1">
                <StretchedButton label={`Preview ${r.name}`} onClick={r.onOpen}>
                  <span className="block truncate type-label text-zebra-950">{r.name}</span>
                </StretchedButton>
                <p className="truncate type-body text-zebra-500">{r.detail}</p>
              </div>
              {sent ? (
                <span className="hidden shrink-0 sm:block">
                  <Badge dot tone="grass">
                    Step {journey.step} of your journey
                  </Badge>
                </span>
              ) : (
                <p className="hidden shrink-0 type-body text-zebra-400 sm:block">{r.note}</p>
              )}
              {r.action ? <div className="relative z-10 shrink-0">{r.action}</div> : null}
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-400" />
            </li>
          );
        }}
      />
    </div>
  );
}

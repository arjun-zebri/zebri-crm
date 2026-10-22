'use client';

import { AddTile } from '@/components/ui-v2/add-tile';

import { ROLES } from '../../brand/kit';
import { useCanvasData } from '../canvas-context';
import { textCss } from '../resolve';

import type { RailApi } from './api';
import { fieldOf, TEXT_WORDS, textOf } from './presets';

/**
 * The Text tab: one line per text style, written in that style ("Add a
 * heading" in the heading face, at a size that fits the panel), and the
 * words Zebri fills in for this document (the couple's names, the date,
 * the total), each shown as it reads now.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/rail/text-panel
 */

/** The Text tab. */
export function TextPanel({ api }: { api: RailApi }) {
  const { kit, fields, fieldNames = {} } = useCanvasData();
  const named = Object.keys(fieldNames).filter((f) => f in fields);
  return (
    <div className="space-y-6">
      <section aria-label="Text styles" className="space-y-2">
        {ROLES.map(({ role }) => {
          const css = textCss({ role }, kit);
          return (
            <AddTile key={role} shape="row" label={TEXT_WORDS[role]} onAdd={() => api.add(textOf(role))} {...api.drag(() => textOf(role))}>
              {/* The style itself, capped to fit the panel. */}
              <span style={{ ...css, fontSize: Math.min(Number(css.fontSize), 28), color: undefined }} className="block truncate text-zebra-950">
                {TEXT_WORDS[role]}
              </span>
            </AddTile>
          );
        })}
      </section>
      {named.length ? (
        <section aria-label="Filled in by Zebri" className="space-y-2">
          <h3 className="type-label text-zebra-950">Filled in by Zebri</h3>
          {named.map((f) => (
            <AddTile key={f} shape="row" label={`Add ${fieldNames[f]}`} onAdd={() => api.add(fieldOf(f, fieldNames[f]!))} {...api.drag(() => fieldOf(f, fieldNames[f]!))}>
              <span className="min-w-0">
                <span className="block type-body text-zebra-500">{fieldNames[f]}</span>
                <span className="block truncate type-body text-zebra-950">{fields[f]}</span>
              </span>
            </AddTile>
          ))}
        </section>
      ) : null}
    </div>
  );
}

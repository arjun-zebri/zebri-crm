'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { createContext, useContext } from 'react';

import type { ScriptField } from './scripts-data';

/**
 * How the page draws a field (`FieldChip`): the client's real answer in
 * plain text, exactly as it prints (a tint on every name made the page
 * look like a form), or its label in amber while the answer is still to
 * come. Either way it prints as plain words.
 *
 * @module app/design-system/v2/pages/dashboard/scripts/script-nodes
 */

/** The fields the open script fills in, for its chips to read. */
export const ScriptFieldsContext = createContext<ScriptField[]>([]);

/** A field in the page. */
export function FieldChip({ node }: NodeViewProps) {
  const field = useContext(ScriptFieldsContext).find((f) => f.id === node.attrs.id);
  const value = field?.value;
  return (
    <NodeViewWrapper
      as="span"
      title={field ? `${field.label}, filled in from their details` : undefined}
      // No mark of its own when selected: a ring round every name in a dragged
      // selection read as boxes. The browser's own highlight covers it like
      // the words around it.
      className={value ? undefined : 'rounded-check bg-warning/15 px-1 py-px text-warning-ink'}
    >
      {value ?? field?.label ?? 'Detail'}
    </NodeViewWrapper>
  );
}

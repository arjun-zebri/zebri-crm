'use client';

import { lineItemsData, lineItemsOf } from '../../doc-types/invoice/lines';
import type { DocSection } from '../../model/types';
import type { DocEditor } from '../../state/use-doc-editor';

import { ShowMenu } from './word-menus';

/**
 * An invoice's lines block on its bar: Show, whether the GST is broken
 * out under the lines (subtotal, then GST) and whether each line says
 * what share of the fee it is. The figures themselves are worked out, so
 * they are not typed; every word around them is the MC's own text.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/line-items-options
 */

const LINES: { key: 'gst' | 'detail'; label: string }[] = [
  { key: 'gst', label: 'GST breakdown' },
  { key: 'detail', label: 'Share of the fee' },
];

/** Show, for `section`. */
export function LineItemsOptions({ builder, section }: { builder: DocEditor; section: DocSection }) {
  const data = lineItemsOf(section);
  // The raw data, so the MC's words travel with the toggle unchanged.
  const toggle = (key: 'gst' | 'detail') =>
    builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'lineItems', lineItems: { ...lineItemsData(section), [key]: !data[key] } } }, { commit: true });
  return <ShowMenu lines={LINES} on={data} onToggle={toggle} />;
}

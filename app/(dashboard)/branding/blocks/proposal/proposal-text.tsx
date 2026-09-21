'use client'

import { RichText, type EnterKeyMode } from '../rich-text/rich-text'
import type { RichTextValue } from '../types'

/**
 * A proposal-surface rich-text field, wrapped in a `data-subtarget` so
 * clicking it points the block toolbar's style controls at this part. Every
 * editable text field on a proposal block uses this, so they all behave the
 * same: select text for the inline formatting bar, insert `{{ variables }}`,
 * and get consistent Enter handling. Replaces the older plain `InlineText`
 * for these blocks.
 *
 * @param subtarget - The `data-subtarget` key the block toolbar targets;
 *   omit for a field the toolbar has no per-part control for (a quote, an FAQ
 *   answer), so clicking it does not retarget the toolbar.
 * @param enterKey - Enter behaviour: `blur` for one-line labels/headings,
 *   `paragraph` for multi-line body copy, `lineBreak` for display headings.
 */
export function ProposalText({
  subtarget,
  value,
  onChange,
  placeholder,
  enterKey = 'blur',
  className = '',
  style,
}: {
  subtarget?: string
  value: RichTextValue
  onChange: (v: RichTextValue) => void
  placeholder?: string
  enterKey?: EnterKeyMode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span {...(subtarget ? { 'data-subtarget': subtarget } : {})} className="block">
      <RichText
        surface="proposal"
        value={value}
        onChange={onChange}
        enterKey={enterKey}
        className={className}
        {...(placeholder !== undefined ? { placeholder } : {})}
        {...(style !== undefined ? { style } : {})}
      />
    </span>
  )
}

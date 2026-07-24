'use client'

import { useEffect, useRef } from 'react'

import { sanitizeHtml } from '@/lib/branding/sanitize'

type InlineTextElement = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3'

interface InlineTextProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  /** When true, allow ul/ol/li in HTML output. Default = multiline. */
  allowLists?: boolean
  className?: string
  style?: React.CSSProperties
  as?: InlineTextElement
}

/**
 * InlineText renders a contentEditable element for inline text editing within
 * branding blocks. Supports HTML sanitization, placeholder text, and character limits.
 */
export function InlineText({
  value,
  onChange,
  placeholder,
  maxLength = 2000,
  multiline = false,
  allowLists,
  className = '',
  style,
  as = 'span',
}: InlineTextProps) {
  const ref = useRef<HTMLElement>(null)
  const lists = allowLists ?? multiline

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) return
    const sanitized = sanitizeHtml(value ?? '', { allowLists: lists })
    if (el.innerHTML === sanitized) return
    // Snapshot the document selection before replacing content. Assigning
    // innerHTML to a contentEditable can move the selection onto this
    // (unfocused) element, which flashes a highlight on every keystroke when
    // the value is being driven from another field showing the same value
    // (e.g. editing the business name reflects into every business-name block).
    // Restore the prior selection, or clear the stray one, so nothing else
    // highlights.
    const sel = window.getSelection()
    const saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null
    el.innerHTML = sanitized
    if (sel && sel.anchorNode && el.contains(sel.anchorNode)) {
      sel.removeAllRanges()
      if (saved && saved.startContainer && !el.contains(saved.startContainer)) {
        sel.addRange(saved)
      }
    }
  }, [value, lists])

  const sharedProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: 'textbox',
    'aria-label': placeholder,
    'aria-multiline': multiline,
    'data-placeholder': placeholder,
    'data-inline-text': 'true',
    onFocus: () => {
      // When this element receives focus, ensure the parent block is selected.
      // Dispatch a custom event that bubbles to BlockFrame for selection handling.
      const el = ref.current
      if (el) {
        const blockEl = el.closest('[data-block-id]')
        if (blockEl && !blockEl.hasAttribute('data-selected')) {
          const blockId = blockEl.getAttribute('data-block-id')
          blockEl.dispatchEvent(
            new CustomEvent('zebri:text-focus', {
              bubbles: true,
              detail: { blockId },
            })
          )
        }
      }
    },
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain').slice(0, maxLength)
      document.execCommand('insertText', false, text)
    },
    // Commit on every input (not just blur) so an edit survives even if the
    // user refreshes/navigates without clicking away first. The value-sync
    // effect early-returns while this element is focused, so the caret is
    // preserved. Final normalisation still happens in onBlur.
    onInput: (e: React.FormEvent) => {
      const el = e.currentTarget as HTMLElement
      const html = sanitizeHtml(el.innerHTML, { allowLists: lists })
      if (html !== value) onChange(html)
    },
    onBlur: (e: React.FocusEvent) => {
      const el = e.currentTarget as HTMLElement
      let html = sanitizeHtml(el.innerHTML, { allowLists: lists })
      if (!multiline) {
        html = html.replace(/<\/?(p|ul|ol|li|br)[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      if (html.length > maxLength * 2) html = html.slice(0, maxLength * 2)
      if (html !== value) onChange(html)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!multiline && e.key === 'Enter') {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).blur()
      }
      if (e.key === 'Escape') {
        const el = e.currentTarget as HTMLElement
        el.innerHTML = sanitizeHtml(value, { allowLists: lists })
        el.blur()
      }
    },
    // Placeholder handling for an empty field. Unfocused, it shows the ghost
    // text at 40% opacity. Focused, it drops to 0 opacity rather than being
    // removed (`content-none` would collapse the pseudo-element's line box and
    // yank every block below upward). Keeping it present-but-invisible holds the
    // field's height, so clicking in gives you an empty box to type into with no
    // layout shift; the placeholder only truly vanishes once you type (`:empty`
    // no longer matches).
    //
    // `inline-block` (single-line fields only) is what makes the caret appear:
    // Chrome renders no caret in an EMPTY inline contentEditable, but does for
    // an inline-block one. Multiline fields stay in normal flow so their text
    // still wraps at the container edge.
    className: `outline-none cursor-text caret-current transition-colors ${multiline ? '' : 'inline-block'} empty:before:content-[attr(data-placeholder)] empty:before:opacity-40 empty:focus:before:opacity-0 ${className}`,
    style,
  }

  if (as === 'div') return <div ref={ref as React.RefObject<HTMLDivElement>} {...sharedProps} />
  if (as === 'p') return <p ref={ref as React.RefObject<HTMLParagraphElement>} {...sharedProps} />
  if (as === 'h1') return <h1 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  if (as === 'h2') return <h2 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  if (as === 'h3') return <h3 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  return <span ref={ref as React.RefObject<HTMLSpanElement>} {...sharedProps} />
}

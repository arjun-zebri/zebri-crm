'use client'

import { useEffect, useRef } from 'react'

type InlineTextElement = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3'

interface InlineTextProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  className?: string
  style?: React.CSSProperties
  as?: InlineTextElement
}

export function InlineText({
  value,
  onChange,
  placeholder,
  maxLength = 280,
  multiline = false,
  className = '',
  style,
  as = 'span',
}: InlineTextProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.textContent !== value) {
      el.textContent = value
    }
  }, [value])

  const sharedProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: 'textbox',
    'aria-label': placeholder,
    'aria-multiline': multiline,
    'data-placeholder': placeholder,
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain').slice(0, maxLength)
      document.execCommand('insertText', false, text)
    },
    onBlur: (e: React.FocusEvent) => {
      const el = e.currentTarget as HTMLElement
      let text = el.textContent ?? ''
      if (!multiline) text = text.replace(/\n/g, ' ')
      text = text.slice(0, maxLength)
      if (text !== value) onChange(text)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!multiline && e.key === 'Enter') {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).blur()
      }
      if (e.key === 'Escape') {
        ;(e.currentTarget as HTMLElement).textContent = value
        ;(e.currentTarget as HTMLElement).blur()
      }
    },
    className: `outline-none rounded px-1 -mx-1 cursor-text hover:bg-gray-100/70 focus:bg-white focus:ring-2 focus:ring-gray-900/15 focus:ring-offset-1 transition empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 ${className}`,
    style,
  }

  if (as === 'div') return <div ref={ref as React.RefObject<HTMLDivElement>} {...sharedProps} />
  if (as === 'p') return <p ref={ref as React.RefObject<HTMLParagraphElement>} {...sharedProps} />
  if (as === 'h1') return <h1 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  if (as === 'h2') return <h2 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  if (as === 'h3') return <h3 ref={ref as React.RefObject<HTMLHeadingElement>} {...sharedProps} />
  return <span ref={ref as React.RefObject<HTMLSpanElement>} {...sharedProps} />
}

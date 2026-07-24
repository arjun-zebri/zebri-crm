'use client'

import { useEffect, useState, type ReactNode } from 'react'

/** Props for {@link Typewriter}. */
export interface TypewriterProps {
  /** The full string to reveal. */
  text: string
  /** True while this field is the one being typed into right now. */
  typing: boolean
  /** Milliseconds per character. Default 85 — deliberately unhurried. */
  charMs?: number
  className?: string
}

/**
 * Reveals `text` one character at a time while `typing`, with a blinking
 * caret, then rests on the full string once the beat moves on.
 *
 * When `typing` is false it renders the whole string immediately — that is
 * the "already typed" state for a field the animation has moved past, and
 * the reduced-motion state where nothing should animate at all.
 */
export function Typewriter({ text, typing, charMs = 85, className }: TypewriterProps) {
  const [count, setCount] = useState(typing ? 0 : text.length)

  // Reset during render (not in an effect) when the field flips into or out
  // of typing, or the text changes — the same pattern usePreviewScript uses
  // to avoid a set-state-in-effect. The interval below only ever advances.
  const key = `${typing}:${text}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setCount(typing ? 0 : text.length)
  }

  useEffect(() => {
    if (!typing) return
    const id = setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1))
    }, charMs)
    return () => clearInterval(id)
  }, [typing, text, charMs])

  const shown = typing ? text.slice(0, count) : text
  const caret = typing && count < text.length

  return (
    <span className={`inline-flex items-baseline ${className ?? ''}`}>
      <span>{shown}</span>
      {caret && <span className="inline-block w-px h-3 bg-text-subtle ml-px animate-pulse" />}
    </span>
  )
}

/** One piece of a {@link TypedRich} sequence: plain text or an atomic chip. */
export type RichSegment = { text: string } | { chip: ReactNode }

/** Props for {@link TypedRich}. */
export interface TypedRichProps {
  /** The content, in order. Text types per character; chips land whole. */
  segments: RichSegment[]
  /** True while this block is the one being typed right now. */
  typing: boolean
  /** Milliseconds per step. Default 40 — brisk, like confident typing. */
  charMs?: number
  className?: string
}

/**
 * A typewriter for mixed content: plain text reveals character by
 * character, while variable chips pop in whole when the caret reaches
 * them — which is exactly how inserting a mention feels in the real
 * editor. Rests on the full content when `typing` is false.
 */
export function TypedRich({ segments, typing, charMs = 40, className }: TypedRichProps) {
  const total = segments.reduce((n, s) => n + ('text' in s ? s.text.length : 1), 0)
  const [count, setCount] = useState(typing ? 0 : total)

  // Same render-time reset pattern as Typewriter.
  const key = `${typing}:${total}`
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setCount(typing ? 0 : total)
  }

  useEffect(() => {
    if (!typing) return
    const id = setInterval(() => {
      setCount((n) => (n >= total ? n : n + 1))
    }, charMs)
    return () => clearInterval(id)
  }, [typing, total, charMs])

  const shown = typing ? count : total
  const out: ReactNode[] = []
  let used = 0
  for (const [i, seg] of segments.entries()) {
    if (used >= shown) break
    if ('text' in seg) {
      const take = Math.min(seg.text.length, shown - used)
      out.push(<span key={i}>{seg.text.slice(0, take)}</span>)
      used += take
    } else {
      out.push(<span key={i}>{seg.chip}</span>)
      used += 1
    }
  }
  const caret = typing && shown < total

  return (
    <span className={className}>
      {out}
      {caret && <span className="inline-block w-px h-3 bg-text-subtle ml-px animate-pulse align-middle" />}
    </span>
  )
}

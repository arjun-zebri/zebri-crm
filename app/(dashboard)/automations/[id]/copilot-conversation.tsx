/**
 * Conversation rendering for the Zebri AI panel: welcome/empty state,
 * chat bubbles per entry kind (with the sender's name inside the
 * bubble, under the message), the typing reveal, and auto-scroll.
 *
 * @module app/(dashboard)/automations/[id]/copilot-conversation
 */
'use client'

import { useCallback, useEffect, useState } from 'react'

import { Loading } from '@/components/ui/loading'
import { createClient } from '@/lib/supabase/client'

import type { CopilotChatEntry } from './use-copilot-chat'

const WELCOME_ENTRY: CopilotChatEntry = {
  id: 'welcome',
  kind: 'assistant',
  text: 'Tell me what should happen and I’ll build it on the canvas. Try “When a couple books, wait 20 minutes, then send them a welcome email”.',
}

/**
 * Gap between reveals. Paired with {@link CHARS_PER_TICK} and the
 * word-boundary snap below, this lands around 25 words a second: the
 * pace a chat model streams at, and slow enough to read along with.
 */
const TICK_MS = 40

/** Characters per tick, before snapping out to the end of the word. */
const CHARS_PER_TICK = 6

/**
 * Ceiling on a single reveal. Long answers step faster rather than
 * making anyone sit through half a minute of typing; ordinary ones
 * never reach this and run at the rate above.
 */
const MAX_REVEAL_MS = 15000

/** The MC's first name (from their user-owned display_name). */
function useFirstName(): string {
  const [firstName, setFirstName] = useState('You')
  useEffect(() => {
    let cancelled = false
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        const display = data.user?.user_metadata?.display_name as string | undefined
        const first = display?.trim().split(/\s+/)[0]
        if (first && !cancelled) setFirstName(first)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return firstName
}

export function CopilotConversation({
  entries,
  busy,
  activity,
  draftOnly,
}: {
  entries: CopilotChatEntry[]
  busy: boolean
  /** Transient tool status line; null while the model is thinking. */
  activity: string | null
  draftOnly: boolean
}) {
  const firstName = useFirstName()

  // Entries whose reveal has already played. Reopening the panel, or
  // adding a later turn, must not retype everything above it.
  const [typedIds, setTypedIds] = useState<ReadonlySet<string>>(() => new Set())
  // Stable identity: this is an effect dependency inside every bubble,
  // so a fresh closure per render would restart each reveal.
  const markTyped = useCallback(
    (id: string) => setTypedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    [],
  )
  const last = entries[entries.length - 1]
  const typingId = last?.kind === 'assistant' && !typedIds.has(last.id) ? last.id : null

  // `flex-col-reverse` on the scroller keeps the newest turn in view,
  // and it is CSS rather than JavaScript on purpose. Two JS approaches
  // were tried here and neither proved reliable: scrolling from an
  // effect lost the race with that effect's own cleanup, and a
  // ResizeObserver did not fire dependably either. A reversed column
  // makes the browser anchor the scroll position to the bottom itself,
  // so new turns and every frame of the typing reveal stay pinned with
  // no scheduling to get wrong, and scrolling up still works.
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-2">
        {/* Permanent welcome bubble — an AI turn that stays at the top
            of the conversation rather than vanishing after first use. */}
        <Bubble entry={WELCOME_ENTRY} firstName={firstName} />
        {draftOnly && (
          <div className="text-body text-text-subtle leading-relaxed px-1">
            This automation is live. I can answer questions, but pause it before asking me to
            change steps.
          </div>
        )}
        {entries.map((e) => (
          <Bubble
            key={e.id}
            entry={e}
            firstName={firstName}
            typing={e.id === typingId}
            onTyped={markTyped}
          />
        ))}
        {busy && (
          <Loading
            variant="inline"
            size={14}
            label={`${activity ?? 'Thinking'}…`}
            className="px-1 text-text-subtle"
          />
        )}
      </div>
    </div>
  )
}

/**
 * Reveals `text` a chunk at a time. Returns the whole string at once
 * when `enabled` is false, so an already-seen turn and a
 * reduced-motion reader both get it immediately.
 */
function useTypedText(
  text: string,
  enabled: boolean,
  entryId: string,
  onDone: (id: string) => void,
): string {
  const [count, setCount] = useState(enabled ? 0 : text.length)

  useEffect(() => {
    if (!enabled) return
    // Reduced motion is read here rather than held in state: a
    // media-query read during render would either break hydration or
    // need a setState in an effect to correct itself. A step the size
    // of the whole message finishes on the first tick, so the reveal
    // simply does not happen.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const step = reduced
      ? text.length
      : Math.max(CHARS_PER_TICK, Math.ceil(text.length / (MAX_REVEAL_MS / TICK_MS)))
    let shown = 0
    const timer = setInterval(() => {
      shown += step
      // Run on to the end of the current word. A token stream never
      // splits one, and stopping mid-word ("your enquiry f") is the
      // tell that this is a character animation rather than a reply
      // arriving.
      if (shown < text.length) {
        const boundary = text.slice(shown).search(/\s/)
        if (boundary > 0) shown += boundary
      }
      if (shown >= text.length) {
        clearInterval(timer)
        setCount(text.length)
        onDone(entryId)
      } else {
        setCount(shown)
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [text, enabled, entryId, onDone])

  return enabled ? text.slice(0, count) : text
}

/** Shared no-op so the default props keep a stable identity. */
const NOOP = () => {}

/** The sender's name sits under the message text, inside the bubble. */
function SenderName({ name, alignEnd }: { name: string; alignEnd?: boolean }) {
  return (
    <div className={`text-body text-text-subtle mt-1 ${alignEnd ? 'text-right' : ''}`}>{name}</div>
  )
}

function Bubble({
  entry,
  firstName,
  typing = false,
  onTyped = NOOP,
}: {
  entry: CopilotChatEntry
  firstName: string
  typing?: boolean
  onTyped?: (id: string) => void
}) {
  const shown = useTypedText(entry.text, typing, entry.id, onTyped)

  if (entry.kind === 'user') {
    return (
      <div className="self-end max-w-[85%] bg-brand/10 border border-border rounded-control px-3 py-2 text-body text-text leading-relaxed whitespace-pre-wrap">
        {entry.text}
        <SenderName name={firstName} alignEnd />
      </div>
    )
  }
  if (entry.kind === 'error') {
    return (
      <div className="border border-danger/40 text-danger rounded-control px-3 py-2 text-body leading-relaxed">
        {entry.text}
      </div>
    )
  }
  return (
    <div className="bg-surface-muted rounded-control px-3 py-2 text-body text-text leading-relaxed whitespace-pre-wrap">
      {shown}
      <SenderName name="AI" />
    </div>
  )
}

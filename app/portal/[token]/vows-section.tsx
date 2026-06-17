'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Heart } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { PortalVow } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface VowsSectionProps {
  token: string
  initialVows: PortalVow[]
  viewer: 'primary' | 'spouse'
  primaryName: string | null
  secondaryName: string | null
}

/**
 * Couple-facing vows capture — privacy-scoped to ONE partner.
 *
 * Each partner opens the portal through their own link, so `initialVows`
 * only ever contains this viewer's own vow (the server filters the other
 * partner's out). We render a single autosaving editor plus a gentle note
 * that the partner is writing theirs separately, so the vows stay a
 * surprise. Saving goes through the token-gated `save_portal_vow` RPC,
 * which derives `who` from the token itself — the client physically
 * cannot write (or read) the other partner's vow.
 */
export function VowsSection({
  token,
  initialVows,
  viewer,
  primaryName,
  secondaryName,
}: VowsSectionProps) {
  const own = initialVows.find((v) => v.who === viewer)
  const [content, setContent] = useState(own?.content ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  // Stable id for the upsert so reloads reuse the same row. Falls back
  // to a fresh uuid for a partner who hasn't written anything yet.
  const vowIdRef = useRef<string>(own?.id ?? crypto.randomUUID())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const partnerName = viewer === 'primary' ? secondaryName : primaryName

  const persist = useCallback(
    async (text: string) => {
      setStatus('saving')
      const { error } = await anonSupabase().rpc('save_portal_vow', {
        p_token: token,
        p_id: vowIdRef.current,
        p_content: text,
      })
      setStatus(error ? 'error' : 'saved')
      if (!error) {
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      }
    },
    [token],
  )

  // Debounced autosave — honours the portal's "everything saves
  // automatically" promise: 800ms after the last keystroke we persist.
  const onChange = (text: string) => {
    setContent(text)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(text), 800)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-text-muted">
        These autosave as you type. Only you and your MC can see them.
      </p>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="vows-own" className="text-sm font-medium text-text">
            Your vows
          </label>
          <SaveIndicator status={status} />
        </div>
        <textarea
          id="vows-own"
          className="w-full min-h-[420px] resize-none rounded-lg border border-border bg-surface p-3 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          placeholder="Write your vows here…"
          value={content}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
        <Heart size={15} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
        <span>
          {partnerName ? `${partnerName} is` : 'Your partner is'} writing theirs
          separately, kept private until the day.
        </span>
      </div>
    </div>
  )
}

/** Inline autosave status pill shown beside the editor label. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span className="text-xs text-text-subtle">Saving…</span>
  if (status === 'saved') return <span className="text-xs text-brand">Saved ✓</span>
  if (status === 'error') {
    return <span className="text-xs text-red-600">Couldn’t save. Retries on your next edit.</span>
  }
  return null
}

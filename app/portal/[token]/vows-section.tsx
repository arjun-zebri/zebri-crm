'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Heart } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'

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
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * Couple-facing vows capture - privacy-scoped to ONE partner.
 *
 * Each partner opens the portal through their own link, so `initialVows`
 * only ever contains this viewer's own vow (the server filters the other
 * partner's out). We render a single autosaving editor plus a gentle note
 * that the partner is writing theirs separately, so the vows stay a
 * surprise. Saving goes through the token-gated `save_portal_vow` RPC,
 * which derives `who` from the token itself - the client physically
 * cannot write (or read) the other partner's vow.
 */
export function VowsSection({
  token,
  initialVows,
  viewer,
  primaryName,
  secondaryName,
  branding,
}: VowsSectionProps) {
  const own = initialVows.find((v) => v.who === viewer)
  const [content, setContent] = useState(own?.content ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  // Stable id for the upsert so reloads reuse the same row. Falls back
  // to a fresh uuid for a partner who hasn't written anything yet.
  const vowIdRef = useRef<string>(own?.id ?? crypto.randomUUID())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const partnerName = viewer === 'primary' ? secondaryName : primaryName
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

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

  // Debounced autosave - honours the portal's "everything saves
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
      <p
        style={{
          fontSize: `${bodyDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
        }}
      >
        These autosave as you type. Only you and your MC can see them.
      </p>

      <div
        className="rounded-control p-5"
        style={{
          border: `1px solid ${branding.border_color}`,
          backgroundColor: branding.surface_color,
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="vows-own"
            className="font-medium"
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              color: bodyDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              fontWeight: 500,
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Your vows
          </label>
          <SaveIndicator status={status} branding={branding} />
        </div>
        <textarea
          id="vows-own"
          className="w-full min-h-[420px] resize-none rounded-control p-3 focus:outline-none"
          placeholder="Write your vows here..."
          value={content}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: `1px solid ${branding.border_color}`,
            backgroundColor: branding.surface_color,
            fontSize: `${bodyDefaults.fontSize}px`,
            color: bodyDefaults.color,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            fontWeight: bodyDefaults.fontWeight,
            lineHeight: bodyDefaults.lineHeight,
          }}
        />
      </div>

      <div
        className="flex items-center gap-2 rounded-control px-4 py-3"
        style={{
          border: `1px dashed ${branding.border_color}`,
          backgroundColor: branding.surface_color,
          fontSize: `${bodyDefaults.fontSize}px`,
          color: finePrintDefaults.color,
          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
          fontWeight: bodyDefaults.fontWeight,
          lineHeight: bodyDefaults.lineHeight,
        }}
      >
        <Heart size={15} strokeWidth={1.5} className="shrink-0" style={{ color: finePrintDefaults.color }} />
        <span>
          {partnerName ? `${partnerName} is` : 'Your partner is'} writing theirs
          separately, kept private until the day.
        </span>
      </div>
    </div>
  )
}

/** Inline autosave status pill shown beside the editor label. */
function SaveIndicator({ status, branding }: { status: SaveStatus; branding: PublicBranding }) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  const style = {
    fontSize: `${finePrintDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
    fontWeight: finePrintDefaults.fontWeight,
    lineHeight: finePrintDefaults.lineHeight,
  }

  if (status === 'saving')
    return (
      <span style={{ ...style, color: finePrintDefaults.color }}>
        Saving...
      </span>
    )
  if (status === 'saved')
    return (
      <span style={{ ...style, color: STATUS_COLORS.success }}>
        Saved
      </span>
    )
  if (status === 'error') {
    return (
      <span style={{ ...style, color: STATUS_COLORS.error }}>
        Couldn't save. Retries on your next edit.
      </span>
    )
  }
  return null
}

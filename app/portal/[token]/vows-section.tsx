'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'

import type { PortalVow } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

const WHO = [
  { key: 'primary', label: 'Your vows' },
  { key: 'spouse', label: "Your partner's vows" },
] as const

interface VowsSectionProps {
  token: string
  initialVows: PortalVow[]
}

/**
 * Couple-facing vows capture. One text box per partner; saving upserts
 * the vow via the token-gated `save_portal_vow` RPC, which fires the
 * `couple_completed_vows` automation trigger.
 */
export function VowsSection({ token, initialVows }: VowsSectionProps) {
  const [vows, setVows] = useState<PortalVow[]>(initialVows)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      WHO.map((w) => [w.key, initialVows.find((v) => v.who === w.key)?.content ?? '']),
    ),
  )
  const [savingWho, setSavingWho] = useState<string | null>(null)
  const [savedWho, setSavedWho] = useState<string | null>(null)

  const save = useCallback(
    async (who: string) => {
      setSavingWho(who)
      const existing = vows.find((v) => v.who === who)
      const id = existing?.id ?? crypto.randomUUID()
      const content = drafts[who] ?? ''
      const { error } = await anonSupabase().rpc('save_portal_vow', {
        p_token: token,
        p_id: id,
        p_who: who,
        p_content: content,
      })
      setSavingWho(null)
      if (!error) {
        setVows((prev) => [...prev.filter((v) => v.who !== who), { id, who, content }])
        setSavedWho(who)
        setTimeout(() => setSavedWho((s) => (s === who ? null : s)), 2000)
      }
    },
    [vows, drafts, token],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Write your vows here when you&apos;re ready. Only you and your MC can see them.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {WHO.map((w) => (
        <div key={w.key} className="bg-white rounded-lg border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-900 mb-2" htmlFor={`vows-${w.key}`}>
            {w.label}
          </label>
          <textarea
            id={`vows-${w.key}`}
            className="w-full min-h-[160px] resize-none rounded-md border border-gray-300 p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
            placeholder="Write your vows here…"
            value={drafts[w.key] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [w.key]: e.target.value }))}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => save(w.key)} disabled={savingWho === w.key}>
              {savingWho === w.key ? 'Saving…' : 'Save vows'}
            </Button>
            {savedWho === w.key && <span className="text-sm text-green-600">Saved ✓</span>}
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}

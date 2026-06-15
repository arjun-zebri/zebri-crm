'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

import { revertVowAction, updateVowAsMcAction } from './portal-actions'

interface Vow {
  id: string
  who: string
  content: string
}
interface Revision {
  id: string
  vow_id: string
  content: string
  author: string
  created_at: string
}

const WHO_LABEL: Record<string, string> = {
  primary: 'Primary partner',
  spouse: 'Spouse',
}

/**
 * Load the couple's vows + full revision history. RLS scopes both to
 * the signed-in MC (they own the rows). `vows` / `vow_revisions` aren't
 * in the generated DB types yet, hence the `as never` casts.
 */
async function loadVows(coupleId: string): Promise<{ vows: Vow[]; revisions: Revision[] }> {
  const supabase = createClient()
  const { data: v } = await supabase
    .from('vows' as never)
    .select('id, who, content')
    .eq('couple_id', coupleId)
  const vows = ((v ?? []) as unknown as Vow[]).sort((a, b) => a.who.localeCompare(b.who))

  const ids = vows.map((x) => x.id)
  let revisions: Revision[] = []
  if (ids.length) {
    const { data: r } = await supabase
      .from('vow_revisions' as never)
      .select('id, vow_id, content, author, created_at')
      .in('vow_id', ids)
      .order('created_at', { ascending: false })
    revisions = (r ?? []) as unknown as Revision[]
  }
  return { vows, revisions }
}

/**
 * MC-side vows editor inside the couple profile: edit each partner's
 * vows and revert to any prior version (incl. the couple's original).
 */
export function McPortalVows({ coupleId }: { coupleId: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['couple-vows', coupleId],
    queryFn: () => loadVows(coupleId),
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const vows = data?.vows ?? []
  const revisions = data?.revisions ?? []
  const reload = () => queryClient.invalidateQueries({ queryKey: ['couple-vows', coupleId] })

  const save = async (vowId: string, fallback: string) => {
    setBusy(true)
    await updateVowAsMcAction({ id: vowId, content: drafts[vowId] ?? fallback })
    await reload()
    setBusy(false)
  }
  const revert = async (vowId: string, revisionId: string) => {
    setBusy(true)
    await revertVowAction({ id: vowId, revisionId })
    setDrafts((d) => {
      const next = { ...d }
      delete next[vowId]
      return next
    })
    await reload()
    setBusy(false)
  }

  if (isLoading) return <p className="text-sm text-text-muted">Loading vows…</p>
  if (vows.length === 0) {
    return <p className="text-sm text-text-muted">The couple hasn&apos;t written any vows yet.</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {vows.map((vow) => {
        const history = revisions.filter((r) => r.vow_id === vow.id)
        const coupleOriginal = [...history].reverse().find((r) => r.author === 'couple')
        const value = drafts[vow.id] ?? vow.content
        return (
          <div key={vow.id} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text">{WHO_LABEL[vow.who] ?? vow.who}</span>
              <button
                type="button"
                onClick={() => setOpenHistory((h) => (h === vow.id ? null : vow.id))}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text cursor-pointer"
              >
                <History size={14} strokeWidth={1.5} /> History ({history.length})
              </button>
            </div>
            <textarea
              className="w-full min-h-[140px] resize-none rounded-md border border-border bg-surface p-3 text-sm text-text"
              value={value}
              onChange={(e) => setDrafts((d) => ({ ...d, [vow.id]: e.target.value }))}
            />
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={() => save(vow.id, vow.content)} disabled={busy}>
                Save
              </Button>
              {coupleOriginal && coupleOriginal.content !== vow.content && (
                <button
                  type="button"
                  onClick={() => revert(vow.id, coupleOriginal.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={14} strokeWidth={1.5} /> Revert to couple&apos;s original
                </button>
              )}
            </div>

            {openHistory === vow.id && (
              <ul className="mt-4 space-y-2 border-t border-border pt-3">
                {history.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="text-text-muted">
                        {r.author === 'couple' ? 'Couple' : 'You'} ·{' '}
                        {new Date(r.created_at).toLocaleString('en-AU')}
                      </span>
                      <p className="text-text-subtle truncate">{r.content || '(empty)'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revert(vow.id, r.id)}
                      disabled={busy}
                      className="shrink-0 text-xs text-brand hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

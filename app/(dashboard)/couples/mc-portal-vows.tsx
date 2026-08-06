'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, History, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

import { CoupleTabEmpty, CoupleTabShell } from './couple-tab-shell'
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

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-AU')
}

/** Load the couple's vows + revision history (RLS-scoped to the MC). */
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

/** Click-outside popover listing the vow's revisions; click one to restore. */
function HistoryPopover({
  history,
  onRestore,
  busy,
}: {
  history: Revision[]
  onRestore: (revisionId: string) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text cursor-pointer transition-colors"
      >
        <History size={14} strokeWidth={1.5} /> History ({history.length})
      </button>
      <div
        className={`absolute right-0 mt-2 w-52 z-30 origin-top-right rounded-control border border-gray-100 bg-white shadow-lg py-1 text-sm transition-all duration-150 ${
          open ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95'
        }`}
      >
        {history.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">No history yet</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {history.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onRestore(r.id)
                    setOpen(false)
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block">
                      {r.author === 'couple' ? "Couple's version" : 'Your edit'}
                      {i === 0 && <span className="text-gray-400"> · current</span>}
                    </span>
                    <span className="block text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                  </span>
                  {i !== 0 && (
                    <RotateCcw size={13} strokeWidth={1.5} className="shrink-0 text-gray-400" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Skeleton placeholder mirroring the two-card vows grid while data loads. */
function VowsSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 auto-rows-fr gap-6 flex-1 min-h-0 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col min-h-[280px]">
          <div className="flex items-center justify-between mb-2 px-3">
            <div className="h-4 w-28 rounded-control bg-gray-100" />
            <div className="h-4 w-20 rounded-control bg-gray-100" />
          </div>
          <div className="flex-1 w-full rounded-control bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

interface McPortalVowsProps {
  coupleId: string
  primaryName: string
  secondaryName: string | null
}

/**
 * MC-side vows editor inside the couple profile. Autosaves on blur (like
 * the other portal tabs), keeps a full revision history, and lets the MC
 * restore any version — restoring the couple's version marks it as theirs.
 */
export function McPortalVows({ coupleId, primaryName, secondaryName }: McPortalVowsProps) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['couple-vows', coupleId],
    queryFn: () => loadVows(coupleId),
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, 'saving' | 'saved' | undefined>>({})
  const [busy, setBusy] = useState(false)

  const vows = data?.vows ?? []
  const revisions = data?.revisions ?? []
  const reload = () => queryClient.invalidateQueries({ queryKey: ['couple-vows', coupleId] })

  const label = (who: string) =>
    who === 'primary' ? primaryName || 'Primary partner' : secondaryName || 'Partner'

  const autosave = async (vow: Vow) => {
    const draft = drafts[vow.id]
    if (draft === undefined || draft === vow.content) return
    setStatus((s) => ({ ...s, [vow.id]: 'saving' }))
    await updateVowAsMcAction({ id: vow.id, content: draft })
    await reload()
    setStatus((s) => ({ ...s, [vow.id]: 'saved' }))
    setTimeout(() => setStatus((s) => ({ ...s, [vow.id]: undefined })), 2000)
  }

  const restore = async (vowId: string, revisionId: string) => {
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

  // A vow row exists per partner slot; "written" means it has real content.
  const writtenCount = vows.filter((vow) => (vow.content ?? '').trim().length > 0).length

  return (
    <CoupleTabShell
      title="Vows"
      stats={
        vows.length > 0
          ? [
              writtenCount === vows.length
                ? { label: `${writtenCount} of ${vows.length} written`, tone: 'success' as const }
                : { label: `${writtenCount} of ${vows.length} written` },
            ]
          : undefined
      }
    >
      {isLoading ? (
        <VowsSkeleton />
      ) : vows.length === 0 ? (
        <CoupleTabEmpty
          icon={Heart}
          title="No vows yet"
          description="Vows will appear here once your couple writes them."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 auto-rows-fr gap-6 flex-1 min-h-0">
          {vows.map((vow) => {
            const history = revisions.filter((r) => r.vow_id === vow.id)
            const value = drafts[vow.id] ?? vow.content
            const st = status[vow.id]
            return (
              <div key={vow.id} className="flex flex-col min-h-[280px]">
                <div className="flex items-center justify-between mb-2 px-3">
                  <span className="text-sm font-medium text-text">{label(vow.who)}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs text-text-subtle transition-opacity duration-300 ${st ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {st === 'saving' ? 'Saving…' : 'Saved'}
                    </span>
                    <HistoryPopover history={history} onRestore={(id) => restore(vow.id, id)} busy={busy} />
                  </div>
                </div>
                <textarea
                  className="flex-1 w-full resize-none rounded-control border border-border bg-surface p-3 text-sm text-text transition-shadow focus:outline-none focus:ring-2 focus:ring-brand/30"
                  value={value}
                  placeholder="No vows written yet."
                  onChange={(e) => setDrafts((d) => ({ ...d, [vow.id]: e.target.value }))}
                  onBlur={() => autosave(vow)}
                />
              </div>
            )
          })}
        </div>
      )}
    </CoupleTabShell>
  )
}

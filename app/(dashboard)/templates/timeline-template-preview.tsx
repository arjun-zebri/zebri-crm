/**
 * Read-only run-sheet preview of a timeline template.
 *
 * Mirrors the other tabs' preview card chrome: a header with the template
 * name, then the ordered items as a time · title · duration run sheet.
 * Read-only — editing happens in the timeline editor modal.
 *
 * @module app/(dashboard)/templates/timeline-template-preview
 */
'use client'

/** A single run-sheet item to preview. */
export interface TimelinePreviewItem {
  id: string
  title: string
  start_time: string | null
  duration_min: number | null
  description: string | null
}

export function TimelineTemplatePreview({ name, items }: { name: string; items: TimelinePreviewItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs text-text-subtle">Run sheet</p>
        <p className="text-sm font-medium text-text">{name.trim() || <span className="text-text-subtle">Untitled</span>}</p>
      </div>
      <div className="px-4 py-4 text-sm">
        {items.length === 0 ? (
          <p className="text-text-subtle">No items yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3">
                <span className="w-14 shrink-0 tabular-nums text-text-muted">{it.start_time || '—'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-text">{it.title.trim() || 'Untitled'}</span>
                  {it.description ? <span className="mt-0.5 block text-xs text-text-subtle">{it.description}</span> : null}
                </span>
                {it.duration_min ? <span className="shrink-0 text-xs text-text-muted">{it.duration_min}m</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

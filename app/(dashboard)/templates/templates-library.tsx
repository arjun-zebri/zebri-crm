/**
 * Email-template master list (left pane of the Emails master-detail).
 *
 * Browses templates grouped by wedding-lifecycle stage — quiet stage
 * subheaders with calm, click-to-select rows beneath, mirroring the couple
 * Overview / Automations surfaces. Selecting a row drives the preview pane;
 * the row's edit/duplicate/delete actions live on that preview, so the list
 * itself stays scannable. Filtered by the toolbar `search`.
 *
 * @module app/(dashboard)/templates/templates-library
 */
'use client'

import { Mail } from 'lucide-react'
import { useMemo } from 'react'

import { ErrorState } from '@/components/ui/error-state'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES, type EmailTemplate, type LifecycleStage } from '@/types/email-template'

import { TemplatesSkeleton } from './templates-skeleton'

interface TemplatesLibraryProps {
  templates: EmailTemplate[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** Search query from the toolbar — filters by template name or subject. */
  search: string
  /** Currently-selected template id (drives the preview + row highlight). */
  selectedId: string | null
  onSelect: (template: EmailTemplate) => void
}

/** One lifecycle bucket plus its matching templates. `null` stage is the
 *  "Other" bucket for un-tagged templates, rendered last. */
interface StageGroup {
  key: LifecycleStage | 'other'
  label: string
  items: EmailTemplate[]
}

/** Render order: the journey stages first, then un-tagged templates. */
const GROUP_ORDER: (LifecycleStage | null)[] = [...LIFECYCLE_STAGES, null]

export function TemplatesLibrary({ templates, isLoading, isError, onRetry, search, selectedId, onSelect }: TemplatesLibraryProps) {
  // Group by lifecycle stage, preserving the position order the query
  // returns within each bucket. Search filters by name or subject; only
  // non-empty groups render so the page never shows a bare header.
  const groups = useMemo<StageGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const matches = (t: EmailTemplate) =>
      !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    return GROUP_ORDER.map((stage) => ({
      key: (stage ?? 'other') as LifecycleStage | 'other',
      label: stage ? LIFECYCLE_LABELS[stage] : 'Other',
      items: templates.filter((t) => (t.lifecycle_stage ?? null) === stage && matches(t)),
    })).filter((g) => g.items.length > 0)
  }, [templates, search])

  if (isLoading) return <TemplatesSkeleton />
  if (isError) return <ErrorState title="Couldn't load templates" onRetry={onRetry} />
  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-text-subtle">No templates match your search.</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">{group.label}</h3>
          <ul className="mt-1 space-y-0.5">
            {group.items.map((t) => {
              const active = t.id === selectedId
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                      active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active ? 'bg-text text-card' : 'bg-surface-muted text-text-muted'
                      }`}
                    >
                      <Mail size={16} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{t.name}</span>
                      <span className="block truncate text-xs text-text-subtle">{t.subject || 'No subject'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * Email-template master list (left pane of the Emails master-detail).
 *
 * Browses templates grouped by the MC's own categories (colour-dotted
 * subheaders in the user's drag order), with un-tagged templates in a
 * trailing "Uncategorised" bucket. Selecting a row drives the preview
 * pane; the row's edit/duplicate/delete actions live on that preview,
 * so the list itself stays scannable. Filtered by the toolbar `search`.
 *
 * @module app/(dashboard)/templates/templates-library
 */
'use client'

import { Mail } from 'lucide-react'
import { useMemo } from 'react'

import { ErrorState } from '@/components/ui/error-state'
import type { EmailTemplate } from '@/types/email-template'

import { categoryColorClasses } from './category-colors'
import { TemplatesSkeleton } from './templates-skeleton'
import { useCategories } from './use-categories'

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

/** One category bucket plus its matching templates. `null` dot = the
 *  trailing "Uncategorised" bucket. */
interface CategoryGroup {
  key: string
  label: string
  dotClass: string | null
  items: EmailTemplate[]
}

export function TemplatesLibrary({ templates, isLoading, isError, onRetry, search, selectedId, onSelect }: TemplatesLibraryProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()

  // Group by the user's categories in their drag order, preserving the
  // position order the template query returns within each bucket.
  // Search filters by name or subject; only non-empty groups render so
  // the page never shows a bare header.
  const groups = useMemo<CategoryGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const matches = (t: EmailTemplate) =>
      !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    const categoryGroups = categories.map((c) => ({
      key: c.id,
      label: c.name,
      dotClass: categoryColorClasses(c.color).dot,
      items: templates.filter((t) => t.category_id === c.id && matches(t)),
    }))
    const known = new Set(categories.map((c) => c.id))
    const uncategorised = {
      key: 'uncategorised',
      label: 'Uncategorised',
      dotClass: null,
      items: templates.filter((t) => (!t.category_id || !known.has(t.category_id)) && matches(t)),
    }
    return [...categoryGroups, uncategorised].filter((g) => g.items.length > 0)
  }, [templates, categories, search])

  if (isLoading || categoriesLoading) return <TemplatesSkeleton />
  if (isError) return <ErrorState title="Couldn't load templates" onRetry={onRetry} />
  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-text-subtle">No templates match your search.</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
            {group.dotClass && <span className={`h-2 w-2 rounded-full ${group.dotClass}`} />}
            {group.label}
          </h3>
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

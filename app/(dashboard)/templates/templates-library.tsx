/**
 * Email-template master list (left pane of the Emails master-detail).
 *
 * Browses active templates grouped by the MC's own categories
 * (colour-dotted subheaders in the user's drag order), with un-tagged
 * templates in a trailing "Uncategorised" bucket and archived templates
 * in a collapsed "Archived (n)" section at the bottom (mirrors the
 * Packages tab). Selecting a row drives the preview pane; the row's
 * edit/duplicate/archive/delete actions live on that preview, so the
 * list itself stays scannable. Filtered by the toolbar `search`.
 *
 * @module app/(dashboard)/templates/templates-library
 */
'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { ErrorState } from '@/components/ui/error-state'
import type { EmailTemplate } from '@/types/email-template'

import { categoryColorClasses } from './category-colors'
import { TemplatesSkeleton } from './templates-skeleton'
import { useCategories } from './use-categories'

interface TemplatesLibraryProps {
  /** Active (non-archived) templates, grouped by category. */
  templates: EmailTemplate[]
  /** Archived templates — rendered in a collapsed trailing section. */
  archived?: EmailTemplate[]
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

function TemplateRow({
  template,
  active,
  onSelect,
}: {
  template: EmailTemplate
  active: boolean
  onSelect: (template: EmailTemplate) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(template)}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition ${
          active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-text">{template.name}</span>
          <span className="block truncate text-body text-text-subtle">
            {template.subject || 'No subject'}
          </span>
        </span>
      </button>
    </li>
  )
}

export function TemplatesLibrary({ templates, archived = [], isLoading, isError, onRetry, search, selectedId, onSelect }: TemplatesLibraryProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const [showArchived, setShowArchived] = useState(false)

  const q = search.trim().toLowerCase()
  const matches = (t: EmailTemplate) =>
    !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)

  // Group by the user's categories in their drag order, preserving the
  // position order the template query returns within each bucket.
  // Search filters by name or subject; only non-empty groups render so
  // the page never shows a bare header. Derived in render — the list is
  // small enough that memoising isn't worth the dependency bookkeeping.
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
  const groups: CategoryGroup[] = [...categoryGroups, uncategorised].filter(
    (g) => g.items.length > 0,
  )

  const visibleArchived = archived.filter(matches)

  if (isLoading || categoriesLoading) return <TemplatesSkeleton />
  if (isError) return <ErrorState title="Couldn't load templates" onRetry={onRetry} />
  if (groups.length === 0 && archived.length === 0) {
    return <p className="py-8 text-center text-body text-text-subtle">No templates match your search.</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="flex items-center gap-1.5 px-2 text-body font-semibold uppercase tracking-wider text-text-subtle">
            {group.dotClass && <span className={`h-2 w-2 rounded-pill ${group.dotClass}`} />}
            {group.label}
          </h3>
          <ul className="mt-1 space-y-0.5">
            {group.items.map((t) => (
              <TemplateRow key={t.id} template={t} active={t.id === selectedId} onSelect={onSelect} />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex cursor-pointer items-center gap-1 px-2 py-1 text-body text-text-muted transition hover:text-text"
          >
            {showArchived ? (
              <ChevronDown size={14} strokeWidth={1.5} />
            ) : (
              <ChevronRight size={14} strokeWidth={1.5} />
            )}
            Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-1 space-y-0.5">
              {visibleArchived.map((t) => (
                <TemplateRow key={t.id} template={t} active={t.id === selectedId} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

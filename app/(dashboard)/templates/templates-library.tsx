/**
 * Email-template library list.
 *
 * Browses templates grouped by wedding-lifecycle stage — quiet stage
 * subheaders with calm, click-to-edit rows beneath, mirroring the
 * couple Overview / Automations surfaces. A slim search narrows by
 * name or subject; per-row Edit / Duplicate / Delete live in a
 * hover-revealed overflow menu so the list stays scannable. Create/edit
 * open the editor modal via the orchestrator.
 *
 * @module app/(dashboard)/templates/templates-library
 */
'use client'

import { Copy, Mail, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Empty } from '@/components/ui/empty'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { RowActionsMenu } from '@/components/ui/row-actions-menu'
import { useToast } from '@/components/ui/toast'
import { LIFECYCLE_LABELS, LIFECYCLE_STAGES, type EmailTemplate, type LifecycleStage } from '@/types/email-template'

import { TemplatesSkeleton } from './templates-skeleton'
import { useCloneTemplate, useDeleteTemplate } from './use-templates'

interface TemplatesLibraryProps {
  templates: EmailTemplate[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onNew: () => void
  onEdit: (template: EmailTemplate) => void
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

export function TemplatesLibrary({ templates, isLoading, isError, onRetry, onNew, onEdit }: TemplatesLibraryProps) {
  const { toast } = useToast()
  const clone = useCloneTemplate()
  const remove = useDeleteTemplate()
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null)

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

  async function handleClone(t: EmailTemplate) {
    try {
      await clone.mutateAsync(t.id)
      toast('Template duplicated', 'success')
    } catch {
      toast('Could not duplicate', 'error')
    }
  }

  if (isLoading) return <TemplatesSkeleton />
  if (isError) return <ErrorState title="Couldn't load templates" onRetry={onRetry} />
  if (templates.length === 0) {
    return (
      <Empty
        icon={Mail}
        title="No templates yet"
        description="Create a reusable email your couples will love."
        action={<Button onClick={onNew}>New template</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="sm:max-w-xs">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" size="sm" />
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-subtle">No templates match your search.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key}>
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-text-subtle">{group.label}</h3>
            <ul className="mt-1">
              {group.items.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-muted"
                >
                  <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <p className="truncate text-sm font-medium text-text">{t.name}</p>
                    <p className="truncate text-xs text-text-subtle">{t.subject || 'No subject'}</p>
                  </button>
                  <RowActionsMenu
                    alwaysVisible
                    actions={[
                      { label: 'Edit', icon: <Pencil size={15} strokeWidth={1.5} />, onSelect: () => onEdit(t) },
                      { label: 'Duplicate', icon: <Copy size={15} strokeWidth={1.5} />, onSelect: () => void handleClone(t) },
                      {
                        label: 'Delete',
                        destructive: true,
                        icon: <Trash2 size={15} strokeWidth={1.5} />,
                        onSelect: () => setPendingDelete(t),
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete template?"
        description={`"${pendingDelete?.name}" will be permanently removed. This can't be undone.`}
        loading={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await remove.mutateAsync(pendingDelete.id)
            toast('Template deleted', 'success')
          } catch {
            toast('Could not delete', 'error')
          } finally {
            setPendingDelete(null)
          }
        }}
      />
    </div>
  )
}

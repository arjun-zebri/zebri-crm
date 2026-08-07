/**
 * Emails tab — master-detail email-template library.
 *
 * Left: the stage-grouped, selectable template list. Right: a read-only
 * preview of the selected template (subject + body with variables shown as
 * chips) under a header whose `Edit` opens the existing editor modal. On
 * desktop the first template auto-previews; on mobile the list shows first
 * and a tap opens a full-screen preview.
 *
 * @module app/(dashboard)/templates/emails-tab
 */
'use client'

import type { JSONContent } from '@tiptap/react'
import { Archive, ArchiveRestore, Library, Mail, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'


import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { PublicBranding } from '@/lib/branding/public-branding'
import type { EmailTemplate, EmailTemplateCategory } from '@/types/email-template'

import { categoryColorClasses } from './category-colors'
import { EmailTemplatePreview } from './email-template-preview'
import { StarterLibraryPanel } from './starter-library-panel'
import { TemplateEditorModal } from './template-editor-modal'
import { TemplatePreviewHeader } from './template-preview-header'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesLibrary } from './templates-library'
import { TemplatesTwoPane } from './templates-two-pane'
import { useCategories } from './use-categories'
import { useCloneTemplate, useDeleteTemplate, useSetTemplateArchived, useTemplates } from './use-templates'

interface EmailsTabProps {
  businessName?: string | undefined
  contactName?: string | undefined
  email?: string | undefined
  emailSignature?: JSONContent | null | undefined
  branding?: PublicBranding | null | undefined
}

/** Uppercase category chip (in its colour) beside the preview title. */
function CategoryChip({ category }: { category: EmailTemplateCategory }) {
  return (
    <span
      className={`rounded-control px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${categoryColorClasses(category.color).chip}`}
    >
      {category.name}
    </span>
  )
}

export function EmailsTab({ businessName, contactName, email, emailSignature, branding }: EmailsTabProps) {
  const { data: templates = [], isLoading, isError, refetch } = useTemplates()
  const { data: categories = [] } = useCategories()
  const clone = useCloneTemplate()
  const remove = useDeleteTemplate()
  const setArchived = useSetTemplateArchived()
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null)

  const existingNames = useMemo(() => new Set(templates.map((t) => t.name)), [templates])

  const activeTemplates = templates.filter((t) => !t.archived_at)
  const archivedTemplates = templates.filter((t) => t.archived_at)

  // Effective selection: the user's pick when still present, else the first
  // active template (so the desktop preview is never blank, and never
  // defaults to something archived). Derived in render to avoid a
  // setState-in-effect; the mobile switch keys off the raw pick.
  const effectiveId =
    selectedId && templates.some((t) => t.id === selectedId)
      ? selectedId
      : (activeTemplates[0]?.id ?? templates[0]?.id ?? null)
  const selected = templates.find((t) => t.id === effectiveId) ?? null

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  async function handleClone(t: EmailTemplate) {
    try {
      await clone.mutateAsync(t.id)
      toast('Template duplicated', 'success')
    } catch {
      toast('Could not duplicate', 'error')
    }
  }

  async function handleArchiveToggle(t: EmailTemplate) {
    const archiving = !t.archived_at
    try {
      await setArchived.mutateAsync({ id: t.id, archived: archiving })
      toast(archiving ? 'Template archived' : 'Template restored', 'success')
    } catch {
      toast(archiving ? 'Could not archive' : 'Could not restore', 'error')
    }
  }

  const toolbar = (
    <TemplatesActions>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        className="w-36 sm:w-48"
      />
      <Button variant="outline" onClick={() => setLibraryOpen(true)} className="gap-1.5">
        <Library size={14} strokeWidth={1.5} />
        Browse starters
      </Button>
      <Button onClick={openNew} className="gap-1.5">
        <Plus size={14} strokeWidth={1.5} />
        New template
      </Button>
    </TemplatesActions>
  )

  const modals = (
    <>
      {editorOpen && (
        <TemplateEditorModal
          key={editing?.id ?? 'new'}
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          template={editing}
          businessName={businessName}
          contactName={contactName}
          email={email}
          emailSignature={emailSignature}
          branding={branding}
        />
      )}
      <StarterLibraryPanel isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} existingNames={existingNames} />
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
    </>
  )

  if (!isLoading && !isError && templates.length === 0) {
    return (
      <>
        {toolbar}
        {modals}
        <div className="flex h-full items-center justify-center pb-[10vh]">
          <Empty
            size="sm"
            icon={Mail}
            title="No templates yet"
            description="Add ready-made starters from the catalog, or write your own from scratch."
          />
        </div>
      </>
    )
  }

  return (
    <>
      {toolbar}
      {modals}
      <TemplatesTwoPane
        selected={!!selectedId}
        onBack={() => setSelectedId(null)}
        list={
          <TemplatesLibrary
            templates={activeTemplates}
            archived={archivedTemplates}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            search={search}
            selectedId={effectiveId}
            onSelect={(t) => setSelectedId(t.id)}
          />
        }
        detail={
          selected ? (
            <div className="space-y-4">
              <TemplatePreviewHeader
                title={selected.name}
                meta={(() => {
                  const category = categories.find((c) => c.id === selected.category_id)
                  return (
                    <>
                      {category ? <CategoryChip category={category} /> : null}
                      {selected.archived_at ? (
                        <span className="shrink-0 rounded-pill border border-border px-2 py-0.5 text-body text-text-muted">
                          Archived
                        </span>
                      ) : null}
                    </>
                  )
                })()}
                updatedAt={selected.updated_at}
                onEdit={() => {
                  setEditing(selected)
                  setEditorOpen(true)
                }}
                onDuplicate={() => handleClone(selected)}
                extraActions={[
                  {
                    label: selected.archived_at ? 'Unarchive' : 'Archive',
                    icon: selected.archived_at ? (
                      <ArchiveRestore size={15} strokeWidth={1.5} />
                    ) : (
                      <Archive size={15} strokeWidth={1.5} />
                    ),
                    onSelect: () => handleArchiveToggle(selected),
                  },
                ]}
                onDelete={() => setPendingDelete(selected)}
              />
              <EmailTemplatePreview subject={selected.subject} content={selected.content} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center pb-[10vh]">
              <p className="text-body text-text-subtle">Select a template to preview.</p>
            </div>
          )
        }
      />
    </>
  )
}

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

import { Library, Mail, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { LIFECYCLE_LABELS, type EmailTemplate, type LifecycleStage } from '@/types/email-template'

import { EmailTemplatePreview } from './email-template-preview'
import { StarterLibraryPanel } from './starter-library-panel'
import { TemplateEditorModal } from './template-editor-modal'
import { TemplatePreviewHeader } from './template-preview-header'
import { TemplatesActions } from './templates-actions-slot'
import { TemplatesLibrary } from './templates-library'
import { TemplatesTwoPane } from './templates-two-pane'
import { useCloneTemplate, useDeleteTemplate, useTemplates } from './use-templates'

interface EmailsTabProps {
  businessName?: string
  contactName?: string
}

/** Uppercase lifecycle-stage chip shown beside the preview title. */
function StageChip({ stage }: { stage: LifecycleStage }) {
  return (
    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
      {LIFECYCLE_LABELS[stage]}
    </span>
  )
}

export function EmailsTab({ businessName, contactName }: EmailsTabProps) {
  const { data: templates = [], isLoading, isError, refetch } = useTemplates()
  const clone = useCloneTemplate()
  const remove = useDeleteTemplate()
  const { toast } = useToast()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null)

  const existingNames = useMemo(() => new Set(templates.map((t) => t.name)), [templates])

  // Effective selection: the user's pick when still present, else the first
  // template (so the desktop preview is never blank). Derived in render to
  // avoid a setState-in-effect; the mobile switch keys off the raw pick.
  const effectiveId =
    selectedId && templates.some((t) => t.id === selectedId) ? selectedId : (templates[0]?.id ?? null)
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

  const toolbar = (
    <TemplatesActions>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates…"
        size="sm"
        className="w-36 sm:w-48"
      />
      <Button size="sm" variant="outline" onClick={() => setLibraryOpen(true)} className="gap-1.5">
        <Library size={14} strokeWidth={1.5} />
        Browse starters
      </Button>
      <Button size="sm" onClick={openNew} className="gap-1.5">
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
            templates={templates}
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
                meta={selected.lifecycle_stage ? <StageChip stage={selected.lifecycle_stage} /> : undefined}
                updatedAt={selected.updated_at}
                onEdit={() => {
                  setEditing(selected)
                  setEditorOpen(true)
                }}
                onDuplicate={() => handleClone(selected)}
                onDelete={() => setPendingDelete(selected)}
              />
              <EmailTemplatePreview subject={selected.subject} content={selected.content} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center pb-[10vh]">
              <p className="text-sm text-text-subtle">Select a template to preview.</p>
            </div>
          )
        }
      />
    </>
  )
}

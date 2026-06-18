/**
 * Emails tab — the reusable email-template library.
 *
 * Loads the MC's email templates and composes the stage-grouped library
 * list + editor modal. Split out of the page orchestrator so each
 * Templates tab owns its own data + actions.
 *
 * @module app/(dashboard)/templates/emails-tab
 */
'use client'

import { useMemo, useState } from 'react'

import type { EmailTemplate } from '@/types/email-template'

import { StarterLibraryPanel } from './starter-library-panel'
import { TemplateEditorModal } from './template-editor-modal'
import { TemplatesLibrary } from './templates-library'
import { useTemplates } from './use-templates'

interface EmailsTabProps {
  businessName?: string
  contactName?: string
}

export function EmailsTab({ businessName, contactName }: EmailsTabProps) {
  const { data: templates = [], isLoading, isError, refetch } = useTemplates()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const existingNames = useMemo(() => new Set(templates.map((t) => t.name)), [templates])

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (t: EmailTemplate) => {
    setEditing(t)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-4">
      <TemplatesLibrary
        templates={templates}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onNew={openNew}
        onBrowse={() => setLibraryOpen(true)}
        onEdit={openEdit}
      />

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
    </div>
  )
}

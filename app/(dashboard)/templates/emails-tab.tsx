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

import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { EmailTemplate } from '@/types/email-template'

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
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-muted">Reusable emails for every stage of the journey.</p>
        <Button size="sm" onClick={openNew} className="shrink-0 gap-1.5">
          <Plus size={14} strokeWidth={2} />
          New template
        </Button>
      </div>

      <TemplatesLibrary
        templates={templates}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onNew={openNew}
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
    </div>
  )
}

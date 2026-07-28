/**
 * Attachments section of the template editor.
 *
 * Lists the files sent with a template, with add / remove. Works for
 * **unsaved drafts too**: uploads park unlinked (`template_id` null,
 * `{user}/drafts/` path) and are reported to the parent via
 * {@link TemplateAttachmentsProps.onPendingChange}, which links them to
 * the template on first save (or cleans them up on cancel). Every send
 * of the template includes these files by default (deselectable in the
 * compose modal).
 *
 * @module app/(dashboard)/templates/template-attachments
 */
'use client'

import { FileText, Paperclip, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'

import type { TemplateFileRow } from './attachment-actions'
import { useDeleteTemplateFile, useTemplateFiles, useUploadTemplateFile } from './use-template-files'

/** Mirrors the bucket's MIME whitelist for the picker dialog. */
const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg'

/** Human file size, matching the portal-files formatting. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface TemplateAttachmentsProps {
  /** Saved template id, or `null` while the template is an unsaved draft. */
  templateId: string | null
  /**
   * Fired with the current draft (unlinked) file ids whenever they
   * change. The editor links these on first save and deletes them if
   * the draft is discarded. Only fires for `templateId === null` flows.
   */
  onPendingChange?: (fileIds: string[]) => void
}

export function TemplateAttachments({ templateId, onPendingChange }: TemplateAttachmentsProps) {
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: savedFiles = [] } = useTemplateFiles(templateId)
  // Draft uploads for an unsaved template, held locally until save links
  // them (the saved-files query can't see unlinked rows by template id).
  const [pendingFiles, setPendingFiles] = useState<TemplateFileRow[]>([])
  const upload = useUploadTemplateFile(templateId)
  const remove = useDeleteTemplateFile(templateId)

  const files = templateId ? savedFiles : pendingFiles

  const setPending = (next: TemplateFileRow[]) => {
    setPendingFiles(next)
    onPendingChange?.(next.map((f) => f.id))
  }

  const onPick = async (picked: File | undefined) => {
    if (!picked) return
    try {
      const row = await upload.mutateAsync(picked)
      if (!templateId) setPending([...pendingFiles, row])
      toast(`Attached ${picked.name}`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not attach the file', 'error')
    }
  }

  const onRemove = async (file: TemplateFileRow) => {
    try {
      await remove.mutateAsync(file.id)
      if (!templateId) setPending(pendingFiles.filter((f) => f.id !== file.id))
    } catch {
      toast('Could not remove the attachment', 'error')
    }
  }

  // The bucket is private, so opening a file means minting a short-lived
  // signed URL (owner-only under the storage RLS path policies).
  const onOpen = async (file: TemplateFileRow) => {
    const { data } = await supabase.storage
      .from('email-template-files')
      .createSignedUrl(file.storage_path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
    else toast('Could not open the file', 'error')
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-caption font-medium text-text">Attachments</p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={14} strokeWidth={1.5} />
          Attach file
        </Button>
      </div>
      {/* Hidden picker — the visible affordance is the button above. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {files.length === 0 ? (
        <p className="text-xs text-text-subtle">
          Files attached here are included every time this template is sent.
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2"
            >
              {/* Name is a button: click to open the file in a new tab. */}
              <button
                type="button"
                onClick={() => void onOpen(f)}
                title={`Open ${f.file_name}`}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
              >
                <FileText size={14} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
                <span className="min-w-0 flex-1 truncate text-sm text-text hover:underline">{f.file_name}</span>
              </button>
              <span className="shrink-0 text-xs text-text-subtle">{formatFileSize(f.file_size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.file_name}`}
                className="shrink-0 cursor-pointer rounded p-1 text-text-subtle transition hover:text-text"
                onClick={() => void onRemove(f)}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

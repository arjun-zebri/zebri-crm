/**
 * React Query hooks for email-template attachments.
 *
 * Listing reads the RLS-scoped `email_template_files` rows directly with
 * the browser client. Uploading is two-step: the binary goes straight
 * from the browser to the private bucket (25 MB is far beyond a server
 * action's body), then `registerTemplateFileAction` records the
 * metadata row against a server-derived path. Deletion is one action.
 *
 * @module app/(dashboard)/templates/use-template-files
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

import {
  deleteTemplateFileAction,
  registerTemplateFileAction,
  type TemplateFileRow,
} from './attachment-actions'

const keyFor = (templateId: string | null) => ['email-template-files', templateId] as const

/** The attachments saved against a template (empty for unsaved drafts). */
export function useTemplateFiles(templateId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: keyFor(templateId),
    enabled: templateId !== null,
    queryFn: async (): Promise<TemplateFileRow[]> => {
      const { data, error } = await supabase
        .from('email_template_files')
        .select('*')
        .eq('template_id', templateId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Upload a file to the bucket, then register its metadata row. With a
 * `null` templateId the upload is a **draft** (unsaved template): it
 * parks under `{user}/drafts/` with an unlinked row, and the editor
 * links it to the template on first save.
 */
export function useUploadTemplateFile(templateId: string | null) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<TemplateFileRow> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      // Object id doubles as the metadata row id; the path convention
      // ({user}/{template-or-drafts}/{file}) is what the bucket RLS keys on.
      const fileId = crypto.randomUUID()
      const path = `${user.id}/${templateId ?? 'drafts'}/${fileId}`
      const { error: uploadError } = await supabase.storage
        .from('email-template-files')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)

      const res = await registerTemplateFileAction({
        templateId,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type as never,
      })
      if (!res.ok) {
        // Roll the orphaned object back so a failed register doesn't leak
        // storage the MC can't see or remove.
        await supabase.storage.from('email-template-files').remove([path])
        throw new Error(res.error)
      }
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keyFor(templateId) }),
  })
}

/** Remove an attachment (object + row). */
export function useDeleteTemplateFile(templateId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fileId: string) => {
      const res = await deleteTemplateFileAction(fileId)
      if (!res.ok) throw new Error(res.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keyFor(templateId) }),
  })
}

/**
 * React Query hooks for the Templates library.
 *
 * `useTemplates` reads the MC's saved email templates (RLS-scoped);
 * the mutation hooks wrap the server actions in `actions.ts` and keep
 * the `['email-templates']` cache fresh.
 *
 * @module app/(dashboard)/templates/use-templates
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import type { EmailTemplate } from '@/types/email-template'

import {
  addStarterTemplatesAction,
  cloneTemplateAction,
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
  type TemplateInput,
} from './actions'

const KEY = ['email-templates'] as const

/** Throw on a failed action so React Query routes it to `onError`. */
function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

/** All of the MC's email templates, ordered by stage then position. */
export function useTemplates() {
  const supabase = createClient()
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<EmailTemplate[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as EmailTemplate[]
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TemplateInput) => unwrap(await createTemplateAction(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TemplateInput }) =>
      unwrap(await updateTemplateAction(id, input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteTemplateAction(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCloneTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await cloneTemplateAction(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Add starter templates from the catalog by name; returns how many landed. */
export function useAddStarterTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (names: string[]) => unwrap(await addStarterTemplatesAction(names)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

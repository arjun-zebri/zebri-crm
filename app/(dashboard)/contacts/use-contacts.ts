/**
 * React Query hooks for the Contacts surface.
 *
 * Reads stay client-side (RLS scopes them automatically). Mutations
 * are thin wrappers around the server actions in `./actions.ts`.
 * The optimistic React Query cache update + invalidation pattern is
 * preserved so the UI stays snappy.
 *
 * @module app/(dashboard)/contacts/use-contacts
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'
import { Contact } from '@/types/contact'

import {
  bulkDeleteContactsAction,
  bulkUpdateContactsStatusAction,
  createContactAction,
  deleteContactAction,
  updateContactAction,
  type ContactInput,
} from './actions'

/** Throw on `ok: false` so React Query treats it as an error and
 *  the optimistic rollback in onError runs. */
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (result.ok) return result.data
  throw new Error(result.error)
}

export function useContacts() {
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Contact[]) || []
    },
  })

  return { ...query, data: query.data || [] }
}

export function useCreateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: ContactInput) =>
      unwrap(await createContactAction(contact)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contact: Contact) =>
      unwrap(
        await updateContactAction({
          id: contact.id,
          name: contact.name,
          contact_name: contact.contact_name,
          email: contact.email,
          phone: contact.phone,
          category: contact.category,
          notes: contact.notes,
          status: contact.status,
        }),
      ),
    onMutate: async (contact: Contact) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] })
      const previousContacts = queryClient.getQueryData<Contact[]>(['contacts'])

      queryClient.setQueryData<Contact[]>(['contacts'], (old) => {
        if (!old) return [contact]
        return old.map((c) => (c.id === contact.id ? contact : c))
      })

      return { previousContacts }
    },
    onError: (_err, _contact, context) => {
      const ctx = context as { previousContacts?: Contact[] } | undefined
      if (ctx?.previousContacts) {
        queryClient.setQueryData(['contacts'], ctx.previousContacts)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await deleteContactAction(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      unwrap(await bulkDeleteContactsAction(ids))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useBulkUpdateContactsStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'active' | 'inactive' }) => {
      unwrap(await bulkUpdateContactsStatusAction({ ids, status }))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Contact } from './contacts-types'

export function useContacts() {
  const queryClient = useQueryClient()
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
  const supabase = createClient()

  return useMutation({
    mutationFn: async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at'>) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contact,
          user_id: user.user.id,
        })
        .select()

      if (error) throw error
      return data[0] as Contact
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (contact: Contact) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(contact)
        .eq('id', contact.id)
        .select()

      if (error) throw error
      return data[0] as Contact
    },
    onMutate: async (contact: Contact) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] })
      const previousContacts = queryClient.getQueryData<Contact[]>(['contacts'])

      queryClient.setQueryData<Contact[]>(['contacts'], (old) => {
        if (!old) return [contact]
        return old.map((c) => (c.id === contact.id ? contact : c))
      })

      return { previousContacts }
    },
    onError: (err, contact, context: any) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(['contacts'], context.previousContacts)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useDeleteContact() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

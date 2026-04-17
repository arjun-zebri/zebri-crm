'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Couple } from './couples-types'

export function useCouples() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['couples'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('couples')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Couple[]) || []
    },
  })

  return { ...query, data: query.data || [] }
}

export function useCreateCouple() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (couple: Omit<Couple, 'id' | 'user_id' | 'created_at'>) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('couples')
        .insert({
          ...couple,
          user_id: user.user.id,
        })
        .select()

      if (error) throw error
      return data[0] as Couple
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] })
    },
  })
}

export function useUpdateCouple() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (couple: Couple) => {
      const { data, error } = await supabase
        .from('couples')
        .update(couple)
        .eq('id', couple.id)
        .select()

      if (error) throw error
      return data[0] as Couple
    },
    onMutate: async (couple: Couple) => {
      queryClient.cancelQueries({ queryKey: ['couples'] })
      const previousCouples = queryClient.getQueryData<Couple[]>(['couples'])

      queryClient.setQueryData<Couple[]>(['couples'], (old) => {
        if (!old) return [couple]
        return old.map((c) => (c.id === couple.id ? couple : c))
      })

      return { previousCouples }
    },
    onError: (err, couple, context: any) => {
      if (context?.previousCouples) {
        queryClient.setQueryData(['couples'], context.previousCouples)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] })
    },
  })
}

export function useDeleteCouple() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('couples').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] })
    },
  })
}

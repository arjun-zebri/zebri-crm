'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { CoupleStatusRecord, COLOR_PALETTE } from './couples-types'

const DEFAULTS = [
  { name: 'New', slug: 'new', color: 'amber', position: 0 },
  { name: 'Contacted', slug: 'contacted', color: 'blue', position: 1 },
  { name: 'Confirmed', slug: 'confirmed', color: 'purple', position: 2 },
  { name: 'Paid', slug: 'paid', color: 'emerald', position: 3 },
  { name: 'Complete', slug: 'complete', color: 'gray', position: 4 },
]

export function useCoupleStatuses() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['couple-statuses'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Check if user has any statuses
      const { data: existing, error: fetchError } = await supabase
        .from('couple_statuses')
        .select('*')
        .eq('user_id', user.user.id)
        .order('position', { ascending: true })

      if (fetchError) throw fetchError

      // If no statuses exist, seed defaults
      if (!existing || existing.length === 0) {
        const { data: seeded, error: seedError } = await supabase
          .from('couple_statuses')
          .insert(
            DEFAULTS.map(d => ({
              user_id: user.user.id,
              ...d,
            }))
          )
          .select()

        if (seedError) throw seedError
        return (seeded as CoupleStatusRecord[]) || []
      }

      return (existing as CoupleStatusRecord[]) || []
    },
  })

  return { ...query, data: query.data || [] }
}

export function useCreateStatus() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      // Generate slug from name
      const slug = input.name.toLowerCase().replace(/\s+/g, '_')

      // Get max position
      const { data: existing } = await supabase
        .from('couple_statuses')
        .select('position')
        .eq('user_id', user.user.id)
        .order('position', { ascending: false })
        .limit(1)

      const position = (existing?.[0]?.position ?? -1) + 1

      const { data, error } = await supabase
        .from('couple_statuses')
        .insert({
          user_id: user.user.id,
          name: input.name,
          slug,
          color: input.color,
          position,
        })
        .select()

      if (error) throw error
      return data[0] as CoupleStatusRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-statuses'] })
    },
  })
}

export function useUpdateStatus() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (status: CoupleStatusRecord) => {
      const { data, error } = await supabase
        .from('couple_statuses')
        .update({ name: status.name, color: status.color, position: status.position })
        .eq('id', status.id)
        .select()

      if (error) throw error
      return data[0] as CoupleStatusRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-statuses'] })
    },
  })
}

export function useDeleteStatus() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (statusId: string) => {
      // Check if any couples use this status
      const { data: status, error: statusError } = await supabase
        .from('couple_statuses')
        .select('slug')
        .eq('id', statusId)
        .single()

      if (statusError) throw statusError

      const { data: usedByCouples, error: checkError } = await supabase
        .from('couples')
        .select('id')
        .eq('status', status.slug)
        .limit(1)

      if (checkError) throw checkError
      if (usedByCouples && usedByCouples.length > 0) {
        throw new Error('Cannot delete status that is in use by couples')
      }

      const { error } = await supabase
        .from('couple_statuses')
        .delete()
        .eq('id', statusId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-statuses'] })
    },
  })
}

export function useReorderStatuses() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (statuses: CoupleStatusRecord[]) => {
      const updates = statuses.map((s, idx) => ({
        id: s.id,
        position: idx,
      }))

      // Update all in parallel
      const promises = updates.map(update =>
        supabase
          .from('couple_statuses')
          .update({ position: update.position })
          .eq('id', update.id)
      )

      const results = await Promise.all(promises)
      const hasError = results.some(r => r.error)
      if (hasError) throw new Error('Failed to reorder statuses')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couple-statuses'] })
    },
  })
}

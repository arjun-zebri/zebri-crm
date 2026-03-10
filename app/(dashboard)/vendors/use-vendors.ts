'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Vendor } from './vendors-types'

export function useVendors() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Vendor[]) || []
    },
  })

  return { ...query, data: query.data || [] }
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (vendor: Omit<Vendor, 'id' | 'user_id' | 'created_at'>) => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendor,
          user_id: user.user.id,
        })
        .select()

      if (error) throw error
      return data[0] as Vendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (vendor: Vendor) => {
      const { data, error } = await supabase
        .from('vendors')
        .update(vendor)
        .eq('id', vendor.id)
        .select()

      if (error) throw error
      return data[0] as Vendor
    },
    onMutate: async (vendor: Vendor) => {
      await queryClient.cancelQueries({ queryKey: ['vendors'] })
      const previousVendors = queryClient.getQueryData<Vendor[]>(['vendors'])

      queryClient.setQueryData<Vendor[]>(['vendors'], (old) => {
        if (!old) return [vendor]
        return old.map((v) => (v.id === vendor.id ? vendor : v))
      })

      return { previousVendors }
    },
    onError: (err, vendor, context: any) => {
      if (context?.previousVendors) {
        queryClient.setQueryData(['vendors'], context.previousVendors)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

export function useDeleteVendor() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

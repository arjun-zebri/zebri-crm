'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

export interface PortalPerson {
  id: string
  category: string
  full_name: string
  phonetic: string | null
  role: string | null
  audio_url: string | null
  notes: string | null
  position: number
}

export interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

export interface PortalTimelineItem {
  id: string
  event_id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}


export const PARTNER_ROLES = ['Bride', 'Groom', 'Partner']
export const BRIDAL_ROLES = ['Best Man', 'Maid of Honour', 'Bridesmaid', 'Groomsman', 'Flower Girl', 'Ring Bearer', 'MC', 'Other']
export const FAMILY_ROLES = ['Mother of Bride', 'Father of Bride', 'Mother of Groom', 'Father of Groom', 'Grandparent', 'Sibling', 'Other']

export function usePortalData(coupleId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const CATEGORY_DISPLAY: Record<string, string> = {
    partner: 'couple',
    bridal_party: 'bridal party',
    family: 'family',
    other: 'other',
  }

  // Person modal state
  const [personModal, setPersonModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<PortalPerson | null>(null)
  const [personCategory, setPersonCategory] = useState<string>('partner')
  const [personCategoryLabel, setPersonCategoryLabel] = useState<string>('')
  const [personRoles, setPersonRoles] = useState<string[]>(PARTNER_ROLES)
  const [personSaving, setPersonSaving] = useState(false)

  // Song modal state
  const [songModal, setSongModal] = useState(false)
  const [editingSong, setEditingSong] = useState<PortalSong | null>(null)
  const [songCategoryKey, setSongCategoryKey] = useState('')
  const [songCategoryLabel, setSongCategoryLabel] = useState('')
  const [songSaving, setSongSaving] = useState(false)

  // Data fetching
  const { data: people = [], isLoading: isPeopleLoading } = useQuery<PortalPerson[]>({
    queryKey: ['portal-people', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_people').select('*').eq('couple_id', coupleId).order('category').order('position')
      if (error) throw error
      return data || []
    },
  })

  const { data: songs = [], isLoading: isSongsLoading } = useQuery<PortalSong[]>({
    queryKey: ['portal-songs', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase.from('portal_songs').select('*').eq('couple_id', coupleId).order('category').order('position')
      if (error) throw error
      return data || []
    },
  })

  const { data: pendingItems = [], isLoading: isTimelineLoading } = useQuery<PortalTimelineItem[]>({
    queryKey: ['portal-timeline-pending', coupleId],
    queryFn: async () => {
      const { data: events } = await supabase.from('events').select('id').eq('couple_id', coupleId)
      if (!events?.length) return []
      const { data, error } = await supabase.from('timeline_items').select('*').in('event_id', events.map((e) => e.id)).eq('pending_review', true).order('start_time', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data || []
    },
  })

  // Mutations
  const approveItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('timeline_items').update({ pending_review: false }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-timeline-pending', coupleId] })
      toast('Item approved')
    },
    onError: () => toast('Failed to approve item'),
  })

  const savePerson = useCallback(async (data: Partial<PortalPerson>) => {
    setPersonSaving(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      if (editingPerson) {
        const merged = { ...editingPerson, ...data }
        await supabase.from('portal_people').update({
          full_name: merged.full_name, phonetic: merged.phonetic, role: merged.role,
          audio_url: merged.audio_url, notes: merged.notes ?? null,
        }).eq('id', merged.id)
      } else {
        const categoryPeople = people.filter((p) => p.category === personCategory)
        await supabase.from('portal_people').insert({
          couple_id: coupleId, user_id: user.user.id, category: personCategory,
          full_name: data.full_name ?? '', phonetic: data.phonetic ?? null, role: data.role ?? null,
          audio_url: data.audio_url ?? null, notes: data.notes ?? null, position: categoryPeople.length * 1000,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['portal-people', coupleId] })
      toast(editingPerson ? 'Person updated' : 'Person added')
      setPersonModal(false)
      setEditingPerson(null)
    } catch {
      toast('Failed to save person')
    }
    setPersonSaving(false)
  }, [editingPerson, personCategory, people, coupleId, supabase, queryClient, toast])

  const deletePerson = useCallback(async () => {
    if (!editingPerson) return
    setPersonSaving(true)
    try {
      await supabase.from('portal_people').delete().eq('id', editingPerson.id)
      queryClient.invalidateQueries({ queryKey: ['portal-people', coupleId] })
      toast('Person removed')
      setPersonModal(false)
      setEditingPerson(null)
    } catch {
      toast('Failed to remove person')
    }
    setPersonSaving(false)
  }, [editingPerson, coupleId, supabase, queryClient, toast])

  const saveSong = useCallback(async (data: Partial<PortalSong>) => {
    setSongSaving(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      if (editingSong) {
        await supabase.from('portal_songs').update({
          title: data.title ?? editingSong.title, artist: data.artist ?? null, notes: data.notes ?? null,
        }).eq('id', editingSong.id)
      } else {
        const categorySongs = songs.filter((s) => s.category === songCategoryKey)
        await supabase.from('portal_songs').insert({
          couple_id: coupleId, user_id: user.user.id, category: songCategoryKey,
          title: data.title ?? '', artist: data.artist ?? null, notes: data.notes ?? null,
          position: categorySongs.length * 1000,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['portal-songs', coupleId] })
      toast(editingSong ? 'Song updated' : 'Song added')
      setSongModal(false)
      setEditingSong(null)
    } catch {
      toast('Failed to save song')
    }
    setSongSaving(false)
  }, [editingSong, songCategoryKey, songs, coupleId, supabase, queryClient, toast])

  const deleteSong = useCallback(async () => {
    if (!editingSong) return
    setSongSaving(true)
    try {
      await supabase.from('portal_songs').delete().eq('id', editingSong.id)
      queryClient.invalidateQueries({ queryKey: ['portal-songs', coupleId] })
      toast('Song removed')
      setSongModal(false)
      setEditingSong(null)
    } catch {
      toast('Failed to remove song')
    }
    setSongSaving(false)
  }, [editingSong, coupleId, supabase, queryClient, toast])

  const openAddPerson = (category: string, roles: string[]) => {
    setEditingPerson(null)
    setPersonCategory(category)
    setPersonCategoryLabel(CATEGORY_DISPLAY[category] || category)
    setPersonRoles(roles)
    setPersonModal(true)
  }

  const openEditPerson = (person: PortalPerson, roles: string[]) => {
    setEditingPerson(person)
    setPersonCategory(person.category)
    setPersonCategoryLabel(CATEGORY_DISPLAY[person.category] || person.category)
    setPersonRoles(roles)
    setPersonModal(true)
  }

  const openAddSong = (key: string, label: string) => {
    setEditingSong(null)
    setSongCategoryKey(key)
    setSongCategoryLabel(label)
    setSongModal(true)
  }

  const openEditSong = (song: PortalSong) => {
    setEditingSong(song)
    setSongCategoryKey(song.category)
    setSongCategoryLabel(song.category)
    setSongModal(true)
  }

  const isLoading = isPeopleLoading || isSongsLoading || isTimelineLoading

  return {
    // Data
    people,
    songs,
    pendingItems,
    isLoading,
    isPeopleLoading,

    // Person modal
    personModal,
    setPersonModal,
    editingPerson,
    setEditingPerson,
    personRoles,
    personCategoryLabel,
    personSaving,
    savePerson,
    deletePerson,
    openAddPerson,
    openEditPerson,
    coupleId,

    // Song modal
    songModal,
    setSongModal,
    editingSong,
    setEditingSong,
    songCategoryLabel,
    songSaving,
    saveSong,
    deleteSong,
    openAddSong,
    openEditSong,

    // Timeline
    approveItem,
  }
}

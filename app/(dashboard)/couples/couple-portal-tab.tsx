'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Modal } from '@/components/ui/modal'
import {
  Mic, Square, Play, Loader2,
  FileText, Download, Check, Music, Clock, Users,
  Plus, Trash2, Pencil,
} from 'lucide-react'

interface PortalPerson {
  id: string
  category: string
  full_name: string
  phonetic: string | null
  role: string | null
  audio_url: string | null
  position: number
}

interface PortalSong {
  id: string
  category: string
  title: string
  artist: string | null
  notes: string | null
  position: number
}

interface PortalFile {
  id: string
  name: string
  file_url: string
  file_size: number | null
  created_at: string
}

interface PortalTimelineItem {
  id: string
  event_id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  position: number
  pending_review: boolean
}

const SONG_CATEGORY_LABELS: Record<string, string> = {
  entry_partner1: 'Partner 1 Entry',
  entry_partner2: 'Partner 2 Entry',
  first_dance: 'First Dance',
  bridal_party_entry: 'Bridal Party Entry',
  ceremony: 'Ceremony',
  reception: 'Reception',
  avoid: 'Do Not Play',
}

const SONG_CATEGORIES = Object.entries(SONG_CATEGORY_LABELS).map(([key, label]) => ({ key, label }))

const PARTNER_ROLES = ['Bride', 'Groom', 'Partner']
const BRIDAL_ROLES = ['Best Man', 'Maid of Honour', 'Bridesmaid', 'Groomsman', 'Flower Girl', 'Ring Bearer', 'MC', 'Other']
const FAMILY_ROLES = ['Mother of Bride', 'Father of Bride', 'Mother of Groom', 'Father of Groom', 'Grandparent', 'Sibling', 'Other']

function formatTime(time: string | null): string {
  if (!time) return 'No time'
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

// ── Audio recorder (reusable) ────────────────────────────────────────────────
function AudioRecorder({
  audioUrl,
  personId,
  coupleId,
  onRecorded,
}: {
  audioUrl: string | null
  personId: string
  coupleId: string
  onRecorded: (url: string) => void
}) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setUploading(true)
        const supabase = createClient()
        const fileName = `${coupleId}/${personId}-${Date.now()}.webm`
        const { data } = await supabase.storage.from('portal-audio').upload(fileName, blob, { upsert: true })
        if (data) {
          const { data: urlData } = supabase.storage.from('portal-audio').getPublicUrl(data.path)
          onRecorded(urlData.publicUrl)
        }
        setUploading(false)
      }
      mr.start()
      setRecording(true)
    } catch {
      // user denied mic
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 size={13} className="animate-spin" />
        Uploading…
      </div>
    )
  }

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2">
        <audio src={audioUrl} className="hidden" id={`mc-audio-recorder-${personId}`} />
        <button
          type="button"
          onClick={() => (document.getElementById(`mc-audio-recorder-${personId}`) as HTMLAudioElement)?.play()}
          className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer"
        >
          <Play size={12} strokeWidth={2} />
          Play
        </button>
        <button type="button" onClick={startRecording} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer" title="Re-record">
          <Mic size={13} strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  if (recording) {
    return (
      <button type="button" onClick={stopRecording} className="flex items-center gap-1 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition cursor-pointer animate-pulse">
        <Square size={12} strokeWidth={2} />
        Stop recording
      </button>
    )
  }

  return (
    <button type="button" onClick={startRecording} className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition cursor-pointer">
      <Mic size={12} strokeWidth={1.5} />
      Record pronunciation
    </button>
  )
}

// ── Person modal ─────────────────────────────────────────────────────────────
interface PersonModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalPerson>) => void
  onDelete?: () => void
  person: PortalPerson | null
  roleOptions: string[]
  coupleId: string
  saving: boolean
}

function PersonModal({ isOpen, onClose, onSave, onDelete, person, roleOptions, coupleId, saving }: PersonModalProps) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFullName(person?.full_name ?? '')
      setRole(person?.role ?? '')
      setPhonetic(person?.phonetic ?? '')
      setAudioUrl(person?.audio_url ?? null)
      setConfirmDelete(false)
    }
  }, [isOpen, person])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Siobhan Murphy" className={inputClass} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="">No role</option>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phonetic spelling</label>
            <input type="text" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="e.g. SEER-sha" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Pronunciation recording</label>
            <AudioRecorder
              audioUrl={audioUrl}
              personId={person?.id ?? 'new'}
              coupleId={coupleId}
              onRecorded={setAudioUrl}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {person && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this person?</span>
                <button type="button" onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer">Yes, remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition cursor-pointer">
                <Trash2 size={13} strokeWidth={1.5} />
                Remove
              </button>
            )
          ) : <div />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
            <button type="button" onClick={() => onSave({ full_name: fullName, role: role || null, phonetic: phonetic || null, audio_url: audioUrl })} disabled={saving || !fullName.trim()} className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Song modal ───────────────────────────────────────────────────────────────
interface SongModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => void
  onDelete?: () => void
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
}

function SongModal({ isOpen, onClose, onSave, onDelete, song, categoryLabel, saving }: SongModalProps) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle(song?.title ?? '')
      setArtist(song?.artist ?? '')
      setNotes(song?.notes ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, song])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={song ? `Edit — ${categoryLabel}` : `Add song — ${categoryLabel}`}>
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Song title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Can't Help Falling in Love" className={inputClass} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Artist (optional)</label>
            <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. Elvis Presley" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Start from the chorus" className={inputClass} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {song && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this song?</span>
                <button type="button" onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer">Yes, remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition cursor-pointer">
                <Trash2 size={13} strokeWidth={1.5} />
                Remove
              </button>
            )
          ) : <div />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
            <button type="button" onClick={() => onSave({ title, artist: artist || null, notes: notes || null })} disabled={saving || !title.trim()} className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Main tab component ───────────────────────────────────────────────────────
interface CouplePortalTabProps {
  coupleId: string
}

export function CouplePortalTab({ coupleId }: CouplePortalTabProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Person modal state
  const [personModal, setPersonModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<PortalPerson | null>(null)
  const [personCategory, setPersonCategory] = useState<string>('partner')
  const [personRoles, setPersonRoles] = useState<string[]>(PARTNER_ROLES)
  const [personSaving, setPersonSaving] = useState(false)

  // Song modal state
  const [songModal, setSongModal] = useState(false)
  const [editingSong, setEditingSong] = useState<PortalSong | null>(null)
  const [songCategoryKey, setSongCategoryKey] = useState(SONG_CATEGORIES[0].key)
  const [songCategoryLabel, setSongCategoryLabel] = useState(SONG_CATEGORIES[0].label)
  const [songSaving, setSongSaving] = useState(false)

  // Fetch portal people
  const { data: people = [], isLoading: isPeopleLoading } = useQuery<PortalPerson[]>({
    queryKey: ['portal-people', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_people')
        .select('*')
        .eq('couple_id', coupleId)
        .order('category')
        .order('position')
      if (error) throw error
      return data || []
    },
  })

  // Fetch portal songs
  const { data: songs = [], isLoading: isSongsLoading } = useQuery<PortalSong[]>({
    queryKey: ['portal-songs', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_songs')
        .select('*')
        .eq('couple_id', coupleId)
        .order('category')
        .order('position')
      if (error) throw error
      return data || []
    },
  })

  // Fetch portal files
  const { data: files = [], isLoading: isFilesLoading } = useQuery<PortalFile[]>({
    queryKey: ['portal-files', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_files')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at')
      if (error) throw error
      return data || []
    },
  })

  // Fetch pending timeline items
  const { data: pendingItems = [], isLoading: isTimelineLoading } = useQuery<PortalTimelineItem[]>({
    queryKey: ['portal-timeline-pending', coupleId],
    queryFn: async () => {
      const { data: events } = await supabase.from('events').select('id').eq('couple_id', coupleId)
      if (!events?.length) return []
      const { data, error } = await supabase
        .from('timeline_items')
        .select('*')
        .in('event_id', events.map((e) => e.id))
        .eq('pending_review', true)
        .order('start_time', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data || []
    },
  })

  // Approve timeline item
  const approveItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('timeline_items').update({ pending_review: false }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-timeline-pending', coupleId] })
      toast('Item approved')
    },
  })

  // People mutations
  const savePerson = useCallback(async (data: Partial<PortalPerson>) => {
    setPersonSaving(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return

    if (editingPerson) {
      const merged = { ...editingPerson, ...data }
      await supabase.from('portal_people').update({
        full_name: merged.full_name,
        phonetic: merged.phonetic,
        role: merged.role,
        audio_url: merged.audio_url,
      }).eq('id', merged.id)
    } else {
      const categorySongs = people.filter((p) => p.category === personCategory)
      await supabase.from('portal_people').insert({
        couple_id: coupleId,
        user_id: user.user.id,
        category: personCategory,
        full_name: data.full_name ?? '',
        phonetic: data.phonetic ?? null,
        role: data.role ?? null,
        audio_url: data.audio_url ?? null,
        position: categorySongs.length * 1000,
      })
    }

    queryClient.invalidateQueries({ queryKey: ['portal-people', coupleId] })
    setPersonSaving(false)
    setPersonModal(false)
    setEditingPerson(null)
    toast(editingPerson ? 'Person updated' : 'Person added')
  }, [editingPerson, personCategory, people, coupleId, supabase, queryClient, toast])

  const deletePerson = useCallback(async () => {
    if (!editingPerson) return
    setPersonSaving(true)
    await supabase.from('portal_people').delete().eq('id', editingPerson.id)
    queryClient.invalidateQueries({ queryKey: ['portal-people', coupleId] })
    setPersonSaving(false)
    setPersonModal(false)
    setEditingPerson(null)
    toast('Person removed')
  }, [editingPerson, coupleId, supabase, queryClient, toast])

  // Song mutations
  const saveSong = useCallback(async (data: Partial<PortalSong>) => {
    setSongSaving(true)
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return

    if (editingSong) {
      await supabase.from('portal_songs').update({
        title: data.title ?? editingSong.title,
        artist: data.artist ?? null,
        notes: data.notes ?? null,
      }).eq('id', editingSong.id)
    } else {
      const categorySongs = songs.filter((s) => s.category === songCategoryKey)
      await supabase.from('portal_songs').insert({
        couple_id: coupleId,
        user_id: user.user.id,
        category: songCategoryKey,
        title: data.title ?? '',
        artist: data.artist ?? null,
        notes: data.notes ?? null,
        position: categorySongs.length * 1000,
      })
    }

    queryClient.invalidateQueries({ queryKey: ['portal-songs', coupleId] })
    setSongSaving(false)
    setSongModal(false)
    setEditingSong(null)
    toast(editingSong ? 'Song updated' : 'Song added')
  }, [editingSong, songCategoryKey, songs, coupleId, supabase, queryClient, toast])

  const deleteSong = useCallback(async () => {
    if (!editingSong) return
    setSongSaving(true)
    await supabase.from('portal_songs').delete().eq('id', editingSong.id)
    queryClient.invalidateQueries({ queryKey: ['portal-songs', coupleId] })
    setSongSaving(false)
    setSongModal(false)
    setEditingSong(null)
    toast('Song removed')
  }, [editingSong, coupleId, supabase, queryClient, toast])

  const openAddPerson = (category: string, roles: string[]) => {
    setEditingPerson(null)
    setPersonCategory(category)
    setPersonRoles(roles)
    setPersonModal(true)
  }

  const openEditPerson = (person: PortalPerson, roles: string[]) => {
    setEditingPerson(person)
    setPersonCategory(person.category)
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
    setSongCategoryLabel(SONG_CATEGORY_LABELS[song.category] ?? song.category)
    setSongModal(true)
  }

  const partners = people.filter((p) => p.category === 'partner')
  const bridalParty = people.filter((p) => p.category === 'bridal_party')
  const family = people.filter((p) => p.category === 'family')

  const groupedSongs = SONG_CATEGORIES.reduce<Record<string, PortalSong[]>>((acc, { key }) => {
    acc[key] = songs.filter((s) => s.category === key)
    return acc
  }, {})

  const hasAnyData = people.length > 0 || songs.length > 0 || files.length > 0 || pendingItems.length > 0
  const isLoading = isPeopleLoading || isSongsLoading || isFilesLoading || isTimelineLoading

  if (isLoading) {
    return (
      <div className="space-y-8 pb-4">
        {/* Skeleton: Names section */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-1.5">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* Skeleton: Songs section */}
        <div className="space-y-3">
          <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-4">

      {/* Names & Pronunciations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} strokeWidth={1.5} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Names & Pronunciations</p>
          </div>
        </div>

        {[
          { label: 'Partners', items: partners, category: 'partner', roles: PARTNER_ROLES },
          { label: 'Bridal Party', items: bridalParty, category: 'bridal_party', roles: BRIDAL_ROLES },
          { label: 'Family', items: family, category: 'family', roles: FAMILY_ROLES },
        ].map(({ label, items, category, roles }) => (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
              <button
                onClick={() => openAddPerson(category, roles)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition cursor-pointer"
              >
                <Plus size={12} strokeWidth={1.5} />
                Add
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-gray-300 py-1">None added</p>
            ) : (
              items.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5 hover:border-gray-200 transition cursor-pointer"
                  onClick={() => openEditPerson(person, roles)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{person.full_name || 'Unnamed'}</p>
                      {person.role && (
                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{person.role}</span>
                      )}
                    </div>
                    {person.phonetic && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{person.phonetic}</p>
                    )}
                  </div>
                  {person.audio_url && (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <audio src={person.audio_url} id={`mc-audio-${person.id}`} className="hidden" />
                      <button
                        onClick={() => (document.getElementById(`mc-audio-${person.id}`) as HTMLAudioElement)?.play()}
                        className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <Play size={12} strokeWidth={2} />
                        Listen
                      </button>
                    </div>
                  )}
                  <Pencil size={13} strokeWidth={1.5} className="text-gray-300 shrink-0" />
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      {/* Pending Run Sheet Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={14} strokeWidth={1.5} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Run Sheet Suggestions</p>
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5">
              {pendingItems.length} pending
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 border border-amber-100 bg-amber-50/30 rounded-xl px-4 py-3"
              >
                <div className="text-xs text-gray-500 w-16 shrink-0 pt-0.5 tabular-nums font-medium">
                  {formatTime(item.start_time)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                  )}
                </div>
                <button
                  onClick={() => approveItem.mutate(item.id)}
                  disabled={approveItem.isPending}
                  className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Check size={12} strokeWidth={2} />
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Songs */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Music size={14} strokeWidth={1.5} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Song Requests</p>
        </div>
        <div className="space-y-4">
          {SONG_CATEGORIES.map(({ key, label }) => {
            const categorySongs = groupedSongs[key] || []
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                  <button
                    onClick={() => openAddSong(key, label)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    Add
                  </button>
                </div>
                {categorySongs.length === 0 ? (
                  <p className="text-xs text-gray-300 py-1">None added</p>
                ) : (
                  categorySongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5 hover:border-gray-200 transition cursor-pointer"
                      onClick={() => openEditSong(song)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{song.title}</p>
                        <p className="text-xs text-gray-400">{[song.artist, song.notes].filter(Boolean).join(' · ')}</p>
                      </div>
                      <Pencil size={13} strokeWidth={1.5} className="text-gray-300 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={14} strokeWidth={1.5} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Files</p>
          </div>
          <div className="space-y-1.5">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5">
                <FileText size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{file.name}</p>
                  {file.file_size && <p className="text-xs text-gray-400">{formatSize(file.file_size)}</p>}
                </div>
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition cursor-pointer shrink-0"
                >
                  <Download size={12} strokeWidth={1.5} />
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAnyData && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-sm text-gray-500">No portal submissions yet.</p>
          <p className="text-xs text-gray-400">
            Enable the portal link and share it with your couple to get started.
          </p>
        </div>
      )}

      {/* Modals */}
      <PersonModal
        isOpen={personModal}
        onClose={() => { setPersonModal(false); setEditingPerson(null) }}
        onSave={savePerson}
        onDelete={editingPerson ? deletePerson : undefined}
        person={editingPerson}
        roleOptions={personRoles}
        coupleId={coupleId}
        saving={personSaving}
      />
      <SongModal
        isOpen={songModal}
        onClose={() => { setSongModal(false); setEditingSong(null) }}
        onSave={saveSong}
        onDelete={editingSong ? deleteSong : undefined}
        song={editingSong}
        categoryLabel={songCategoryLabel}
        saving={songSaving}
      />
    </div>
  )
}

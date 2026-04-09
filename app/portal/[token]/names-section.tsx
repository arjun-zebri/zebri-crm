'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Trash2, Plus, Loader2, Pencil } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Modal } from '@/components/ui/modal'
import type { PortalPerson } from './page'

function anonSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

const PARTNER_ROLES = ['Bride', 'Groom', 'Partner']
const BRIDAL_ROLES = [
  'Best Man', 'Maid of Honour', 'Bridesmaid', 'Groomsman',
  'Flower Girl', 'Ring Bearer', 'MC', 'Other',
]
const FAMILY_ROLES = [
  'Mother of Bride', 'Father of Bride', 'Mother of Groom', 'Father of Groom',
  'Grandparent', 'Sibling', 'Other',
]

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

interface PersonModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalPerson>) => Promise<void>
  onDelete?: () => Promise<void>
  person: PortalPerson | null
  roleOptions: string[]
  saving: boolean
}

function AudioRecorder({
  audioUrl,
  personId,
  token,
  onRecorded,
}: {
  audioUrl: string | null
  personId: string
  token: string
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
        const fd = new FormData()
        fd.append('file', blob, 'pronunciation.webm')
        const res = await fetch(`/api/portal/upload?token=${token}&type=audio`, {
          method: 'POST',
          body: fd,
        })
        if (res.ok) {
          const { url } = await res.json()
          onRecorded(url)
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
        <audio src={audioUrl} className="hidden" id={`audio-modal-${personId}`} />
        <button
          type="button"
          onClick={() => (document.getElementById(`audio-modal-${personId}`) as HTMLAudioElement)?.play()}
          className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer"
        >
          <Play size={12} strokeWidth={2} />
          Play
        </button>
        <button
          type="button"
          onClick={startRecording}
          className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
          title="Re-record"
        >
          <Mic size={13} strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  if (recording) {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className="flex items-center gap-1 text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-2.5 py-1.5 hover:bg-red-100 transition cursor-pointer animate-pulse"
      >
        <Square size={12} strokeWidth={2} />
        Stop recording
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition cursor-pointer"
    >
      <Mic size={12} strokeWidth={1.5} />
      Record pronunciation
    </button>
  )
}

function PersonModal({ isOpen, onClose, onSave, onDelete, person, roleOptions, saving }: PersonModalProps) {
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [role, setRole] = useState(person?.role ?? '')
  const [phonetic, setPhonetic] = useState(person?.phonetic ?? '')
  const [audioUrl, setAudioUrl] = useState(person?.audio_url ?? null)
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

  const handleSubmit = async () => {
    await onSave({ full_name: fullName, role: role || null, phonetic: phonetic || null, audio_url: audioUrl })
  }

  const token = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={person ? 'Edit person' : 'Add person'}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Siobhan Murphy"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
            >
              <option value="">No role</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phonetic spelling</label>
            <input
              type="text"
              value={phonetic}
              onChange={(e) => setPhonetic(e.target.value)}
              placeholder="e.g. SEER-sha"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Pronunciation recording</label>
            <AudioRecorder
              audioUrl={audioUrl}
              personId={person?.id ?? 'new'}
              token={token}
              onRecorded={setAudioUrl}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {person && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Remove this person?</span>
                <button
                  type="button"
                  onClick={async () => { await onDelete(); setConfirmDelete(false) }}
                  className="text-xs text-red-500 hover:text-red-600 transition cursor-pointer"
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition cursor-pointer"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                Remove
              </button>
            )
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !fullName.trim()}
              className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

interface PersonRowProps {
  person: PortalPerson
  onEdit: () => void
}

function PersonRow({ person, onEdit }: PersonRowProps) {
  return (
    <div
      className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white hover:border-gray-300 transition cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900">{person.full_name || 'Unnamed'}</p>
          {person.role && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {person.role}
            </span>
          )}
        </div>
        {person.phonetic && (
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{person.phonetic}</p>
        )}
      </div>
      {person.audio_url && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <audio src={person.audio_url} className="hidden" id={`audio-row-${person.id}`} />
          <button
            onClick={() => (document.getElementById(`audio-row-${person.id}`) as HTMLAudioElement)?.play()}
            className="flex items-center gap-1 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition cursor-pointer"
          >
            <Play size={12} strokeWidth={2} />
            Listen
          </button>
        </div>
      )}
      <Pencil size={13} strokeWidth={1.5} className="text-gray-300 shrink-0" />
    </div>
  )
}

interface NamesSectionProps {
  token: string
  initialPeople: PortalPerson[]
}

export function NamesSection({ token, initialPeople }: NamesSectionProps) {
  const [people, setPeople] = useState<PortalPerson[]>(initialPeople)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<PortalPerson | null>(null)
  const [modalCategory, setModalCategory] = useState<PortalPerson['category']>('partner')
  const [modalRoleOptions, setModalRoleOptions] = useState<string[]>(PARTNER_ROLES)
  const [saving, setSaving] = useState(false)

  const openAdd = (category: PortalPerson['category'], roleOptions: string[]) => {
    setEditingPerson(null)
    setModalCategory(category)
    setModalRoleOptions(roleOptions)
    setModalOpen(true)
  }

  const openEdit = (person: PortalPerson, roleOptions: string[]) => {
    setEditingPerson(person)
    setModalCategory(person.category as PortalPerson['category'])
    setModalRoleOptions(roleOptions)
    setModalOpen(true)
  }

  const handleSave = useCallback(async (data: Partial<PortalPerson>) => {
    setSaving(true)
    const supabase = anonSupabase()

    if (editingPerson) {
      const merged = { ...editingPerson, ...data }
      setPeople((prev) => prev.map((p) => (p.id === merged.id ? merged : p)))
      await supabase.rpc('save_portal_person', {
        p_token: token,
        p_id: merged.id,
        p_category: merged.category,
        p_full_name: merged.full_name,
        p_phonetic: merged.phonetic ?? null,
        p_role: merged.role ?? null,
        p_audio_url: merged.audio_url ?? null,
        p_position: merged.position,
      })
    } else {
      const newId = crypto.randomUUID()
      const newPerson: PortalPerson = {
        id: newId,
        category: modalCategory,
        full_name: data.full_name ?? '',
        phonetic: data.phonetic ?? null,
        role: data.role ?? null,
        audio_url: data.audio_url ?? null,
        position: people.filter((p) => p.category === modalCategory).length * 1000,
      }
      setPeople((prev) => [...prev, newPerson])
      await supabase.rpc('save_portal_person', {
        p_token: token,
        p_id: newId,
        p_category: modalCategory,
        p_full_name: newPerson.full_name,
        p_phonetic: newPerson.phonetic,
        p_role: newPerson.role,
        p_audio_url: newPerson.audio_url,
        p_position: newPerson.position,
      })
    }

    setSaving(false)
    setModalOpen(false)
    setEditingPerson(null)
  }, [editingPerson, modalCategory, people, token])

  const handleDelete = useCallback(async () => {
    if (!editingPerson) return
    setSaving(true)
    setPeople((prev) => prev.filter((p) => p.id !== editingPerson.id))
    const supabase = anonSupabase()
    await supabase.rpc('delete_portal_person', { p_token: token, p_id: editingPerson.id })
    setSaving(false)
    setModalOpen(false)
    setEditingPerson(null)
  }, [editingPerson, token])

  const partners = people.filter((p) => p.category === 'partner')
  const bridalParty = people.filter((p) => p.category === 'bridal_party')
  const family = people.filter((p) => p.category === 'family')

  return (
    <div className="space-y-6">
      {/* Partners */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Partners</p>
        {partners.map((p) => (
          <PersonRow key={p.id} person={p} onEdit={() => openEdit(p, PARTNER_ROLES)} />
        ))}
        <button
          onClick={() => openAdd('partner', PARTNER_ROLES)}
          className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl py-3 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus size={14} strokeWidth={1.5} />
          {partners.length === 0 ? 'Add partner' : 'Add another partner'}
        </button>
      </div>

      {/* Bridal Party */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bridal Party</p>
        {bridalParty.map((p) => (
          <PersonRow key={p.id} person={p} onEdit={() => openEdit(p, BRIDAL_ROLES)} />
        ))}
        <button
          onClick={() => openAdd('bridal_party', BRIDAL_ROLES)}
          className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl py-3 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add bridal party member
        </button>
      </div>

      {/* Family */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Family Members</p>
        {family.map((p) => (
          <PersonRow key={p.id} person={p} onEdit={() => openEdit(p, FAMILY_ROLES)} />
        ))}
        <button
          onClick={() => openAdd('family', FAMILY_ROLES)}
          className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-xl py-3 hover:border-gray-300 hover:bg-gray-50 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus size={14} strokeWidth={1.5} />
          Add family member
        </button>
      </div>

      <PersonModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPerson(null) }}
        onSave={handleSave}
        onDelete={editingPerson ? handleDelete : undefined}
        person={editingPerson}
        roleOptions={modalRoleOptions}
        saving={saving}
      />
    </div>
  )
}

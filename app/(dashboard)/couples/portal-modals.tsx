'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, Square, Play, Loader2, Trash2, ChevronDown } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import type { PortalPerson, PortalSong } from './use-portal-data'

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

// ── Audio recorder ──────────────────────────────────────────────────────────
export function AudioRecorder({
  audioUrl,
  personId,
  coupleId,
  onRecorded,
  onDelete,
}: {
  audioUrl: string | null
  personId: string
  coupleId: string
  onRecorded: (url: string) => void
  onDelete?: () => void
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
        Uploading...
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
        <button type="button" onClick={startRecording} className="p-1 text-gray-400 hover:text-gray-600 transition cursor-pointer" title="Re-record">
          <Mic size={13} strokeWidth={1.5} />
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="p-1 text-gray-400 hover:text-red-400 transition cursor-pointer" title="Delete recording">
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        )}
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

// ── Person modal ────────────────────────────────────────────────────────────
export function PersonModal({
  isOpen, onClose, onSave, onDelete, person, roleOptions, coupleId, saving, categoryLabel,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalPerson>) => void
  onDelete?: () => void
  person: PortalPerson | null
  roleOptions: string[]
  coupleId: string
  saving: boolean
  categoryLabel?: string
}) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFullName(person?.full_name ?? '')
      setRole(person?.role ?? '')
      setPhonetic(person?.phonetic ?? '')
      setAudioUrl(person?.audio_url ?? null)
      setNotes(person?.notes ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, person])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={person ? 'Edit person' : categoryLabel ? `Add to ${categoryLabel}` : 'Add person'}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Siobhan Murphy" className={inputClass} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <Popover.Root open={roleOpen} onOpenChange={setRoleOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm hover:border-gray-300 transition cursor-pointer"
                >
                  <span className={role ? 'text-gray-900' : 'text-gray-400'}>
                    {role || 'No role'}
                  </span>
                  <ChevronDown size={14} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white border border-gray-200 rounded-xl shadow-lg z-[90] py-1 max-h-60 overflow-y-auto"
                  style={{ width: 'var(--radix-popover-trigger-width)' }}
                  sideOffset={4}
                  align="start"
                >
                  <button
                    type="button"
                    onClick={() => { setRole(''); setRoleOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                      !role ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    No role
                  </button>
                  {roleOptions.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRole(r); setRoleOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                        role === r ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phonetic spelling</label>
            <input type="text" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="e.g. SEER-sha" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Pronunciation recording</label>
            <AudioRecorder audioUrl={audioUrl} personId={person?.id ?? 'new'} coupleId={coupleId} onRecorded={setAudioUrl} onDelete={() => setAudioUrl(null)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for the MC..."
              rows={6}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition resize-none"
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
            <button type="button" onClick={onClose} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700 transition cursor-pointer">Cancel</button>
            <button type="button" onClick={() => onSave({ full_name: fullName, role: role || null, phonetic: phonetic || null, audio_url: audioUrl, notes: notes || null })} disabled={saving || !fullName.trim()} className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Song modal ──────────────────────────────────────────────────────────────
export function SongModal({
  isOpen, onClose, onSave, onDelete, song, categoryLabel, saving,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalSong>) => void
  onDelete?: () => void
  song: PortalSong | null
  categoryLabel: string
  saving: boolean
}) {
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit">
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

'use client'

import * as Popover from '@radix-ui/react-popover'
import { Mic, Square, Loader2, Trash2, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import { AudioPlayButton } from '@/components/ui/audio-play-button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'

import type { PortalPerson, PortalSong } from './use-portal-data'

// Underline input vocabulary - matches the couple/event/contact
// modals so the four surfaces look like one product. Same definition
// kept locally because this file is consumed before the shared
// modals module mounts in dev.
const inputClass =
  'w-full border-0 border-b border-border bg-transparent px-0 py-2 text-body text-text placeholder:text-text-subtle focus:outline-none focus:border-gray-400 transition'
const labelClass = 'block text-body text-gray-600 mb-1'

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
  // Surface the underlying reason (denied permission, unsupported
  // browser, non-secure context) so the button doesn't just "do
  // nothing" when the user clicks - it shows an inline note.
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    setError(null)
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setError('Recording requires HTTPS (or localhost). Switch context to record.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support audio recording.')
      return
    }
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
        try {
          const supabase = createClient()
          const fileName = `${coupleId}/${personId}-${Date.now()}.webm`
          const { data, error: upErr } = await supabase.storage
            .from('portal-audio')
            .upload(fileName, blob, { upsert: true })
          if (upErr) {
            console.error('[AudioRecorder] upload failed', upErr)
            setError('Could not save the recording. Try again.')
          } else if (data) {
            const { data: urlData } = supabase.storage.from('portal-audio').getPublicUrl(data.path)
            onRecorded(urlData.publicUrl)
          }
        } catch (e) {
          console.error('[AudioRecorder] upload threw', e)
          setError('Could not save the recording. Try again.')
        } finally {
          setUploading(false)
        }
      }
      mr.start()
      setRecording(true)
    } catch (e) {
      console.error('[AudioRecorder] getUserMedia / MediaRecorder failed', e)
      const name = (e as { name?: string } | null)?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access denied. Enable mic permissions to record.')
      } else if (name === 'NotFoundError') {
        setError('No microphone found.')
      } else {
        setError('Could not start recording. Check microphone permissions.')
      }
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1.5 text-caption text-text-subtle">
        <Loader2 size={13} className="animate-spin" />
        Uploading...
      </div>
    )
  }

  // Recording takes priority over a stored audio URL so that
  // clicking "Re-record" (Mic) visually switches the row to
  // "Stop recording". Previously this branch was unreachable
  // whenever `audioUrl` was set, so the Re-record button did
  // nothing the user could see.
  if (recording) {
    return (
      <button type="button" onClick={stopRecording} className="flex items-center gap-1 text-caption text-red-600 border border-red-200 bg-red-50 rounded-control px-2.5 py-1.5 hover:bg-red-100 transition cursor-pointer animate-pulse">
        <Square size={12} strokeWidth={2} />
        Stop recording
      </button>
    )
  }

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2">
        <AudioPlayButton
          src={audioUrl}
          label="Play"
          className="flex items-center gap-1 text-caption border rounded-control px-2.5 py-1.5 transition cursor-pointer"
          idleClassName="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
          playingClassName="text-emerald-700 border-emerald-300 bg-emerald-100 hover:bg-emerald-200"
        />
        <button type="button" onClick={startRecording} className="p-1 text-text-subtle hover:text-gray-600 transition cursor-pointer" title="Re-record">
          <Mic size={13} strokeWidth={1.5} />
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="p-1 text-text-subtle hover:text-red-400 transition cursor-pointer" title="Delete recording">
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={startRecording}
        className="self-start flex items-center gap-1 text-caption text-text-muted border border-border rounded-control px-2.5 py-1.5 hover:bg-surface-emphasis transition cursor-pointer"
      >
        <Mic size={12} strokeWidth={1.5} />
        Record pronunciation
      </button>
      {error && <p className="text-caption text-red-500">{error}</p>}
    </div>
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  // Seed form state when the modal opens (and only when the
  // *underlying person* changes - keying on `person?.id`, not the
  // object reference). A React-Query refetch after a save returns
  // a fresh `person` reference with the same id; depending on
  // `person` directly would re-run this and wipe local edits the
  // user just made (e.g. clearing the audio recording).
  useEffect(() => {
    if (isOpen) {
      setFullName(person?.full_name ?? '')
      setRole(person?.role ?? '')
      setAudioUrl(person?.audio_url ?? null)
      setNotes(person?.notes ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, person?.id])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      nested
      title={person ? 'Edit person' : categoryLabel ? `Add to ${categoryLabel}` : 'Add person'}
      footer={
        <div className="flex items-center justify-between">
          {person && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-caption text-text-muted">Remove this person?</span>
                <button type="button" onClick={onDelete} className="text-caption text-red-500 hover:text-red-600 transition cursor-pointer">Yes, remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-caption text-text-subtle hover:text-gray-600 transition cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-body px-4 py-2 rounded-control bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
              >
                Delete
              </button>
            )
          ) : null}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-body px-4 py-2 rounded-control bg-surface-emphasis text-text hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ full_name: fullName, role: role || null, phonetic: null, audio_url: audioUrl, notes: notes || null })}
              disabled={saving || !fullName.trim()}
              className="text-body px-4 py-2 rounded-control bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Full name</label>
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
          <label className={labelClass}>Role</label>
          <Popover.Root open={roleOpen} onOpenChange={setRoleOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`${inputClass} flex items-center justify-between text-left`}
              >
                <span className={role ? 'text-text' : 'text-text-subtle'}>
                  {role || 'No role'}
                </span>
                <ChevronDown size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-surface border border-border rounded-control shadow-lg z-[90] py-1 max-h-60 overflow-y-auto w-[var(--radix-popover-trigger-width)]"
                sideOffset={4}
                align="start"
              >
                <button
                  type="button"
                  onClick={() => { setRole(''); setRoleOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-body transition cursor-pointer ${
                    !role ? 'bg-surface-emphasis text-text font-medium' : 'text-text-muted hover:bg-gray-50'
                  }`}
                >
                  No role
                </button>
                {roleOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setRoleOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-body transition cursor-pointer ${
                      role === r ? 'bg-surface-emphasis text-text font-medium' : 'text-gray-700 hover:bg-gray-50'
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
          <label className={labelClass}>Pronunciation recording</label>
          <AudioRecorder
            audioUrl={audioUrl}
            personId={person?.id ?? 'new'}
            coupleId={coupleId}
            onRecorded={setAudioUrl}
            onDelete={() => setAudioUrl(null)}
          />
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for the MC..."
            rows={8}
            className={`${inputClass} resize-none`}
          />
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      nested
      title={song ? 'Edit song' : `Add ${categoryLabel} song`}
      footer={
        <div className="flex items-center justify-between">
          {song && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-caption text-text-muted">Remove this song?</span>
                <button type="button" onClick={onDelete} className="text-caption text-red-500 hover:text-red-600 transition cursor-pointer">Yes, remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-caption text-text-subtle hover:text-gray-600 transition cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-body px-4 py-2 rounded-control bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
              >
                Delete
              </button>
            )
          ) : null}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-body px-4 py-2 rounded-control bg-surface-emphasis text-text hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ title, artist: artist || null, notes: notes || null })}
              disabled={saving || !title.trim()}
              className="text-body px-4 py-2 rounded-control bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Song title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Can't Help Falling in Love"
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Artist (optional)</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="e.g. Elvis Presley"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Start from the chorus"
            className={inputClass}
          />
        </div>
      </div>
    </Modal>
  )
}

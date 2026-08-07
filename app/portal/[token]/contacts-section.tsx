'use client'

import * as Popover from '@radix-ui/react-popover'
import { Plus, Mail, Phone, Mic, Trash2, Loader2, Pencil, ChevronDown } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'

import { AudioPlayButton } from '@/components/ui/audio-play-button'
import { BusyLabel } from '@/components/ui/busy-label'
import { Modal } from '@/components/ui/modal'
import { getRgb, getTextColor } from '@/lib/branding/contrast'
import { FONT_STACKS } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-surface'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, CATEGORIES } from '@/types/contact'

import type { PortalContact, PortalPerson } from './page'


const PARTNER_ROLES = ['Bride', 'Groom', 'Partner']
const BRIDAL_ROLES = [
  'Best Man', 'Maid of Honour', 'Bridesmaid', 'Groomsman',
  'Flower Girl', 'Ring Bearer', 'MC', 'Other',
]
const FAMILY_ROLES = [
  'Mother of Bride', 'Father of Bride', 'Mother of Groom', 'Father of Groom',
  'Grandparent', 'Sibling', 'Other',
]
const OTHER_ROLES = ['Officiant', 'Celebrant', 'Photographer', 'Videographer', 'Performer', 'Speaker', 'Guest', 'Other']

/**
 * Soft wash behind the mic button while recording. Composited from the fixed
 * error colour via getRgb because a hex inside rgba() is invalid CSS and the
 * declaration would be dropped silently.
 */
const RECORDING_TINT = (() => {
  const rgb = getRgb(STATUS_COLORS.error)
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)` : 'transparent'
})()

/**
 * Playback affordance styling. Success is a status, not a brand colour, so the
 * fill and border are composited from the fixed success value.
 */
const PLAY_BUTTON_STYLE = (() => {
  const rgb = getRgb(STATUS_COLORS.success)
  return {
    color: STATUS_COLORS.success,
    backgroundColor: rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)` : 'transparent',
    borderColor: rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)` : STATUS_COLORS.success,
  }
})()

/**
 * Generate branding-aware input field styles. Borders and focus states inherit
 * from the branding colour scheme.
 */
function getInputStyles(branding: PublicBranding) {
  return {
    borderColor: branding.border_color,
    backgroundColor: branding.surface_color,
  }
}

/**
 * Generate branding-aware label styles for form fields.
 */
function getLabelStyles(branding: PublicBranding) {
  const defaults = roleDefaults(branding, 'finePrint')
  return {
    fontSize: `${defaults.fontSize}px`,
    fontFamily: FONT_STACKS[defaults.fontFamily as never],
    fontWeight: defaults.fontWeight,
    color: defaults.color,
    lineHeight: defaults.lineHeight,
  }
}

// ── Audio recorder ────────────────────────────────────────────────────────────

/** Hard cap on pronunciation recordings; the hold-to-record ring fills over this window. */
const MAX_RECORDING_MS = 10_000
/** Holds shorter than this are treated as accidental taps and discarded rather than uploaded. */
const MIN_RECORDING_MS = 400

/** Ring geometry for the 56px hold-to-record button. */
const RING_RADIUS = 25
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * Press-and-hold pronunciation recorder. Recording runs only while the
 * pointer is held down; a circular progress ring fills over 10 seconds and
 * the recording auto-stops when it completes. Releasing early uploads
 * whatever was captured (unless the hold was too short to be intentional).
 */
function AudioRecorder({
  audioUrl,
  token,
  onRecorded,
  branding,
}: {
  audioUrl: string | null
  token: string
  onRecorded: (url: string) => void
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const holdingRef = useRef(false)
  const startedAtRef = useRef(0)
  const discardRef = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    holdingRef.current = false
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return
    discardRef.current = performance.now() - startedAtRef.current < MIN_RECORDING_MS
    mr.stop()
    setRecording(false)
    setProgress(0)
  }, [])

  const beginHold = useCallback(async (e: React.PointerEvent) => {
    e.preventDefault()
    if (recording || uploading || holdingRef.current) return
    holdingRef.current = true
    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current
      const p = Math.min(elapsed / MAX_RECORDING_MS, 1)
      setProgress(p)
      if (p >= 1) {
        // 10s cap reached: stop even though the pointer is still down.
        holdingRef.current = false
        stopRecording()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Pointer released (or component unmounted) while the mic permission
      // prompt was up - don't start a recording nobody is holding.
      if (!holdingRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (discardRef.current) return
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
      startedAtRef.current = performance.now()
      setRecording(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // user denied mic
      holdingRef.current = false
    }
  }, [recording, uploading, stopRecording, token, onRecorded])

  const endHold = useCallback(() => {
    if (!holdingRef.current) return
    holdingRef.current = false
    stopRecording()
  }, [stopRecording])

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={uploading}
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Hold to record pronunciation (up to 10 seconds)"
        className="relative h-14 w-14 shrink-0 rounded-pill cursor-pointer select-none touch-none disabled:opacity-50"
      >
        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
          <circle
            cx="28" cy="28" r={RING_RADIUS} fill="none" strokeWidth="2.5"
            stroke="currentColor" className="text-border"
          />
          <circle
            cx="28" cy="28" r={RING_RADIUS} fill="none" strokeWidth="2.5" strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            style={{ color: recording ? STATUS_COLORS.error : 'transparent' }}
          />
        </svg>
        <span
          className="absolute inset-[5px] rounded-pill flex items-center justify-center transition"
          // Recording is a status, not a brand state, so it uses the fixed
          // error colour with a soft tint composited from the same value.
          style={recording ? { color: STATUS_COLORS.error, backgroundColor: RECORDING_TINT } : { backgroundColor: branding.surface_color, color: finePrintDefaults.color }}
        >
          {uploading
            ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
            : <Mic size={18} strokeWidth={1.5} />}
        </span>
      </button>
      <div className="min-w-0 space-y-1">
        <p style={{ fontSize: `${finePrintDefaults.fontSize}px`, color: finePrintDefaults.color, fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never] }}>
          {recording
            ? 'Recording... release to finish'
            : uploading
              ? 'Uploading audio...'
              : audioUrl
                ? 'Hold to re-record (up to 10 seconds)'
                : 'Press and hold to record (up to 10 seconds)'}
        </p>
        {audioUrl && !recording && !uploading && (
          <div className="flex items-center gap-1.5">
            <AudioPlayButton
              src={audioUrl}
              label="Play"
              className="flex items-center gap-1 text-body border rounded-control px-2.5 py-1 transition cursor-pointer hover:opacity-80"
              style={PLAY_BUTTON_STYLE}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Person modal ──────────────────────────────────────────────────────────────

interface PersonModalProps {
  onClose: () => void
  onSave: (data: Partial<PortalPerson>) => Promise<void>
  onDelete?: () => Promise<void>
  person: PortalPerson | null
  roleOptions: string[]
  token: string
  saving: boolean
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

/**
 * Add / edit modal for a wedding-party person. Mounted fresh on each open by
 * the parent (conditional render), so state initialises straight from props -
 * no re-seeding effect needed. Applies branding colours and typography.
 */
function PersonModal({ onClose, onSave, onDelete, person, roleOptions, token, saving, branding }: PersonModalProps) {
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [role, setRole] = useState(person?.role ?? '')
  const [audioUrl, setAudioUrl] = useState(person?.audio_url ?? null)
  const [notes, setNotes] = useState(person?.notes ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  // Type scale from branding.
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  return (
    <Modal isOpen onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1" style={getLabelStyles(branding)}>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Siobhan Murphy"
                style={{
                  ...getInputStyles(branding),
                  fontSize: `${bodyDefaults.fontSize}px`,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  color: bodyDefaults.color,
                  lineHeight: bodyDefaults.lineHeight,
                  borderWidth: 1,
                  borderRadius: branding.corner_radius,
                  padding: '0.5rem 0.75rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                className="w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="block mb-1" style={getLabelStyles(branding)}>Role</label>
              <Popover.Root open={roleOpen} onOpenChange={setRoleOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 transition cursor-pointer"
                    style={{
                      ...getInputStyles(branding),
                      fontSize: `${bodyDefaults.fontSize}px`,
                      fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                      fontWeight: bodyDefaults.fontWeight,
                      color: role ? bodyDefaults.color : finePrintDefaults.color,
                      lineHeight: bodyDefaults.lineHeight,
                      borderWidth: 1,
                      borderColor: branding.border_color,
                      borderRadius: branding.corner_radius,
                      outline: 'none',
                    }}
                  >
                    <span>{role || 'No role'}</span>
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      style={{ color: finePrintDefaults.color }}
                      className="shrink-0"
                    />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="rounded-control shadow-lg z-[90] py-1 max-h-60 overflow-y-auto"
                    style={{
                      width: 'var(--radix-popover-trigger-width)',
                      backgroundColor: branding.surface_color,
                      borderWidth: 1,
                      borderColor: branding.border_color,
                      borderRadius: branding.corner_radius,
                    }}
                    sideOffset={4}
                    align="start"
                  >
                    <button
                      type="button"
                      onClick={() => { setRole(''); setRoleOpen(false) }}
                      className="w-full text-left px-3 py-1.5 transition cursor-pointer"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: !role ? 500 : bodyDefaults.fontWeight,
                        color: !role ? bodyDefaults.color : finePrintDefaults.color,
                        backgroundColor: !role ? `${branding.brand_color}10` : 'transparent',
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      No role
                    </button>
                    {roleOptions.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setRole(r); setRoleOpen(false) }}
                        className="w-full text-left px-3 py-1.5 transition cursor-pointer"
                        style={{
                          fontSize: `${bodyDefaults.fontSize}px`,
                          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                          fontWeight: role === r ? 500 : bodyDefaults.fontWeight,
                          color: role === r ? bodyDefaults.color : finePrintDefaults.color,
                          backgroundColor: role === r ? `${branding.brand_color}10` : 'transparent',
                          lineHeight: bodyDefaults.lineHeight,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1" style={getLabelStyles(branding)}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                style={{
                  ...getInputStyles(branding),
                  fontSize: `${bodyDefaults.fontSize}px`,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  color: bodyDefaults.color,
                  lineHeight: bodyDefaults.lineHeight,
                  borderWidth: 1,
                  borderRadius: branding.corner_radius,
                  padding: '0.5rem 0.75rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block mb-1" style={getLabelStyles(branding)}>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+61 400 000 000"
                style={{
                  ...getInputStyles(branding),
                  fontSize: `${bodyDefaults.fontSize}px`,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  color: bodyDefaults.color,
                  lineHeight: bodyDefaults.lineHeight,
                  borderWidth: 1,
                  borderRadius: branding.corner_radius,
                  padding: '0.5rem 0.75rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block mb-1.5" style={getLabelStyles(branding)}>Name pronunciation</label>
            <AudioRecorder
              audioUrl={audioUrl}
              token={token}
              onRecorded={setAudioUrl}
              branding={branding}
            />
          </div>
          <div>
            <label className="block mb-1" style={getLabelStyles(branding)}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for the MC..."
              rows={3}
              style={{
                ...getInputStyles(branding),
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                color: bodyDefaults.color,
                lineHeight: bodyDefaults.lineHeight,
                borderWidth: 1,
                borderRadius: branding.corner_radius,
                padding: '0.5rem 0.75rem',
                outline: 'none',
                transition: 'all 0.2s',
                resize: 'none',
              }}
              className="w-full"
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between pt-2"
          style={{
            borderTopWidth: 1,
            borderTopColor: branding.border_color,
          }}
        >
          {person && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span style={getLabelStyles(branding)}>Remove this person?</span>
                <button
                  type="button"
                  onClick={async () => { await onDelete(); setConfirmDelete(false) }}
                  className="transition cursor-pointer hover:opacity-75"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    fontWeight: 500,
                    color: '#DC2626',
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="transition cursor-pointer hover:opacity-75"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: finePrintDefaults.color,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 transition cursor-pointer hover:opacity-75"
                style={{
                  fontSize: `${finePrintDefaults.fontSize}px`,
                  color: finePrintDefaults.color,
                  fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                  fontWeight: finePrintDefaults.fontWeight,
                  lineHeight: finePrintDefaults.lineHeight,
                }}
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
              className="border rounded-control px-3 py-1.5 transition cursor-pointer hover:opacity-70"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                color: branding.text_color,
                borderColor: branding.border_color,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ full_name: fullName, role: role || null, audio_url: audioUrl, notes: notes || null, email: email || null, phone: phone || null })}
              disabled={saving || !fullName.trim()}
              className="rounded-control px-3 py-1.5 transition cursor-pointer hover:opacity-90 disabled:opacity-50"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                backgroundColor: branding.brand_color,
                color: getTextColor(branding.brand_color),
              }}
            >
              <BusyLabel busy={saving}>Save</BusyLabel>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Person row ────────────────────────────────────────────────────────────────

function PersonRow({
  person,
  onEdit,
  branding,
}: {
  person: PortalPerson
  onEdit: () => void
  branding: PublicBranding
}) {
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  return (
    <div
      className="flex items-center gap-3 border border-border rounded-control px-4 py-3 bg-surface hover:border-border-strong hover:bg-surface-muted transition cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-body font-medium text-text">{person.full_name || 'Unnamed'}</p>
          {person.role && (
            <span className="text-body text-text-muted bg-surface-muted rounded-pill px-2.5 py-0.5">
              {person.role}
            </span>
          )}
        </div>
      </div>
      {person.audio_url && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <AudioPlayButton
            src={person.audio_url}
            label="Play"
            className="flex items-center gap-1 text-body border rounded-control px-2.5 py-1.5 transition cursor-pointer hover:opacity-80"
            style={PLAY_BUTTON_STYLE}
          />
        </div>
      )}
      <Pencil size={13} strokeWidth={1.5} className="shrink-0" style={{ color: finePrintDefaults.color }} />
    </div>
  )
}

// ── People group ──────────────────────────────────────────────────────────────

interface PeopleGroupProps {
  label: string
  /** Singular noun for the "Add ..." button - group labels can't be singularised mechanically ("Couple", "Other"). */
  addLabel: string
  people: PortalPerson[]
  roleOptions: string[]
  onAdd: () => void
  onEdit: (person: PortalPerson) => void
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

function PeopleGroup({ label, addLabel, people, onAdd, onEdit, branding }: PeopleGroupProps) {
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <p style={{ fontSize: `${bodyDefaults.fontSize}px`, fontWeight: 500, color: bodyDefaults.color, fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never] }}>{label} <span style={{ fontSize: `${finePrintDefaults.fontSize}px`, fontWeight: 'normal', color: finePrintDefaults.color }}>({people.length})</span></p>
      </div>
      {people.length === 0 && (
        <div className="border border-dashed border-border rounded-control p-4 text-center bg-surface-muted/50">
          <p className="text-body text-text-subtle mb-2.5">No {label.toLowerCase()} yet</p>
          <button
            onClick={onAdd}
            className="text-body font-medium text-brand-fg hover:text-text-muted transition cursor-pointer"
          >
            Add {addLabel}
          </button>
        </div>
      )}
      {people.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {people.map((p) => (
              <PersonRow key={p.id} person={p} onEdit={() => onEdit(p)} branding={branding} />
            ))}
          </div>
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-1.5 text-body font-medium text-text-muted border border-dashed border-border rounded-control py-2.5 hover:bg-surface-muted transition cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.5} />
            Add {addLabel}
          </button>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ContactsSectionProps {
  token: string
  initialContacts: PortalContact[]
  initialPeople: PortalPerson[]
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding
}

export function ContactsSection({ token, initialContacts, initialPeople, branding }: ContactsSectionProps) {
  const supabase = createClient()

  // Type scale from branding.
  const bodyDefaults = roleDefaults(branding, 'body')
  const finePrintDefaults = roleDefaults(branding, 'finePrint')

  // Wedding party state
  const [people, setPeople] = useState<PortalPerson[]>(initialPeople)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<PortalPerson | null>(null)
  const [modalCategory, setModalCategory] = useState<PortalPerson['category']>('partner')
  const [modalRoleOptions, setModalRoleOptions] = useState<string[]>(PARTNER_ROLES)
  const [saving, setSaving] = useState(false)

  // Vendor contacts state
  const [contacts, setContacts] = useState<PortalContact[]>(initialContacts)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [vendorLoading, setVendorLoading] = useState(false)
  const [vendorForm, setVendorForm] = useState({ name: '', category: '', email: '', phone: '' })
  const [vendorError, setVendorError] = useState<string | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)

  // People handlers
  const openAdd = (category: PortalPerson['category'], roleOptions: string[]) => {
    setEditingPerson(null)
    setModalCategory(category)
    setModalRoleOptions(roleOptions)
    setModalOpen(true)
  }

  const openEdit = (person: PortalPerson, roleOptions: string[]) => {
    setEditingPerson(person)
    setModalCategory(person.category)
    setModalRoleOptions(roleOptions)
    setModalOpen(true)
  }

  const handleSavePerson = useCallback(async (data: Partial<PortalPerson>) => {
    setSaving(true)
    if (editingPerson) {
      const merged = { ...editingPerson, ...data }
      setPeople((prev) => prev.map((p) => (p.id === merged.id ? merged : p)))
      await supabase.rpc('save_portal_person', {
        p_token: token,
        p_id: merged.id,
        p_category: merged.category,
        p_full_name: merged.full_name,
        // Supabase type-gen types nullable text RPC params as `string`;
        // these SQL params accept null at runtime - behaviour unchanged,
        // the `as string` only bridges the generated-type imprecision.
        p_phonetic: (merged.phonetic ?? null) as string,
        p_role: (merged.role ?? null) as string,
        p_audio_url: (merged.audio_url ?? null) as string,
        p_position: merged.position,
        p_notes: merged.notes ?? undefined,
        p_email: merged.email ?? undefined,
        p_phone: merged.phone ?? undefined,
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
        notes: data.notes ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
      }
      setPeople((prev) => [...prev, newPerson])
      await supabase.rpc('save_portal_person', {
        p_token: token,
        p_id: newId,
        p_category: modalCategory,
        p_full_name: newPerson.full_name,
        p_phonetic: (newPerson.phonetic ?? null) as string,
        p_role: (newPerson.role ?? null) as string,
        p_audio_url: (newPerson.audio_url ?? null) as string,
        p_position: newPerson.position,
        p_notes: newPerson.notes ?? undefined,
        p_email: newPerson.email ?? undefined,
        p_phone: newPerson.phone ?? undefined,
      })
    }
    setSaving(false)
    setModalOpen(false)
    setEditingPerson(null)
  }, [editingPerson, modalCategory, people, supabase, token])

  const handleDeletePerson = useCallback(async () => {
    if (!editingPerson) return
    setSaving(true)
    setPeople((prev) => prev.filter((p) => p.id !== editingPerson.id))
    await supabase.rpc('delete_portal_person', { p_token: token, p_id: editingPerson.id })
    setSaving(false)
    setModalOpen(false)
    setEditingPerson(null)
  }, [editingPerson, supabase, token])

  // Vendor handlers
  const handleAddVendor = async () => {
    if (!vendorForm.name.trim()) {
      setVendorError('Name is required')
      return
    }
    if (!vendorForm.category) {
      setVendorError('Category is required')
      return
    }
    setVendorLoading(true)
    setVendorError(null)
    try {
      const { data, error } = await supabase.rpc('save_portal_contact', {
        p_token: token,
        p_name: vendorForm.name.trim(),
        p_email: (vendorForm.email.trim() || null) as string,
        p_phone: (vendorForm.phone.trim() || null) as string,
        p_category: vendorForm.category,
        p_notes: '',
      })
      if (error) throw error
      setContacts([...contacts, {
        id: data || '',
        name: vendorForm.name.trim(),
        category: vendorForm.category,
        email: vendorForm.email.trim() || null,
        phone: vendorForm.phone.trim() || null,
      }])
      setVendorForm({ name: '', category: '', email: '', phone: '' })
      setVendorModalOpen(false)
    } catch (err) {
      setVendorError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setVendorLoading(false)
    }
  }

  const partners = people.filter((p) => p.category === 'partner')
  const bridalParty = people.filter((p) => p.category === 'bridal_party')
  const family = people.filter((p) => p.category === 'family')
  const other = people.filter((p) => p.category === 'other')

  return (
    <div className="space-y-8">
      {/* Partners */}
      <PeopleGroup
        label="Couple"
        addLabel="partner"
        people={partners}
        roleOptions={PARTNER_ROLES}
        onAdd={() => openAdd('partner', PARTNER_ROLES)}
        onEdit={(p) => openEdit(p, PARTNER_ROLES)}
        branding={branding}
      />

      {/* Bridal Party */}
      <PeopleGroup
        label="Bridal Party"
        addLabel="bridal party member"
        people={bridalParty}
        roleOptions={BRIDAL_ROLES}
        onAdd={() => openAdd('bridal_party', BRIDAL_ROLES)}
        onEdit={(p) => openEdit(p, BRIDAL_ROLES)}
        branding={branding}
      />

      {/* Family */}
      <PeopleGroup
        label="Family Members"
        addLabel="family member"
        people={family}
        roleOptions={FAMILY_ROLES}
        onAdd={() => openAdd('family', FAMILY_ROLES)}
        onEdit={(p) => openEdit(p, FAMILY_ROLES)}
        branding={branding}
      />

      {/* Other */}
      <PeopleGroup
        label="Other"
        addLabel="other contact"
        people={other}
        roleOptions={OTHER_ROLES}
        onAdd={() => openAdd('other', OTHER_ROLES)}
        onEdit={(p) => openEdit(p, OTHER_ROLES)}
        branding={branding}
      />

      {/* Vendors */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <p
            style={{
              fontSize: `${bodyDefaults.fontSize}px`,
              fontWeight: 500,
              color: finePrintDefaults.color,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Vendors{' '}
            <span
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                fontWeight: finePrintDefaults.fontWeight,
                color: finePrintDefaults.color,
              }}
            >
              ({contacts.length})
            </span>
          </p>
        </div>
        {contacts.length === 0 && (
          <div
            className="border border-dashed text-center p-4"
            style={{
              borderColor: branding.border_color,
              backgroundColor: `${branding.border_color}10`,
              borderRadius: branding.corner_radius,
            }}
          >
            <p
              className="mb-2.5"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              No vendors yet
            </p>
            <button
              onClick={() => { setVendorForm({ name: '', category: '', email: '', phone: '' }); setVendorError(null); setVendorModalOpen(true) }}
              className="transition cursor-pointer hover:opacity-75"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                fontWeight: 500,
                color: branding.brand_color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Add vendor
            </button>
          </div>
        )}
        {contacts.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="border p-4"
                  style={{
                    backgroundColor: branding.surface_color,
                    borderColor: branding.border_color,
                    borderRadius: branding.corner_radius,
                    borderWidth: 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-medium"
                        style={{
                          fontSize: `${bodyDefaults.fontSize}px`,
                          color: bodyDefaults.color,
                          fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                          fontWeight: 500,
                          lineHeight: bodyDefaults.lineHeight,
                        }}
                      >
                        {contact.name}
                      </p>
                      {contact.category && (
                        <span
                          className="inline-block px-2 py-1 mt-1.5 font-medium"
                          style={{
                            fontSize: `${finePrintDefaults.fontSize}px`,
                            color: finePrintDefaults.color,
                            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                            fontWeight: 500,
                            lineHeight: finePrintDefaults.lineHeight,
                            backgroundColor: `${branding.border_color}15`,
                            borderRadius: branding.corner_radius,
                          }}
                        >
                          {CATEGORY_LABELS[contact.category as keyof typeof CATEGORY_LABELS] || contact.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {(contact.email || contact.phone) && (
                    <div
                      className="flex flex-col gap-1.5 mt-2.5"
                      style={{
                        fontSize: `${finePrintDefaults.fontSize}px`,
                        color: finePrintDefaults.color,
                        fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                        fontWeight: finePrintDefaults.fontWeight,
                        lineHeight: finePrintDefaults.lineHeight,
                      }}
                    >
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1.5 hover:opacity-75 transition"
                          style={{ color: finePrintDefaults.color }}
                        >
                          <Mail size={14} strokeWidth={1.5} />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1.5 hover:opacity-75 transition"
                          style={{ color: finePrintDefaults.color }}
                        >
                          <Phone size={14} strokeWidth={1.5} />
                          <span>{contact.phone}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => { setVendorForm({ name: '', category: '', email: '', phone: '' }); setVendorError(null); setVendorModalOpen(true) }}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed py-2.5 transition cursor-pointer hover:opacity-75"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                fontWeight: 500,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                lineHeight: finePrintDefaults.lineHeight,
                borderColor: branding.border_color,
                backgroundColor: `${branding.border_color}10`,
                borderRadius: branding.corner_radius,
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
              Add vendor
            </button>
          </>
        )}
      </div>

      {modalOpen && (
        <PersonModal
          onClose={() => { setModalOpen(false); setEditingPerson(null) }}
          onSave={handleSavePerson}
          onDelete={editingPerson ? handleDeletePerson : undefined}
          person={editingPerson}
          roleOptions={modalRoleOptions}
          token={token}
          saving={saving}
          branding={branding}
        />
      )}

      <Modal isOpen={vendorModalOpen} onClose={() => setVendorModalOpen(false)} title="Add vendor contact" size="lg">
        <div className="space-y-3">
          {vendorError && (
            <div
              className="p-3"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                borderRadius: branding.corner_radius,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              {vendorError}
            </div>
          )}
          <div>
            <label className="block mb-1" style={getLabelStyles(branding)}>
              Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              placeholder="Business or contact name"
              autoFocus
              style={{
                ...getInputStyles(branding),
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                color: bodyDefaults.color,
                lineHeight: bodyDefaults.lineHeight,
                borderWidth: 1,
                borderRadius: branding.corner_radius,
                padding: '0.5rem 0.75rem',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block mb-1" style={getLabelStyles(branding)}>
              Category <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <Popover.Root open={categoryOpen} onOpenChange={setCategoryOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 transition cursor-pointer"
                  style={{
                    ...getInputStyles(branding),
                    fontSize: `${bodyDefaults.fontSize}px`,
                    fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                    fontWeight: bodyDefaults.fontWeight,
                    color: vendorForm.category ? bodyDefaults.color : finePrintDefaults.color,
                    lineHeight: bodyDefaults.lineHeight,
                    borderWidth: 1,
                    borderColor: branding.border_color,
                    borderRadius: branding.corner_radius,
                    outline: 'none',
                  }}
                >
                  <span>
                    {vendorForm.category ? CATEGORY_LABELS[vendorForm.category as keyof typeof CATEGORY_LABELS] : 'Select category'}
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    style={{ color: finePrintDefaults.color }}
                    className="shrink-0"
                  />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="rounded-control shadow-lg z-[90] py-1 max-h-60 overflow-y-auto"
                  style={{
                    width: 'var(--radix-popover-trigger-width)',
                    backgroundColor: branding.surface_color,
                    borderWidth: 1,
                    borderColor: branding.border_color,
                    borderRadius: branding.corner_radius,
                  }}
                  sideOffset={4}
                  align="start"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setVendorForm({ ...vendorForm, category: cat }); setCategoryOpen(false) }}
                      className="w-full text-left px-3 py-1.5 transition cursor-pointer"
                      style={{
                        fontSize: `${bodyDefaults.fontSize}px`,
                        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                        fontWeight: vendorForm.category === cat ? 500 : bodyDefaults.fontWeight,
                        color: vendorForm.category === cat ? bodyDefaults.color : bodyDefaults.color,
                        backgroundColor: vendorForm.category === cat ? `${branding.brand_color}10` : 'transparent',
                        lineHeight: bodyDefaults.lineHeight,
                      }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <div>
            <label className="block mb-1" style={getLabelStyles(branding)}>Email</label>
            <input
              type="email"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
              placeholder="email@example.com"
              style={{
                ...getInputStyles(branding),
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                color: bodyDefaults.color,
                lineHeight: bodyDefaults.lineHeight,
                borderWidth: 1,
                borderRadius: branding.corner_radius,
                padding: '0.5rem 0.75rem',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block mb-1" style={getLabelStyles(branding)}>Phone</label>
            <input
              type="tel"
              value={vendorForm.phone}
              onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              placeholder="+61 400 000 000"
              style={{
                ...getInputStyles(branding),
                fontSize: `${bodyDefaults.fontSize}px`,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                color: bodyDefaults.color,
                lineHeight: bodyDefaults.lineHeight,
                borderWidth: 1,
                borderRadius: branding.corner_radius,
                padding: '0.5rem 0.75rem',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              className="w-full"
            />
          </div>
          <div
            className="flex items-center justify-end gap-2 pt-2"
            style={{
              borderTopWidth: 1,
              borderTopColor: branding.border_color,
            }}
          >
            <button
              type="button"
              onClick={() => setVendorModalOpen(false)}
              className="px-3 py-1.5 transition cursor-pointer hover:opacity-75"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: bodyDefaults.fontWeight,
                lineHeight: bodyDefaults.lineHeight,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddVendor}
              disabled={vendorLoading}
              className="px-3 py-1.5 transition cursor-pointer"
              style={{
                fontSize: `${bodyDefaults.fontSize}px`,
                color: '#ffffff',
                backgroundColor: branding.brand_color,
                fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                fontWeight: 500,
                lineHeight: bodyDefaults.lineHeight,
                borderRadius: branding.corner_radius,
                opacity: vendorLoading ? 0.5 : 1,
                cursor: vendorLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <BusyLabel busy={vendorLoading}>Add</BusyLabel>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

'use client'

import { Plus, Mail, Phone, Mic, Square, Play, Trash2, Loader2, Pencil, ChevronDown } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'

import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import type { PortalContact, PortalPerson } from './page'
import { CATEGORY_LABELS, CATEGORIES } from '@/types/contact'

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

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition'

// ── Audio recorder ────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-1.5 text-caption text-text-subtle">
        <Loader2 size={13} className="animate-spin" />
        Uploading audio…
      </div>
    )
  }

  if (recording) {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className="flex items-center gap-1 text-caption text-danger border border-danger/30 bg-danger/10 rounded-control px-2.5 py-1.5 hover:bg-danger/20 transition cursor-pointer animate-pulse"
      >
        <Square size={12} strokeWidth={2} />
        Stop recording
      </button>
    )
  }

  if (audioUrl) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
        <audio src={audioUrl} className="hidden" id={`audio-modal-${personId}`} />
        <button
          type="button"
          onClick={() => (document.getElementById(`audio-modal-${personId}`) as HTMLAudioElement)?.play()}
          className="flex items-center gap-1 text-caption text-success border border-success/30 bg-success/10 rounded-control px-2.5 py-1.5 hover:bg-success/20 transition cursor-pointer"
        >
          <Play size={12} strokeWidth={2} />
          Play
        </button>
        <button
          type="button"
          onClick={startRecording}
          className="text-caption text-text-subtle hover:text-text-muted transition cursor-pointer"
          title="Re-record pronunciation"
        >
          <Mic size={13} strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      className="flex items-center gap-1 text-caption text-text-muted border border-border rounded-control px-2.5 py-1.5 hover:bg-surface-muted transition cursor-pointer w-full sm:w-auto justify-center sm:justify-start"
    >
      <Mic size={12} strokeWidth={1.5} />
      Record pronunciation
    </button>
  )
}

// ── Person modal ──────────────────────────────────────────────────────────────

interface PersonModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<PortalPerson>) => Promise<void>
  onDelete?: () => Promise<void>
  person: PortalPerson | null
  roleOptions: string[]
  token: string
  saving: boolean
}

function PersonModal({ isOpen, onClose, onSave, onDelete, person, roleOptions, token, saving }: PersonModalProps) {
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [role, setRole] = useState(person?.role ?? '')
  const [phonetic, setPhonetic] = useState(person?.phonetic ?? '')
  const [audioUrl, setAudioUrl] = useState(person?.audio_url ?? null)
  const [notes, setNotes] = useState(person?.notes ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [phone, setPhone] = useState(person?.phone ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFullName(person?.full_name ?? '')
      setRole(person?.role ?? '')
      setPhonetic(person?.phonetic ?? '')
      setAudioUrl(person?.audio_url ?? null)
      setNotes(person?.notes ?? '')
      setEmail(person?.email ?? '')
      setPhone(person?.phone ?? '')
      setConfirmDelete(false)
    }
  }, [isOpen, person])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={person ? 'Edit person' : 'Add person'} size="lg">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61 400 000 000" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for the MC..."
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition resize-none"
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
              onClick={() => onSave({ full_name: fullName, role: role || null, phonetic: phonetic || null, audio_url: audioUrl, notes: notes || null, email: email || null, phone: phone || null })}
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

// ── Person row ────────────────────────────────────────────────────────────────

function PersonRow({ person, onEdit }: { person: PortalPerson; onEdit: () => void }) {
  return (
    <div
      className="flex items-center gap-3 border border-border rounded-card px-4 py-3 bg-surface hover:border-border-strong hover:bg-surface-muted transition cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-body font-medium text-text">{person.full_name || 'Unnamed'}</p>
          {person.role && (
            <span className="text-caption text-text-muted bg-surface-muted rounded-pill px-2.5 py-0.5">
              {person.role}
            </span>
          )}
        </div>
        {person.phonetic && (
          <p className="text-body text-text-muted mt-0.5 font-mono">{person.phonetic}</p>
        )}
      </div>
      {person.audio_url && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <audio src={person.audio_url} className="hidden" id={`audio-row-${person.id}`} />
          <button
            onClick={() => (document.getElementById(`audio-row-${person.id}`) as HTMLAudioElement)?.play()}
            className="flex items-center gap-1 text-caption text-success border border-success/30 bg-success/10 rounded-control px-2.5 py-1.5 hover:bg-success/20 transition cursor-pointer"
          >
            <Play size={12} strokeWidth={2} />
            Play
          </button>
        </div>
      )}
      <Pencil size={13} strokeWidth={1.5} className="text-text-subtle shrink-0" />
    </div>
  )
}

// ── People group ──────────────────────────────────────────────────────────────

interface PeopleGroupProps {
  label: string
  people: PortalPerson[]
  roleOptions: string[]
  onAdd: () => void
  onEdit: (person: PortalPerson) => void
}

function PeopleGroup({ label, people, onAdd, onEdit }: PeopleGroupProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-body font-medium text-text-muted">{label} <span className="text-caption font-normal text-text-subtle">({people.length})</span></p>
      </div>
      {people.length === 0 && (
        <div className="border border-dashed border-border rounded-card p-4 text-center bg-surface-muted/50">
          <p className="text-caption text-text-subtle mb-2.5">No {label.toLowerCase()} yet</p>
          <button
            onClick={onAdd}
            className="text-caption font-medium text-brand-fg hover:text-text-muted transition cursor-pointer"
          >
            Add {label.toLowerCase().slice(0, -1)}
          </button>
        </div>
      )}
      {people.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {people.map((p) => (
              <PersonRow key={p.id} person={p} onEdit={() => onEdit(p)} />
            ))}
          </div>
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-1.5 text-caption font-medium text-text-muted border border-dashed border-border rounded-card py-2.5 hover:bg-surface-muted transition cursor-pointer"
          >
            <Plus size={14} strokeWidth={1.5} />
            Add {label.toLowerCase().slice(0, -1)}
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
}

export function ContactsSection({ token, initialContacts, initialPeople }: ContactsSectionProps) {
  const supabase = createClient()

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
        // these SQL params accept null at runtime — behaviour unchanged,
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
        people={partners}
        roleOptions={PARTNER_ROLES}

        onAdd={() => openAdd('partner', PARTNER_ROLES)}
        onEdit={(p) => openEdit(p, PARTNER_ROLES)}
      />

      {/* Bridal Party */}
      <PeopleGroup
        label="Bridal Party"
        people={bridalParty}
        roleOptions={BRIDAL_ROLES}

        onAdd={() => openAdd('bridal_party', BRIDAL_ROLES)}
        onEdit={(p) => openEdit(p, BRIDAL_ROLES)}
      />

      {/* Family */}
      <PeopleGroup
        label="Family Members"
        people={family}
        roleOptions={FAMILY_ROLES}

        onAdd={() => openAdd('family', FAMILY_ROLES)}
        onEdit={(p) => openEdit(p, FAMILY_ROLES)}
      />

      {/* Other */}
      <PeopleGroup
        label="Other"
        people={other}
        roleOptions={OTHER_ROLES}

        onAdd={() => openAdd('other', OTHER_ROLES)}
        onEdit={(p) => openEdit(p, OTHER_ROLES)}
      />

      {/* Vendors */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-body font-medium text-text-muted">Vendors <span className="text-caption font-normal text-text-subtle">({contacts.length})</span></p>
        </div>
        {contacts.length === 0 && (
          <div className="border border-dashed border-border rounded-card p-4 text-center bg-surface-muted/50">
            <p className="text-caption text-text-subtle mb-2.5">No vendors yet</p>
            <button
              onClick={() => { setVendorForm({ name: '', category: '', email: '', phone: '' }); setVendorError(null); setVendorModalOpen(true) }}
              className="text-caption font-medium text-brand-fg hover:text-text-muted transition cursor-pointer"
            >
              Add vendor
            </button>
          </div>
        )}
        {contacts.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-text">{contact.name}</p>
                      {contact.category && (
                        <span className="inline-block text-caption font-medium px-2 py-1 rounded-pill bg-surface-muted text-text-muted mt-1.5">
                          {CATEGORY_LABELS[contact.category as keyof typeof CATEGORY_LABELS] || contact.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {(contact.email || contact.phone) && (
                    <div className="flex flex-col gap-1.5 mt-2.5 text-caption text-text-muted">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-text transition">
                          <Mail size={14} strokeWidth={1.5} />
                          <span className="truncate">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 hover:text-text transition">
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
              className="w-full flex items-center justify-center gap-1.5 text-caption font-medium text-text-muted border border-dashed border-border rounded-card py-2.5 hover:bg-surface-muted transition cursor-pointer"
            >
              <Plus size={14} strokeWidth={1.5} />
              Add vendor
            </button>
          </>
        )}
      </div>

      <PersonModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPerson(null) }}
        onSave={handleSavePerson}
        onDelete={editingPerson ? handleDeletePerson : undefined}
        person={editingPerson}
        roleOptions={modalRoleOptions}
        token={token}
        saving={saving}
      />

      <Modal isOpen={vendorModalOpen} onClose={() => setVendorModalOpen(false)} title="Add vendor contact" size="lg">
        <div className="space-y-3">
          {vendorError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{vendorError}</div>}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              placeholder="Business or contact name"
              autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category <span className="text-red-400">*</span></label>
            <Popover.Root open={categoryOpen} onOpenChange={setCategoryOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 text-sm hover:border-gray-300 transition cursor-pointer"
                >
                  <span className={vendorForm.category ? 'text-gray-900' : 'text-gray-400'}>
                    {vendorForm.category ? CATEGORY_LABELS[vendorForm.category as keyof typeof CATEGORY_LABELS] : 'Select category'}
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
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setVendorForm({ ...vendorForm, category: cat }); setCategoryOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition cursor-pointer ${
                        vendorForm.category === cat
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
              placeholder="email@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input
              type="tel"
              value={vendorForm.phone}
              onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              placeholder="+61 400 000 000"
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setVendorModalOpen(false)}
              className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddVendor}
              disabled={vendorLoading}
              className="text-sm text-white bg-gray-900 rounded-xl px-3 py-1.5 hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
            >
              {vendorLoading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

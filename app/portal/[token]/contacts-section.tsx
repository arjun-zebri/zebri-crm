'use client'

import { useState } from 'react'
import { Plus, Mail, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PortalContact } from './page'
import { CATEGORY_LABELS } from '@/app/(dashboard)/contacts/contacts-types'

interface ContactsSectionProps {
  token: string
  initialContacts: PortalContact[]
}

export function ContactsSection({ token, initialContacts }: ContactsSectionProps) {
  const supabase = createClient()
  const [contacts, setContacts] = useState<PortalContact[]>(initialContacts)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', category: '', email: '', phone: '' })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }
    if (!formData.category) {
      setError('Category is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('save_portal_contact', {
        p_token: token,
        p_name: formData.name.trim(),
        p_email: formData.email.trim() || null,
        p_phone: formData.phone.trim() || null,
        p_category: formData.category,
        p_notes: '',
      })

      if (rpcError) throw rpcError

      // Optimistically add to local state
      setContacts([
        ...contacts,
        {
          id: data || '',
          name: formData.name.trim(),
          category: formData.category,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
        },
      ])

      setFormData({ name: '', category: '', email: '', phone: '' })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {contacts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Vendor contacts</h3>
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                    {contact.category && (
                      <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700 mt-2">
                        {CATEGORY_LABELS[contact.category as keyof typeof CATEGORY_LABELS] || contact.category}
                      </span>
                    )}
                  </div>
                </div>
                {(contact.email || contact.phone) && (
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-gray-900">
                        <Mail size={14} />
                        <span>{contact.email}</span>
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-gray-900">
                        <Phone size={14} />
                        <span>{contact.phone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add contact form */}
      <div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition w-full justify-center"
        >
          <Plus size={16} />
          Add contact
        </button>

        {showForm && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contact name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              >
                <option value="">Select category</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+61 400 000 000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

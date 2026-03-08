'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EmailPreferencesData {
  product_updates?: boolean
  booking_reminders?: boolean
  tips?: boolean
}

interface AccountSectionProps {
  emailPreferences?: EmailPreferencesData
}

function getPasswordStrength(password: string): { label: string; color: string; width: string } | null {
  if (!password) return null

  const hasUpperAndLower = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)

  if (password.length >= 10 && hasUpperAndLower && hasNumbers && hasSpecial) {
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' }
  }
  if (password.length >= 8 && (hasUpperAndLower || hasNumbers)) {
    return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3' }
  }
  return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' }
}

export function AccountSection({ emailPreferences: initialEmailPreferences }: AccountSectionProps) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [emailPreferences, setEmailPreferences] = useState({
    productUpdates: initialEmailPreferences?.product_updates ?? true,
    bookingReminders: initialEmailPreferences?.booking_reminders ?? true,
    tips: initialEmailPreferences?.tips ?? false,
  })
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [preferencesMessage, setPreferencesMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const strength = getPasswordStrength(newPassword)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password changed.' })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setMessage(null), 3000)
    }

    setLoading(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const supabase = createClient()
    // TODO: Implement server-side account deletion route (supabase.auth.admin.deleteUser requires service role key)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSavePreferences = async () => {
    setPreferencesMessage(null)
    setSavingPreferences(true)

    const supabase = createClient()

    // Get current user to preserve existing metadata
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPreferencesMessage({ type: 'error', text: 'Unable to load user data.' })
      setSavingPreferences(false)
      return
    }

    // Merge new preferences with existing metadata
    const existingMetadata = user.user_metadata || {}
    const updatedMetadata = {
      ...existingMetadata,
      email_preferences: {
        product_updates: emailPreferences.productUpdates,
        booking_reminders: emailPreferences.bookingReminders,
        tips: emailPreferences.tips,
      },
    }

    const { error } = await supabase.auth.updateUser({
      data: updatedMetadata,
    })

    if (error) {
      setPreferencesMessage({ type: 'error', text: error.message })
    } else {
      setPreferencesMessage({ type: 'success', text: 'Preferences saved.' })
      setTimeout(() => setPreferencesMessage(null), 3000)
    }

    setSavingPreferences(false)
  }

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-transparent transition'

  return (
    <div className="max-w-2xl space-y-10">
      {/* Reset Password */}
      <div>
        <p className="text-sm text-gray-500 mb-4">Update your password.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-password">
                New Password <span className="text-xs text-gray-400 font-normal ml-1">Min. 6 characters</span>
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Enter new password"
                  aria-describedby={strength ? 'password-strength' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {strength && (
                <div id="password-strength" className="mt-2">
                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} rounded-full transition-all`} />
                  </div>
                  <p className={`text-xs mt-1 ${
                    strength.label === 'Strong' ? 'text-green-600' :
                    strength.label === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>

            {message && (
              <span
                role="alert"
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Email Preferences */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Email Preferences</h3>
        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailPreferences.productUpdates}
              onChange={(e) => setEmailPreferences({ ...emailPreferences, productUpdates: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-black focus:ring-green-200"
            />
            <span className="text-sm text-gray-700">Product updates and announcements</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailPreferences.bookingReminders}
              onChange={(e) => setEmailPreferences({ ...emailPreferences, bookingReminders: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-black focus:ring-green-200"
            />
            <span className="text-sm text-gray-700">Booking reminders and event alerts</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailPreferences.tips}
              onChange={(e) => setEmailPreferences({ ...emailPreferences, tips: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-black focus:ring-green-200"
            />
            <span className="text-sm text-gray-700">Tips and best practices</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingPreferences}
            className="bg-black text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </button>
          {preferencesMessage && (
            <span
              role="alert"
              className={`text-sm ${
                preferencesMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {preferencesMessage.text}
            </span>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-sm font-medium text-red-600 mb-1">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">Permanently delete your account and all associated data.</p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="border border-red-300 text-red-600 text-sm font-medium rounded-lg px-4 py-2 hover:bg-red-50 transition"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
          />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete your account?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action is permanent and cannot be undone. All your data will be deleted.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="delete-confirm">
                Type <span className="font-semibold">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-transparent transition"
                placeholder="DELETE"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                onClick={handleDeleteAccount}
                className="bg-red-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

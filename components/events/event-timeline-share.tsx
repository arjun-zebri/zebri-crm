'use client'

import { RotateCw, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface EventTimelineShareProps {
  shareToken: string | null | undefined
  shareEnabled: boolean
  onToggle: (enabled: boolean) => void
  onRegenerate: () => void
  loading: boolean
}

export function EventTimelineShare({
  shareToken,
  shareEnabled,
  onToggle,
  onRegenerate,
  loading,
}: EventTimelineShareProps) {
  const [copied, setCopied] = useState(false)
  const [regenConfirm, setRegenConfirm] = useState(false)

  const handleCopy = () => {
    if (!shareToken) return
    const url = `${window.location.origin}/timeline/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegen = () => {
    if (!regenConfirm) {
      setRegenConfirm(true)
      return
    }
    setRegenConfirm(false)
    onRegenerate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-body font-medium text-text">Share link</p>
        <button
          onClick={() => onToggle(!shareEnabled)}
          disabled={loading}
          aria-label={shareEnabled ? 'Disable share link' : 'Enable share link'}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-pill transition-colors duration-200 focus:outline-none disabled:opacity-50 cursor-pointer ${
            shareEnabled ? 'bg-emerald-500' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-pill bg-surface shadow transition-transform duration-200 ${
              shareEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <p className="text-caption text-text-subtle mb-3">
        {shareEnabled
          ? 'Anyone with this link can view the timeline.'
          : 'Enable to share with vendors and couples.'}
      </p>

      {shareEnabled && shareToken ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-body px-3 py-1.5 border border-border rounded-control hover:bg-gray-50 transition cursor-pointer"
          >
            {copied ? (
              <Check size={14} strokeWidth={1.5} className="text-emerald-500" />
            ) : (
              <Copy size={14} strokeWidth={1.5} />
            )}
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {regenConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-caption text-text-muted">Break existing link?</span>
              <button
                onClick={handleRegen}
                disabled={loading}
                className="text-caption text-red-600 hover:underline cursor-pointer disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setRegenConfirm(false)}
                className="text-caption text-text-subtle hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRegenConfirm(true)}
              disabled={loading}
              title="Regenerate link"
              className="p-1.5 text-text-subtle hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

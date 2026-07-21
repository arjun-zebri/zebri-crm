'use client'

import { User } from 'lucide-react'

/**
 * Step 8: a personal note to close on.
 *
 * The body copy below is placeholder. It must be replaced with real copy
 * before this ships to users. The photo and signature are placeholders in
 * the same sense: the layout reserves their space so dropping in the real
 * assets is a swap, not a redesign.
 */
export function StepFounder() {
  return (
    <div className="flex flex-col items-center text-center h-full justify-center gap-5 px-6">
      <div className="w-20 h-20 rounded-full bg-surface-muted border border-border flex items-center justify-center">
        <User size={28} strokeWidth={1.5} className="text-text-subtle" />
      </div>

      <h2 className="text-xl font-semibold text-text">A note from the founder</h2>

      <p className="text-sm text-text-muted max-w-md leading-relaxed">
        Thanks for giving Zebri a go. I built it because running an MC
        business off spreadsheets and an inbox is harder than the actual
        weddings. If something is missing or in your way, tell me. I read
        every message.
      </p>

      <div className="flex flex-col items-center gap-1 pt-2">
        <div className="h-8 w-32 rounded bg-surface-muted border border-border" aria-hidden />
        <span className="text-sm font-medium text-text">Arjun Punekar</span>
        <span className="text-xs text-text-subtle">Founder, Zebri</span>
      </div>
    </div>
  )
}

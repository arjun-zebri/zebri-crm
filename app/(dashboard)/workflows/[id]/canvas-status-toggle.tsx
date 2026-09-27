'use client'

/**
 * The canvas header's Turn on / Turn off button.
 *
 * Owns its confirmation rather than leaving it to the page: turning a
 * workflow off pauses the couples running it, so the button must not be
 * wired anywhere without the dialog that says how many.
 *
 * @module app/(dashboard)/workflows/[id]/canvas-status-toggle
 */

import { Power } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { TemplateStatus } from '@/types/workflows'

import { setTemplateStatusAction } from '../actions'
import { TemplateStatusDialog } from '../template-status-dialog'
import { useTemplateStatusChange } from '../use-template-status-change'

interface Props {
  templateId: string
  /** The template's current status. */
  status: string
  /** Called once the server has accepted the change. */
  onChanged: (next: TemplateStatus) => void
}

/** See the module comment. */
export function CanvasStatusToggle({ templateId, status, onChanged }: Props) {
  const isActive = status === 'active'
  const change = useTemplateStatusChange(async (id, next, resumePaused) => {
    const res = await setTemplateStatusAction({ templateId: id, status: next, resumePaused })
    if (!res.ok) throw new Error(res.error)
    onChanged(next)
    return res.data
  })

  return (
    <>
      {/* Templates have no `paused`: a workflow that should stop applying
          goes back to being a draft, which is also editable. */}
      <Button
        variant={isActive ? 'outline' : 'primary'}
        // Busy while the couples are counted, so a second click cannot
        // open the dialog twice.
        loading={change.checking}
        onClick={() => void change.request(templateId, status, isActive ? 'draft' : 'active')}
        className="gap-1.5"
      >
        <Power size={14} strokeWidth={1.5} />
        {isActive ? 'Turn off' : 'Turn on'}
      </Button>
      <TemplateStatusDialog {...change.dialog} />
    </>
  )
}

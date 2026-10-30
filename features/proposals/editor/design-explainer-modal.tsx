'use client'

/**
 * The one-time "what am I editing?" explainer, shown over the proposal
 * design editor the first time an account opens it.
 *
 * The proposal editor and the template editor are the same canvas, so an
 * MC clicking "Make edits" from the send modal had no way to know their
 * template was not the thing under the cursor (founder, 2026-09-23). The
 * `ProposalCopyBadge` in the header says whose copy it is at a glance;
 * this says it once, in full, before the first stroke.
 *
 * Deliberately not shown by the template editor: there the template IS
 * the document being changed, and this reassurance would be a lie.
 *
 * There is no "do not show this again" tick. Dismissing is the tick: the
 * modal appears once per account and says so, which is the same idea with
 * one control instead of two.
 *
 * @module features/proposals/editor/design-explainer-modal
 */
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

import { hasSeenDesignExplainer, markDesignExplainerSeen } from './design-explainer-seen'

/** Props for {@link DesignExplainerModal}. */
export interface DesignExplainerModalProps {
  /** The signed-in user, scoping the "already seen" flag. `null` shows the explainer every time (see `design-explainer-seen.ts`). */
  userId: string | null
  /** The couple this proposal is for. Blank when the couple row could not be read. */
  coupleName: string
  /** The template this copy came from, or `null` when the proposal was not created from one. */
  templateName: string | null
}

/** Shows the explainer once per account, over the proposal design editor. */
export function DesignExplainerModal({ userId, coupleName, templateName }: DesignExplainerModalProps) {
  // Read once, in the initialiser: the editor body this sits in only ever
  // mounts on the client (its gate renders a skeleton until react-query
  // has a row, which never happens during SSR), so there is no
  // server-rendered first pass for a storage read to disagree with. The
  // `window` guard keeps that true rather than assumed.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && !hasSeenDesignExplainer(userId))

  const dismiss = () => {
    markDesignExplainerSeen(userId)
    setOpen(false)
  }

  return (
    <Modal
      isOpen={open}
      onClose={dismiss}
      title="You are editing this couple's copy"
      size="md"
      footer={
        <div className="flex justify-end">
          <Button onClick={dismiss}>Got it</Button>
        </div>
      }
    >
      <p className="text-body text-text">{sentence(coupleName, templateName)}</p>
      <p className="mt-3 text-body text-text-muted">You will only see this once.</p>
    </Modal>
  )
}

/**
 * The explanation itself. The template is named when we know it, because
 * "your template" in the abstract is exactly the thing being doubted; the
 * couple's name grounds whose document this is.
 */
function sentence(coupleName: string, templateName: string | null): string {
  const who = coupleName.trim() === '' ? 'this couple' : coupleName.trim()
  const what = templateName?.trim() ? `your template ${templateName.trim()}` : 'your template'
  return `This is a copy of ${what}, made for ${who}. Anything you change here goes to this proposal only and never touches the template, so you can tailor it freely.`
}

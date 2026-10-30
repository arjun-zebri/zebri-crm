'use client'

/**
 * The proposal editor header's "whose document is this?" badge.
 *
 * The proposal editor and the template editor are the same canvas on the
 * same chrome, so an MC who opened "Make edits" from a couple had nothing
 * on screen telling them which of the two they were in, and reasonably
 * read it as editing their template (founder, 2026-09-23: "the make edits
 * should be just for the proposal going out to that couple, we dont want
 * to change the entire template"). Mechanically it always was the couple's
 * own copy; this says so.
 *
 * Two things have to land at a glance: the document belongs to one couple,
 * and the template behind it is untouched. The pill carries the first, its
 * tooltip the second, by name.
 *
 * @module features/proposals/editor/proposal-copy-badge
 */
import { StatePill } from '@/components/ui/state-pill'
import { Tooltip } from '@/components/ui/tooltip'

/** Props for {@link ProposalCopyBadge}. */
export interface ProposalCopyBadgeProps {
  /** The couple this proposal is for, from `ProposalDesignRecord.coupleName`. Blank when the couple row could not be read. */
  coupleName: string
  /** The template this proposal was copied from, or `null` when it was not created from one. */
  templateName: string | null
}

/** "Anna & Jake's copy", with the reassurance about the template in its tooltip. */
export function ProposalCopyBadge({ coupleName, templateName }: ProposalCopyBadgeProps) {
  const who = coupleName.trim()
  return (
    // The header is one `h-12` row at every width, so below `sm` (where the
    // back link, name, status, Preview, device toggle and Send already fill
    // it) the badge steps out rather than wrapping the row. A `div` wrapper
    // rather than `hidden sm:inline-flex` on the pill itself: two display
    // utilities on one element resolve by stylesheet order, not by the
    // order they are written in.
    <div className="hidden shrink-0 sm:block">
      <Tooltip label={reassurance(templateName)} multiline>
        <StatePill
          tone="neutral"
          className="max-w-56 overflow-hidden"
          // Only the name truncates. Truncating the whole phrase ate the
          // word "copy" first, which is the word doing all the work.
          label={(
            <span className="flex min-w-0 items-baseline">
              <span className="truncate">{whoLabel(who)}</span>
              <span className="shrink-0">&apos;s copy</span>
            </span>
          )}
        />
      </Tooltip>
    </div>
  )
}

/** Whose copy it is. Falls back to a nameless form rather than opening with an apostrophe when the couple's name is blank. */
function whoLabel(who: string): string {
  return who === '' ? 'This couple' : who
}

/** The tooltip sentence: the template is named when we know it, because "your template" alone is the thing being doubted. */
function reassurance(templateName: string | null): string {
  const named = templateName?.trim()
  return named
    ? `Editing this proposal only. Your template ${named} is not changed.`
    : 'Editing this proposal only. Your templates are not changed.'
}

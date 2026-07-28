'use client'

import { HintBubble } from './hint-bubble'

/**
 * Mint `{{ label }}` chip marking an auto-filled variable in the editor preview.
 * The value is shown for real once set; a chip stands in while it is blank so the
 * MC can see the field exists and where it comes from (hover `hint`). Never
 * rendered on the sent document (surfaces omit blank values there).
 */
export function VarChip({ label, hint }: { label: string; hint: string }) {
  return (
    <span
      className="relative group/vh inline-flex items-center rounded px-1 py-px text-[0.95em] font-medium align-baseline cursor-help"
      style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
    >
      {`{{ ${label} }}`}
      <HintBubble hint={hint} />
    </span>
  )
}

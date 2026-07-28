'use client'

/**
 * Small hover tooltip bubble for variable chips. Pure CSS (no JS/delay): the
 * parent element must carry `relative group/vh`, and this bubble fades in on
 * `group-hover/vh`. Used to explain how a variable's value gets filled.
 */
export function HintBubble({ hint }: { hint: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-0 z-[60] mb-1.5 w-max max-w-[240px] whitespace-normal rounded-md bg-gray-900 px-2 py-1 text-left text-[11px] font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/vh:opacity-100"
    >
      {hint}
    </span>
  )
}

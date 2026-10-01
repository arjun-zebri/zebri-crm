import { ToolMark, type Tool } from './tools';

/**
 * One replaced tool, drawn like an app icon: its mark in a white circle,
 * in the brand's colour, muted, and its name underneath, struck through a
 * beat after the badge lands.
 *
 * The item's box is the circle alone and the name hangs below it, so a
 * caller can centre the circle on a point with `-translate-x-1/2
 * -translate-y-7` (half the 56px circle).
 *
 * @module app/design-system/v2/pages/onboarding/tool-badge
 */

// Literal classes so Tailwind emits them: one stagger step per badge,
// then the strike a beat after it lands.
const IN = [
  '[animation-delay:300ms]', '[animation-delay:360ms]', '[animation-delay:420ms]', '[animation-delay:480ms]',
  '[animation-delay:540ms]', '[animation-delay:600ms]', '[animation-delay:660ms]', '[animation-delay:720ms]',
  '[animation-delay:780ms]', '[animation-delay:840ms]',
];
const OUT = [
  '[animation-delay:1100ms]', '[animation-delay:1160ms]', '[animation-delay:1220ms]', '[animation-delay:1280ms]',
  '[animation-delay:1340ms]', '[animation-delay:1400ms]', '[animation-delay:1460ms]', '[animation-delay:1520ms]',
  '[animation-delay:1580ms]', '[animation-delay:1640ms]',
];

export function ToolBadge({ tool, index, className = '' }: { tool: Tool; index: number; className?: string }) {
  return (
    // No position class here: the orbit makes the item absolute, and a
    // `relative` alongside would fight it. The inner span anchors the name.
    <li className={`size-14 motion-safe:animate-[reveal-up_600ms_cubic-bezier(0.22,1,0.36,1)_both] ${IN[index] ?? ''} ${className}`}>
      <span className="relative flex size-14 items-center justify-center rounded-pill border border-zebra-200 bg-field shadow-sm">
        {/* Muted, not grey: still recognisable, but the Zebri mark in the
            middle is the one that holds the eye. */}
        <span className="flex opacity-70 grayscale-[60%]">
          <ToolMark tool={tool} />
        </span>
        {/* Hangs below the circle without adding to the item's box. */}
        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap type-body text-zebra-500">
          <span className="sr-only">No more </span>
          {tool.name}
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 top-1/2 h-px origin-left bg-zebra-400 motion-safe:animate-[strike_400ms_cubic-bezier(0.65,0,0.35,1)_both] ${OUT[index] ?? ''}`}
          />
        </span>
      </span>
    </li>
  );
}

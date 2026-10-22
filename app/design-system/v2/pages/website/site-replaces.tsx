import { TOOLS, ToolMark } from '../onboarding/tools';

/**
 * The foot of the hero: the subscriptions Zebri replaces, as a quiet
 * row of their marks in grey, where Stripe puts its customer logos. Zebri
 * has no customer logos to show before launch; the tools a visitor
 * already pays for do the same job of "you know these" at a glance.
 * Phones get them as one endless row instead of a wrapped block. "The
 * stack", not "the ten": most visitors pay for three or four of them.
 *
 * @module app/design-system/v2/pages/website/site-replaces
 */

/** The tools strip. */
export function SiteReplaces() {
  return (
    // Inside the hero's section, so a heading of its own would split the hero in two for screen readers.
    <div>
      <p className="text-center type-body text-zebra-500">
        One subscription instead of the stack you pay for now
      </p>
      {/* Small, regular weight, one centred row: a footnote to the hero, not a band of its own. */}
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-4 max-md:hidden">
        {TOOLS.map((tool) => (
          <Tool key={tool.name} tool={tool} />
        ))}
      </ul>
      {/* Phones: one row running on forever (founder, 2026-10-19: one row, not a wrapped block).
          The list twice over, the copy hidden, moved by half its width so the loop has no seam;
          spacing is each item's own padding, so both halves measure the same. Reduced motion
          stops it and lets the row be swiped instead. */}
      <div className="mt-6 overflow-hidden mask-x-from-70% motion-reduce:overflow-x-auto motion-reduce:scrollbar-none md:hidden">
        <ul className="flex w-max animate-marquee motion-reduce:animate-none">
          {TOOLS.map((tool) => (
            <Tool key={tool.name} tool={tool} />
          ))}
          {TOOLS.map((tool) => (
            <Tool key={`${tool.name}-again`} tool={tool} hidden />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One tool: its mark and name, greyed. `hidden` for the phones' looping copy. */
function Tool({ tool, hidden = false }: { tool: (typeof TOOLS)[number]; hidden?: boolean }) {
  return (
    <li aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-1.5 opacity-60 grayscale max-md:pr-7">
      <ToolMark tool={tool} small />
      <span className="type-body text-zebra-700">{tool.name}</span>
    </li>
  );
}

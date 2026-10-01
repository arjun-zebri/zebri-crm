'use client';

import type { AutoAnimationPlugin } from '@formkit/auto-animate';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * Design system v2 tag list (preview, shown on `/design-system/v2`).
 *
 * A row of soft tags the user built themselves (what a package
 * includes), each with its own remove button, and an optional control
 * at the end for adding one. Tags slide in when added. A removed tag
 * fades out where it stands first, and only then do the rest close the
 * gap (auto-animate, which stands still under `prefers-reduced-motion`):
 * run together, the next tag slid over the one still fading.
 *
 * Unlike ChipGroup, nothing here is picked or unpicked: every tag is
 * in the list, and removing one takes it out.
 *
 * @example
 * ```tsx
 * <TagList label="What's included" items={lines} onRemove={remove} after={<AddOwn />} />
 * ```
 *
 * @module components/ui-v2/tag-list
 */

export interface TagListProps {
  /** Names the list for screen readers; not shown. */
  label: string;
  /** The tags, as their visible text. Each must be unique. */
  items: readonly string[];
  /** Called with the tag whose remove button was pressed. */
  onRemove: (item: string) => void;
  /** Rendered after the last tag, e.g. an "Add your own" control. */
  after?: ReactNode;
}

/** v2 tag list. See {@link TagListProps}. */
/** How long a removed tag fades in place before it leaves the list. */
const FADE_MS = 120;

/**
 * auto-animate's moves and entrances, but no exit of its own: by the
 * time a tag leaves the list it has already faded in place, and the
 * default exit put it back at full opacity to fade it again.
 */
// The third argument is where the tag was and the fourth where it is
// now, whatever the library's parameter names say (see its docs).
const tagMotion: AutoAnimationPlugin = (el, action, from, to) => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timing = { duration: still ? 0 : 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
  if (action === 'remove') return new KeyframeEffect(el, [{ opacity: 0 }, { opacity: 0 }], { duration: 1 });
  if (action === 'add') {
    return new KeyframeEffect(el, [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], timing);
  }
  const dx = from && to ? from.left - to.left : 0;
  const dy = from && to ? from.top - to.top : 0;
  return new KeyframeEffect(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], timing);
};

export function TagList({ label, items, onRemove, after }: TagListProps) {
  const [ref] = useAutoAnimate<HTMLUListElement>(tagMotion);
  const [leaving, setLeaving] = useState<string | null>(null);
  const remove = (item: string) => {
    setLeaving(item);
    setTimeout(() => (onRemove(item), setLeaving(null)), FADE_MS);
  };
  return (
    <ul ref={ref} aria-label={label} className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        // nowrap: auto-animate lifts a removed tag out of the flow to fade
        // it, and a shrink-to-fit tag would wrap its text out of the pill.
        <li
          key={item}
          className={`inline-flex h-8 items-center gap-0.5 rounded-button bg-zebra-100 pr-1 pl-3 whitespace-nowrap type-label text-zebra-800 transition-opacity duration-120 motion-reduce:transition-none ${
            item === leaving ? 'pointer-events-none opacity-0' : ''
          }`}
        >
          {item}
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => remove(item)}
            className="flex size-6 items-center justify-center rounded-check text-zebra-500 transition-colors duration-150 hover:bg-zebra-200 hover:text-zebra-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none"
          >
            <X aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          </button>
        </li>
      ))}
      {/* Keyed so auto-animate treats it as one steady item, not a new one each render. */}
      {after ? <li key="__after">{after}</li> : null}
    </ul>
  );
}

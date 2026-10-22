'use client';

import { StarIcon } from '@/components/ui-v2/icons';
import { themeRoleCss } from '@/features/proposals';

import type { SectionBodyProps } from '../../registry/spec';

import type { ReviewsData } from './data';

/**
 * Reviews as the client sees them: each quote under its stars, in the
 * page's own type, with who said it. Cards sit side by side on a wide
 * page and stack on a phone; "list" stacks them always.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/sections/reviews/view
 */

/** `n` stars of five, the filled ones in the brand colour. */
function Stars({ n, colour }: { n: number; colour: string }) {
  return (
    <span role="img" aria-label={`${n} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        // The brand colour is the MC's, known only at runtime.
        <StarIcon key={i} aria-hidden="true" className="size-4" style={{ color: colour, fill: i <= n ? colour : 'transparent', opacity: i <= n ? 1 : 0.35 }} />
      ))}
    </span>
  );
}

/** The reviews body. */
export function ReviewsView({ section, theme, branding }: SectionBodyProps) {
  const data = section.data?.kind === 'reviews' ? (section.data.reviews as ReviewsData) : null;
  if (!data || data.items.length === 0) return null;
  const cards = data.layout === 'cards';
  return (
    <div className={cards ? 'grid gap-6 @3xl/doc:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]' : 'space-y-8'}>
      {data.items.map((item) => (
        <figure key={item.id} className="space-y-3">
          <Stars n={item.stars} colour={branding.brand_color} />
          <blockquote style={themeRoleCss(theme, 'paragraph', { inheritColor: true })}>{item.quote ? `“${item.quote}”` : null}</blockquote>
          <figcaption style={themeRoleCss(theme, 'paragraph', { inheritColor: true })} className="opacity-70">
            {item.name}
            {item.detail ? `, ${item.detail}` : ''}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

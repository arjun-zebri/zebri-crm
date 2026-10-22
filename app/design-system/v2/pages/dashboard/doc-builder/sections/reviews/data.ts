import { newSectionId, plainText } from '@/features/proposals';
import type { RichDoc, TestimonialsData } from '@/features/proposals';

import type { DocSection, EngineDataMap, ReviewItem } from '../../model/types';

/**
 * Reviews: what past clients said, with their stars. Production's "kind
 * words" (testimonials) had no stars, so this is the engine's own kind;
 * a page saved with kind words reads them in as five-star reviews.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/sections/reviews/data
 */

export type ReviewsData = EngineDataMap['reviews'];

/** A review with nothing in it yet, five stars. */
export const blankReview = (): ReviewItem => ({ id: newSectionId(), quote: '', name: '', stars: 5 });

/** A reviews section holding `items`, with an optional heading above them. */
export function reviewsSection(items: Omit<ReviewItem, 'id'>[], intro?: RichDoc): DocSection {
  return {
    id: newSectionId(),
    kind: 'reviews',
    name: 'Reviews',
    style: { height: 'fit' },
    ...(intro ? { intro } : {}),
    data: { kind: 'reviews', reviews: { layout: 'cards', items: items.map((i) => ({ ...i, id: newSectionId() })) } },
  };
}

/** Production kind words as reviews, five stars each. */
export function fromTestimonials(t: TestimonialsData): ReviewsData {
  return {
    layout: t.layout === 'carousel' ? 'list' : 'cards',
    items: t.items.map((i) => ({ id: i.id, quote: plainText(i.quote), name: plainText(i.names), detail: i.detail ? plainText(i.detail) : undefined, stars: 5 })),
  };
}

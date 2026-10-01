/**
 * What an AI insights dialog shows for one insight, and the colour of its
 * tag, dot and reasons: red for money that is late, amber for something
 * waiting, green for the business as a whole. Amber text uses
 * `warning-ink`, since plain amber fails contrast on white. Shared by the
 * Payments and Proposals Overviews, whose advice both take this shape.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/insights/tone
 */

/** One insight as the dialog lays it out. */
export interface InsightCard {
  id: string;
  /** Colours the dot: red for money late, amber for waiting, green for how the business runs. */
  tone: 'danger' | 'warning' | 'brand';
  tag: string;
  /** The list's figure: "$2,100", "5 days". */
  metric: string;
  title: string;
  /** What Zebri found, with the numbers. */
  why: string;
  /** What is behind it, each with the reason on the right. */
  rows: { name: string; detail: string }[];
  /** The one move to make. */
  move: string;
  /** The button's words, and what it says once done. */
  label: string;
  doneLabel: string;
}

export const TONE: Record<InsightCard['tone'], { text: string; dot: string }> = {
  danger: { text: 'text-danger', dot: 'bg-danger' },
  warning: { text: 'text-warning-ink', dot: 'bg-warning' },
  brand: { text: 'text-grass-800', dot: 'bg-grass-700' },
};

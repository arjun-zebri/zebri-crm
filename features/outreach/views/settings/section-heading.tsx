'use client';

/**
 * Quiet heading for a Settings section: a semibold body-size title with
 * one muted line under it. Settings is a form, so the headings should
 * read as labels for the fields, not as page-level titles.
 *
 * @module features/outreach/views/settings/section-heading
 */

/** Props for {@link SectionHeading}. */
export interface SectionHeadingProps {
  /** Section title, e.g. "Sending". Rendered as an h2 for screen-reader navigation. */
  title: string;
  /** One line on what the section controls. */
  description: string;
}

/** The title and description block that opens each Settings section. */
export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-body font-semibold text-text">{title}</h2>
      <p className="text-body text-text-muted">{description}</p>
    </div>
  );
}

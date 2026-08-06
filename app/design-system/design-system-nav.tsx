/**
 * Sticky left-rail navigation for the showroom.
 *
 * Plain anchors rather than a scroll-spy: the page is long, and a
 * highlight that tracks the viewport would need client state for no real
 * benefit on an internal reference page.
 *
 * @module app/design-system/design-system-nav
 */

/** Section anchors, in page order. */
export const NAV_ITEMS = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'layout', label: 'Layout' },
  { id: 'forms', label: 'Form controls' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'editors', label: 'Editors and pickers' },
  { id: 'patterns', label: 'Page patterns' },
  { id: 'composites', label: 'Feature composites' },
  { id: 'audit', label: 'Audit summary' },
];

/** The left rail. Hidden below `lg`, where the page reads as one column. */
export function DesignSystemNav() {
  return (
    <nav
      aria-label="Design system sections"
      className="hidden lg:block lg:w-52 lg:shrink-0"
    >
      <div className="sticky top-8 space-y-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-emphasis hover:text-text"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

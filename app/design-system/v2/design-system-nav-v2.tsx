/**
 * Sticky left rail for the v2 design system.
 *
 * Grouped rather than flat like v1: each top-level section lists its
 * entries beneath it, so the rail stays scannable as v2 grows.
 *
 * @module app/design-system/v2/design-system-nav-v2
 */

/** Sections and their entries, in page order. `id`s are anchor targets. */
export const NAV_GROUPS_V2 = [
  {
    id: 'foundations',
    label: 'Foundations',
    items: [
      { id: 'colour', label: 'Colour' },
      { id: 'typography', label: 'Typography' },
      { id: 'surface', label: 'Background & panels' },
    ],
  },
  {
    id: 'components',
    label: 'Components',
    items: [
      { id: 'buttons', label: 'Buttons & links' },
      { id: 'inputs', label: 'Inputs' },
      { id: 'selection', label: 'Selection' },
      { id: 'dates', label: 'Dates' },
      { id: 'display', label: 'Display' },
      { id: 'data', label: 'Lists & figures' },
      { id: 'overlays', label: 'Overlays' },
      { id: 'motion', label: 'Motion' },
      { id: 'moments', label: 'Moments' },
      { id: 'patterns', label: 'Page patterns' },
      { id: 'documents', label: 'Documents' },
    ],
  },
  {
    id: 'pages',
    label: 'Pages',
    items: [
      { id: 'login', label: 'Log in' },
      { id: 'signup', label: 'Sign up' },
      { id: 'onboarding', label: 'Onboarding' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'proposals', label: 'Proposals' },
      { id: 'payments', label: 'Payments' },
    ],
  },
];

/** The left rail. Hidden below `lg`, where the page reads as one column. */
export function DesignSystemNavV2() {
  return (
    <nav aria-label="Design system sections" className="hidden lg:block lg:w-52 lg:shrink-0">
      <div className="sticky top-8 space-y-4">
        {NAV_GROUPS_V2.map((group) => (
          <div key={group.id} className="space-y-1">
            <a
              href={`#${group.id}`}
              className="block rounded-button px-2 py-1.5 type-label text-zebra-950 transition-colors hover:bg-zebra-950/5"
            >
              {group.label}
            </a>
            {group.items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-button py-1.5 pl-5 pr-2 type-body text-zebra-500 transition-colors hover:bg-zebra-950/5 hover:text-zebra-950"
              >
                {item.label}
              </a>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

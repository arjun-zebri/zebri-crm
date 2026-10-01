import { SidebarRow } from '../../sidebar-row';

import { SECTIONS, type Section } from './sections';

/**
 * The profile's left sidebar: the three sections as text links on a
 * light grey rail, set off from the white main area by a hairline. The
 * rows are the dashboard sidebar's own. Hidden below `md`, where
 * {@link ProfileTabs} runs the same links in a line under the header.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-sidebar
 */

export interface ProfileSidebarProps {
  section: Section;
  onSection: (s: Section) => void;
  /** How many need looking at in each section, shown beside its link. */
  counts: Partial<Record<Section, number>>;
}

/** The profile sidebar. See {@link ProfileSidebarProps}. */
export function ProfileSidebar({ section, onSection, counts }: ProfileSidebarProps) {
  return (
    <aside className="hidden w-52 shrink-0 border-r border-zebra-200 bg-zebra-50 p-4 md:block">
      <nav aria-label="Profile sections" className="space-y-1">
        {SECTIONS.map(({ value, label }) => (
          <SidebarRow
            key={value}
            label={label}
            collapsed={false}
            current={value === section}
            count={counts[value]}
            onNavigate={() => onSection(value)}
          />
        ))}
      </nav>
    </aside>
  );
}

/** Phones: the sidebar's links, in a line under the header. */
export function ProfileTabs({ section, onSection, counts }: ProfileSidebarProps) {
  return (
    <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto px-2 pt-3 md:hidden">
      {SECTIONS.map(({ value, label }) => (
        <div key={value} className="shrink-0">
          <SidebarRow
            label={label}
            collapsed={false}
            current={value === section}
            count={counts[value]}
            onNavigate={() => onSection(value)}
          />
        </div>
      ))}
    </nav>
  );
}

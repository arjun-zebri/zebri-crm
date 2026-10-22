import { SidebarRow } from '../../sidebar-row';

import { SECTIONS, type Section } from './sections';

/**
 * The profile's left sidebar: a white column of the sections, each an
 * icon and its name in the dashboard sidebar's own rows, set off from
 * the main area by a hairline; the current one sits on a grey fill and
 * each shows how many it holds (2026-10-09 founder:
 * the mockup's icons, expanded with their names). Hidden below `md`,
 * where {@link ProfileTabs} runs the sections in a line under the header.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/profile-sidebar
 */

export interface ProfileSidebarProps {
  section: Section;
  onSection: (s: Section) => void;
  /** How many each section holds, shown beside its link. */
  counts: Partial<Record<Section, number>>;
}

/** The profile sidebar. See {@link ProfileSidebarProps}. */
export function ProfileSidebar({ section, onSection, counts }: ProfileSidebarProps) {
  return (
    // Settings' rail exactly (the gold standard, user 2026-10-15): 14rem
    // wide, 12px in, rows 2px apart.
    <aside className="hidden w-56 shrink-0 border-r border-hairline bg-field p-3 md:block">
      <nav aria-label="Profile sections" className="space-y-0.5">
        {SECTIONS.map(({ value, label, icon }) => (
          <SidebarRow
            key={value}
            label={label}
            icon={icon}
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

'use client';

import type { LayoutAction, Section, SectionData, SectionStyle } from '@/features/proposals';

import type { DocEditor } from '../../state/use-doc-editor';

/**
 * The one place the section bar turns a change into production's
 * actions, so every control on it reads and writes a section the same
 * way production's Style popover does.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/settings/row
 */

/** Props every settings group takes. */
export interface SettingsProps {
  builder: DocEditor;
  section: Section;
}

/** Writes to `section`: its style, its data, and the two switches on it. */
export function useSectionEdit(builder: DocEditor, section: Section) {
  // Production's own actions, which the engine's dispatch accepts as they are.
  const dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void = builder.dispatch;
  const style = (patch: Partial<SectionStyle>, opts?: { commit?: boolean }) => dispatch({ type: 'updateStyle', id: section.id, patch }, opts);
  return {
    style,
    /** A discrete pick (a pill, a toggle): committed at once. */
    pick: (patch: Partial<SectionStyle>) => style(patch, { commit: true }),
    data: (data: SectionData) => dispatch({ type: 'setData', id: section.id, data }, { commit: true }),
    hideOnPhones: () => dispatch({ type: 'toggleHideOnMobile', id: section.id }, { commit: true }),
    backToBrand: () => dispatch({ type: 'resetStyle', id: section.id }, { commit: true }),
  };
}

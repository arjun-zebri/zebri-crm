'use client';

import { SectionView } from '@/features/proposals';
import type { SectionViewProps } from '@/features/proposals';

import { isProdSection } from '../model/as-production';
import type { DocSection } from '../model/types';

import { EngineSection } from './engine-section';

/**
 * Draws any section of a document, read-only: production's own kinds
 * through production's renderer, the engine's kinds through
 * `EngineSection`. Every preview, the client's page and every thumbnail
 * draw through this, so an engine kind never reaches production's
 * renderer (which would throw on a kind it does not know).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/render/doc-section-view
 */

export type DocSectionViewProps = Omit<SectionViewProps, 'section'> & { section: DocSection };

/** One section. See {@link DocSectionViewProps}. */
export function DocSectionView(props: DocSectionViewProps) {
  const { section } = props;
  if (isProdSection(section)) return <SectionView {...props} section={section} />;
  return <EngineSection section={section} index={props.index} theme={props.theme} branding={props.branding} mode={props.mode} values={props.values} />;
}

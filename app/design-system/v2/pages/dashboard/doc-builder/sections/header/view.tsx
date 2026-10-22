'use client';

import type { CSSProperties } from 'react';

import { RichDocView, themeRoleCss, type RichDoc } from '@/features/proposals';

import type { SectionBodyProps } from '../../registry/spec';

import { headerFlow, headerOf } from './data';

/**
 * The header as the client sees it: the logo at its height, then the
 * MC's words under it or beside it (`headerFlow`). With no
 * logo yet the business name stands in, in the heading face, so a page
 * never opens on a gap. {@link LogoMark} is shared with the editor's
 * form (`editor/header-edit.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/sections/header/view
 */

/** The logo at `height`, or the business name in the heading face. */
export function LogoMark({ src, name, height, nameStyle }: { src: string | null; name: string; height: number; nameStyle: CSSProperties }) {
  return src ? (
    // The MC's own upload (a data URL in the preview), so not next/image. Its height is theirs: a runtime value.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} draggable={false} style={{ height }} className="block w-auto max-w-full object-contain" />
  ) : (
    <span style={nameStyle}>{name}</span>
  );
}

/** Whether a rich doc holds any words. */
export const hasWords = (doc: RichDoc | undefined) => Boolean(doc?.content?.some((n) => (n.content?.length ?? 0) > 0));

/** The header body. */
export function HeaderView({ section, theme, branding, mode, values = {} }: SectionBodyProps) {
  const data = headerOf(section);
  const align = section.style.align ?? 'center';
  const flow = headerFlow(data, align);
  const ctx = { branding, theme, mode, values, textColor: section.style.textColor, align: flow.align };
  return (
    <div className={flow.box}>
      <LogoMark src={branding.logo_url} name={branding.business_name ?? ''} height={data.height} nameStyle={themeRoleCss(theme, 'heading3', { inheritColor: true })} />
      {hasWords(data.text) ? (
        <div className={flow.words}>
          <RichDocView doc={data.text!} ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}

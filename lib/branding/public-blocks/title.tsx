'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TitleBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { fmtDate, pad, type PublicDocData } from './shared'
import { VarChip } from './var-chip'

export interface TitleSlots {
  /** Editor replaces static title with live InlineText. */
  title?: ReactNode
}

export function RenderTitle({
  block,
  branding,
  doc,
  slots,
  variablePreview = false,
  chrome,
}: {
  block: TitleBlock
  branding: PublicBranding
  doc: PublicDocData
  slots?: TitleSlots
  /**
   * Editor-only: render the auto-filled meta + couple-name as mint `{{ … }}`
   * chips so they read as variables, not editable placeholders. The sent
   * document (variablePreview false) resolves them to real values.
   */
  variablePreview?: boolean
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const titleDefaults = roleDefaults(branding, 'docTitle')
  const subtitleDefaults = roleDefaults(branding, 'subtitle')
  const titleCss = resolveTextStyle(block.titleStyle, titleDefaults)
  const subtitleCss = resolveTextStyle(block.subtitleStyle, subtitleDefaults)
  // The meta row follows its own alignment override when set, else the title's.
  const metaAlign = block.metaStyle?.align ?? block.titleStyle?.align ?? 'left'
  const subtitleAlign = block.subtitleStyle?.align ?? 'left'

  return (
    <div className={p.blockY}>
      <div className={p.docX}>
        {/* No leading or tracking classes: resolveTextStyle always emits both
            inline from the global settings, so utilities here would be dead
            CSS that reads as if it were in charge. */}
        <h1 style={titleCss}>
          {slots?.title ?? caseText(doc.title, block.titleStyle, titleDefaults)}
        </h1>
        {/* Subtitle is the couple's real name (a variable): a chip in the editor,
            the resolved name on the sent document. Tagged so clicking it in the
            editor targets the couple-name line for styling. */}
        {block.showCoupleName && (variablePreview || doc.coupleName) ? (
          // Wrapper aligns; inner <p> hugs its content so the click-to-style
          // outline wraps just the couple name, not the full width.
          <div
            className="mt-2 flex"
            style={{ justifyContent: subtitleAlign === 'center' ? 'center' : subtitleAlign === 'right' ? 'flex-end' : 'flex-start' }}
          >
            <p data-subtarget="subtitle" style={subtitleCss}>
              {variablePreview ? (
                <VarChip label="Couple name" hint="Filled with the couple's name when the document is sent." />
              ) : (
                caseText(doc.coupleName ?? '', block.subtitleStyle, subtitleDefaults)
              )}
            </p>
          </div>
        ) : null}
      </div>
      {(block.showRef || block.showExpires || block.showAbn) && (
        // Outer row is full-width and only handles alignment; the inner element
        // carries the data-subtarget tag and hugs its content, so the editor's
        // click-to-style outline wraps just the ref/date/ABN, not the whole width.
        <div
          className={`${p.docX} mt-3 flex`}
          style={{ justifyContent: metaAlign === 'center' ? 'center' : metaAlign === 'right' ? 'flex-end' : 'flex-start' }}
        >
        <div data-subtarget="meta" className="flex flex-wrap items-baseline gap-x-4 @sm/doc:gap-x-8 gap-y-2">
          {/* Ref and Due are per-document values (unknown until send), so they
              show as variable chips in the editor and resolve on the document. */}
          {block.showRef && (variablePreview || doc.refNumber) && (
            <Meta
              label="Ref"
              value={variablePreview ? <VarChip label="Ref" hint="The document's reference number, assigned when it's sent." /> : doc.refNumber}
              branding={branding}
              style={block.metaStyle}
            />
          )}
          {block.showExpires && (variablePreview || doc.expiresAt) && (
            <Meta
              label={doc.expiresLabel ?? 'Expires'}
              value={variablePreview
                ? <VarChip label={doc.expiresLabel ?? 'Expires'} hint={doc.expiresLabel === 'Due' ? "The invoice's due date." : "The document's expiry date."} />
                : fmtDate(doc.expiresAt!)}
              branding={branding}
              style={block.metaStyle}
            />
          )}
          {/* ABN is branding-kit data: show the real value when set (live-updating
              as the MC edits it), or a mint chip in the editor when it's blank so
              they know to fill it. On the sent document a blank ABN just doesn't
              render (so we never show an empty "ABN" label to the couple). */}
          {block.showAbn && (variablePreview || branding.abn) && (
            <Meta
              label="ABN"
              value={branding.abn ? branding.abn : <VarChip label="ABN" hint="Your ABN, from Settings → Branding." />}
              branding={branding}
              style={block.metaStyle}
            />
          )}
        </div>
        </div>
      )}
      {chrome}
    </div>
  )
}


function Meta({ label, value, branding, style }: { label: string; value: ReactNode; branding: PublicBranding; style?: TitleBlock['metaStyle'] }) {
  const labelDefaults = roleDefaults(branding, 'sectionLabel')
  const valueDefaults = roleDefaults(branding, 'body')
  // The per-block meta style (when set) overrides each role default, so a single
  // control restyles the whole row while label/value keep their distinct baseline.
  const labelCss = resolveTextStyle(style ?? {}, labelDefaults)
  const valueCss = resolveTextStyle(style ?? {}, valueDefaults)

  return (
    <div className="flex items-baseline gap-2">
      <span style={labelCss}>{caseText(label, {}, labelDefaults)}</span>
      <span style={valueCss}>{typeof value === 'string' ? caseText(value, {}, valueDefaults) : value}</span>
    </div>
  )
}

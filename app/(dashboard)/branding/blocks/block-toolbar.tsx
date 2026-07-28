'use client'

import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, Check, Copy, Trash2, Square, RotateCcw, Minus, AlignLeft, AlignCenter, AlignRight, Equal, Lock, Facebook, Instagram, Twitter, Pin } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'
import { getTextColor } from '@/lib/branding/contrast'
import { COLOR_PALETTE } from '@/lib/branding/themes'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { Slider } from '../components/slider'
import { publicBrandingFromEditorState } from '../editor-branding'

import { isDataBound, isDeletable, isRequired } from './policy'
import type { TextStyleDefaults } from './text-style'
import { TextStyleControls } from './text-style-controls'
import type {
  Block,
  TextStyle,
  TitleBlock,
  TextBlock,
  ActionBlock,
  BusinessNameBlock,
  TaglineBlock,
  TotalsBlock,
  PaymentDetailsBlock,
  LineItemsBlock,
  DividerBlock,
  HeaderBannerBlock,
  FooterBlock,
  ImageBlock,
  SpacerBlock,
  PaymentScheduleBlock,
  PackageHeaderBlock,
  PackageDetailsBlock,
  PackageInclusionsBlock,
  PackageTotalsBlock,
} from './types'

interface BlockToolbarProps {
  block: Block
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  /** Sub-element the user clicked in the preview; drives which part the style controls target. */
  activeSubTarget: string | null
  onDuplicate: () => void
  onDelete: () => void
  onResetBlock: () => void
}

export function BlockToolbar({ block, state, surface, updateBlock, activeSubTarget, onDuplicate, onDelete, onResetBlock }: BlockToolbarProps) {
  const canDelete = isDeletable(block, surface)
  const hasLiveData = isDataBound(block.type)
  const isBlockRequired = isRequired(block.type, surface)

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)] animate-modal-in"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Row 0: block-type label + lock/live-data chips */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span className="text-xs font-medium text-gray-600 capitalize">{block.type}</span>
        <div className="flex items-center gap-1 ml-auto">
          {isBlockRequired && (
            <Tooltip label="Required to send. You can remove it, but the document will show as not ready until you add it back.">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">
                <Lock size={10} strokeWidth={1.5} />
                Required
              </span>
            </Tooltip>
          )}
          {hasLiveData && (
            <span className="text-[10px] font-medium text-text-muted bg-surface-muted px-1.5 py-0.5 rounded-full">
              Live data
            </span>
          )}
        </div>
      </div>

      {/* Row 1: block-type-specific controls + background, so the background
          colour sits beside the block's text/colour controls rather than down
          in the structural row. */}
      <div className="flex items-center gap-1 px-1 pt-1">
        <BlockSpecificControls block={block} state={state} surface={surface} updateBlock={updateBlock} activeSubTarget={activeSubTarget} />
        {/* Text-content blocks render Background inside their controls, right
            next to the text colour (via bgSlot); the divider renders it beside
            its line colour. The rest show it here. */}
        {block.type !== 'action' &&
          !['title', 'text', 'businessName', 'tagline', 'footer', 'divider'].includes(block.type) && (
            <BackgroundControl block={block} updateBlock={updateBlock} />
          )}
      </div>

      {/* Row 2: structural controls + actions */}
      <div className="flex items-center gap-1 px-1 pb-1 pt-0.5 border-t border-gray-100 mt-1">
        {block.type !== 'headerBanner' && block.type !== 'action' && (
          <>
            <VAlignControl block={block} updateBlock={updateBlock} />
            <Divider />
          </>
        )}
        {block.type !== 'action' && (
          <>
            <SpacingControl block={block} updateBlock={updateBlock} />
            <RadiusControl block={block} updateBlock={updateBlock} />
            <Divider />
            <BorderControl block={block} updateBlock={updateBlock} />
          </>
        )}
        {/* Action is a CTA button with its own styling, so it only takes the
            block-level radius control (no spacing/border chrome). */}
        {block.type === 'action' && (
          <RadiusControl block={block} updateBlock={updateBlock} />
        )}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <Tooltip label="Reset to theme defaults">
            <button
              type="button"
              onClick={onResetBlock}
              aria-label="Reset block to theme defaults"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Tooltip label="Duplicate">
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicate block"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
            >
              <Copy size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <Divider />
          <Tooltip label={canDelete ? 'Delete' : 'This block is required on this document'}>
            <button
              type="button"
              onClick={onDelete}
              disabled={!canDelete}
              aria-label={canDelete ? 'Delete block' : 'This block cannot be deleted'}
              className={`p-1.5 rounded-md transition ${
                canDelete
                  ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                  : 'text-gray-500 opacity-40 cursor-not-allowed'
              }`}
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

interface ControlsProps {
  block: Block
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}

function BlockSpecificControls({ block, state, surface, updateBlock, activeSubTarget, expanded }: ControlsProps) {
  switch (block.type) {
    case 'title':
      return <TitleControls block={block} state={state} surface={surface} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'text':
      return <TextControls block={block} state={state} updateBlock={updateBlock} {...(expanded !== undefined ? { expanded } : {})} />
    case 'action':
      return <ActionControls block={block} state={state} surface={surface} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'headerBanner':
      return <HeaderBannerControls block={block} updateBlock={updateBlock} />
    case 'businessName':
      return <BusinessNameControls block={block} state={state} updateBlock={updateBlock} {...(expanded !== undefined ? { expanded } : {})} />
    case 'tagline':
      return <TaglineControls block={block} state={state} updateBlock={updateBlock} {...(expanded !== undefined ? { expanded } : {})} />
    case 'totals':
      return <TotalsControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'paymentDetails':
      return <PaymentDetailsControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'lineItems':
      return <LineItemsControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'packageLineItems':
      return <LineItemsControls block={block as unknown as LineItemsBlock} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'packageHeader':
      return <PackageHeaderControls block={block} state={state} updateBlock={updateBlock} {...(expanded !== undefined ? { expanded } : {})} />
    case 'packageDetails':
      return <PackageDetailsControls block={block} state={state} updateBlock={updateBlock} {...(expanded !== undefined ? { expanded } : {})} />
    case 'packageInclusions':
      return <PackageInclusionsControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'packageTotals':
      return <PackageTotalsControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'divider':
      return <DividerControls block={block} updateBlock={updateBlock} />
    case 'footer':
      return <FooterControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'image':
      return <ImageControls block={block} updateBlock={updateBlock} />
    case 'spacer':
      return <SpacerControls block={block} updateBlock={updateBlock} />
    case 'couplePortal':
      return null
    case 'paymentSchedule':
      return <PaymentScheduleControls block={block} state={state} updateBlock={updateBlock} activeSubTarget={activeSubTarget} {...(expanded !== undefined ? { expanded } : {})} />
    case 'contractBody':
      return null
    case 'vendorTimelineBody':
      return null
    case 'questionnaireBody':
      return null
  }
}

// ── Title ─────────────────────────────────────────────────────────────────────

function TitleControls({
  block,
  state,
  surface,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: TitleBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Which element the style controls target comes from what the user clicked in
  // the preview (a `data-subtarget`-tagged element), defaulting to the title.
  // The ActiveTargetLabel names it; there is no toolbar switcher. "Couple name"
  // is the subtitle line; "Meta" is the reference / date / ABN row. Visibility of
  // each still lives in the Include dropdown.
  const target: 'title' | 'subtitle' | 'meta' =
    activeSubTarget === 'subtitle' ? 'subtitle' : activeSubTarget === 'meta' ? 'meta' : 'title'
  const style = target === 'title' ? block.titleStyle : target === 'subtitle' ? block.subtitleStyle : block.metaStyle
  const defaults: TextStyleDefaults =
    target === 'title'
      ? {
          fontFamily: state.fontHeading,
          fontSize: 36,
          fontWeight: state.fontWeight,
          color: '#111827',
          align: 'left',
          lineHeight: 1.1,
          letterSpacing: -0.01,
        }
      : target === 'subtitle'
        ? {
            fontFamily: state.fontBody,
            fontSize: 14,
            fontWeight: 400,
            color: '#6B7280',
            align: 'left',
            lineHeight: 1.5,
            letterSpacing: 0,
          }
        : {
            fontFamily: state.fontBody,
            fontSize: 13,
            fontWeight: 400,
            color: state.textColor || '#6B7280',
            align: 'left',
            lineHeight: 1.5,
            letterSpacing: 0,
          }
  const onStyleChange = (patch: TextStyle) => {
    const merged = { ...(style ?? {}), ...patch }
    updateBlock<TitleBlock>(
      block.id,
      target === 'title' ? { titleStyle: merged } : target === 'subtitle' ? { subtitleStyle: merged } : { metaStyle: merged },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActiveTargetLabel label={target === 'title' ? 'Title' : target === 'subtitle' ? 'Couple name' : 'Meta'} />
      <Divider />
      <TextStyleControls style={style} defaults={defaults} onChange={onStyleChange} {...(expanded !== undefined ? { expanded } : {})} bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />} />
      <Divider />
      <TitleIncludeDropdown block={block} surface={surface} updateBlock={updateBlock} />
    </div>
  )
}

/**
 * Single multi-select dropdown for everything the title block can show: the
 * couple-name line plus the meta rows (reference, date, ABN). Mirrors the
 * footer's Include dropdown so visibility lives in one place and the toolbar
 * stays narrow. Reference is omitted on the invoice surface, where an
 * identifying number is mandatory and forced on at render.
 */
function TitleIncludeDropdown({
  block,
  surface,
  updateBlock,
}: {
  block: TitleBlock
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const isInvoice = surface === 'invoice'
  const rows: { label: string; active: boolean; set: (v: boolean) => void }[] = [
    { label: 'Couple name', active: block.showCoupleName ?? false, set: (v) => updateBlock<TitleBlock>(block.id, { showCoupleName: v }) },
    ...(isInvoice
      ? []
      : [{ label: 'Reference', active: block.showRef, set: (v: boolean) => updateBlock<TitleBlock>(block.id, { showRef: v }) }]),
    { label: isInvoice ? 'Due date' : 'Expiry date', active: block.showExpires, set: (v: boolean) => updateBlock<TitleBlock>(block.id, { showExpires: v }) },
    { label: 'ABN', active: block.showAbn, set: (v: boolean) => updateBlock<TitleBlock>(block.id, { showAbn: v }) },
  ]
  return (
    <Popover.Root>
      <Tooltip label="Show or hide title items">
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200 text-gray-700 shrink-0"
          >
            <span className="text-gray-900 font-medium">Include</span>
            <ChevronDown size={10} strokeWidth={2} className="text-gray-400" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-[60] w-[200px] animate-modal-in"
        >
          {rows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => row.set(!row.active)}
              aria-pressed={row.active}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                  row.active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-transparent'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <span>{row.label}</span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Text ──────────────────────────────────────────────────────────────────────

function TextControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: TextBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
    align: 'left',
  }

  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.textStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TextBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
        bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
      />
    </div>
  )
}

// ── Action ────────────────────────────────────────────────────────────────────

type ActionTarget = 'block' | 'primary' | 'secondary' | 'note'

function ActionControls({
  block,
  state,
  surface,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: ActionBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Target from the preview click: the primary/secondary buttons are clickable,
  // and clicking elsewhere in the block falls back to 'block' (variant / size /
  // radius). A stale 'secondary' after the secondary button is removed also
  // falls back to 'block'.
  const target: ActionTarget =
    activeSubTarget === 'primary'
      ? 'primary'
      : activeSubTarget === 'secondary' && block.secondary !== null
        ? 'secondary'
        : activeSubTarget === 'note'
          ? 'note'
          : 'block'

  if (target === 'block') {
    return (
      <div className="flex items-center gap-2 w-full">
        <ActiveTargetLabel label="Block" />
        <Divider />
        <ActionBlockControls block={block} state={state} surface={surface} updateBlock={updateBlock} />
      </div>
    )
  }

  if (target === 'note') {
    const noteStyle = block.noteStyle
    const noteDefaults: TextStyleDefaults = {
      ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
      align: 'center',
    }
    return (
      <div className="flex items-center gap-2 w-full">
        <ActiveTargetLabel label="Note" />
        <Divider />
        <TextStyleControls
          style={noteStyle}
          defaults={noteDefaults}
          onChange={(patch) => updateBlock<ActionBlock>(block.id, { noteStyle: { ...(noteStyle ?? {}), ...patch } })}
          {...(expanded !== undefined ? { expanded } : {})}
        />
      </div>
    )
  }

  const isPrimary = target === 'primary'
  const style = isPrimary ? block.primaryStyle : block.secondaryStyle
  const buttonColor = block.buttonColor ?? state.brandColor
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
    fontWeight: 500,
    color: isPrimary ? getTextColor(buttonColor) : getTextColor(state.secondaryColor),
    align: 'center',
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <ActiveTargetLabel label={isPrimary ? 'Primary' : 'Secondary'} />
      <Divider />
      {isPrimary && (
        <>
          <ColorPopover
            value={buttonColor}
            onChange={(v) => updateBlock<ActionBlock>(block.id, { buttonColor: v })}
            swatches={COLOR_PALETTE}
            trigger={
              <button
                type="button"
                title="Button fill"
                className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
              >
                <span className="w-4 h-4 rounded ring-1 ring-black/10" style={{ background: buttonColor }} />
              </button>
            }
          />
          <Divider />
        </>
      )}
      {!isPrimary && (
        <>
          <ColorPopover
            value={block.secondaryColor ?? state.secondaryColor}
            onChange={(v) => updateBlock<ActionBlock>(block.id, { secondaryColor: v })}
            swatches={COLOR_PALETTE}
            trigger={
              <button
                type="button"
                title="Button fill"
                className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
              >
                <span className="w-4 h-4 rounded ring-1 ring-black/10" style={{ background: block.secondaryColor ?? state.secondaryColor }} />
              </button>
            }
          />
          <Divider />
        </>
      )}
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) => {
          const merged = { ...(style ?? {}), ...patch }
          updateBlock<ActionBlock>(block.id, isPrimary ? { primaryStyle: merged } : { secondaryStyle: merged })
        }}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

function ActionBlockControls({
  block,
  state,
  surface,
  updateBlock,
}: {
  block: ActionBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const radius = block.buttonRadius ?? state.cornerRadius
  const variant = block.variant ?? 'fill'
  const size = block.size ?? 'md'

  return (
    <>
      {/* Variant and Size */}
      <div className="inline-flex items-center gap-0.5">
        <div className="inline-flex items-center bg-gray-50 rounded-md border border-gray-200">
          {([
            { value: 'fill', label: 'Fill' },
            { value: 'outline', label: 'Outline' },
          ] as const).map(({ value, label }) => {
            const active = variant === value
            return (
              <Tooltip key={value} label={label}>
                <button
                  type="button"
                  onClick={() => updateBlock<ActionBlock>(block.id, { variant: value })}
                  aria-label={label}
                  className={`px-2.5 h-8 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm rounded-md m-0.5'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              </Tooltip>
            )
          })}
        </div>
        <div className="inline-flex items-center bg-gray-50 rounded-md border border-gray-200">
          {([
            { value: 'sm' as const, label: 'S' },
            { value: 'md' as const, label: 'M' },
            { value: 'lg' as const, label: 'L' },
          ] as const).map(({ value, label }) => {
            const active = size === value
            return (
              <Tooltip key={value} label={value === 'sm' ? 'Small' : value === 'md' ? 'Medium' : 'Large'}>
                <button
                  type="button"
                  onClick={() => updateBlock<ActionBlock>(block.id, { size: value })}
                  aria-label={label}
                  className={`w-7 h-8 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm rounded-md m-0.5'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              </Tooltip>
            )
          })}
        </div>
      </div>
      <Divider />
      {/* Justify */}
      <div className="inline-flex items-center bg-gray-50 rounded-md border border-gray-200">
        {([
          { value: 'start', Icon: AlignLeft, label: 'Align left' },
          { value: 'center', Icon: AlignCenter, label: 'Align center' },
          { value: 'end', Icon: AlignRight, label: 'Align right' },
        ] as const).map(({ value, Icon, label }) => {
          const active = (block.buttonJustify ?? 'center') === value
          return (
            <Tooltip key={value} label={label}>
              <button
                type="button"
                onClick={() => updateBlock<ActionBlock>(block.id, { buttonJustify: value })}
                aria-label={label}
                className={`p-1.5 transition cursor-pointer ${active ? 'bg-white text-gray-900 shadow-sm rounded-md m-0.5' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Icon size={12} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )
        })}
      </div>
      <Divider />
      <VAlignControl block={block} updateBlock={updateBlock} />
      <Divider />
      <BorderControl block={block} updateBlock={updateBlock} />
      <Divider />
      <Popover.Root>
        <Tooltip label="Button radius">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 text-gray-700"
            >
              <Square size={12} strokeWidth={1.75} />
              {radius !== state.cornerRadius && (
                <span className="font-mono text-[10px]">{radius}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px]"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Radius</span>
              <span className="text-xs font-mono text-gray-900">{radius}px</span>
            </div>
            <Slider
              value={radius}
              min={0}
              max={32}
              step={1}
              onChange={(v) => updateBlock<ActionBlock>(block.id, { buttonRadius: v })}
              ariaLabel="Button radius"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Divider />
      <Popover.Root>
        <Tooltip label="Primary button width">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Equal size={12} strokeWidth={1.75} />
              {block.primaryWidthPx !== undefined && (
                <span className="font-mono text-[10px]">{block.primaryWidthPx}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Primary width</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{block.primaryWidthPx ?? 'auto'}px</span>
            </div>
            <Slider
              value={block.primaryWidthPx ?? 0}
              min={0}
              max={400}
              step={10}
              onChange={(v) => updateBlock<ActionBlock>(block.id, { primaryWidthPx: v || undefined })}
              ariaLabel="Primary button width"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Invoices can only be paid, not declined, so they get no secondary
          button — hide the toggle + its width controls on the invoice surface. */}
      {surface !== 'invoice' && (
        <>
      <Divider />
      <Toggle
        label="Secondary"
        active={block.secondary !== null}
        onChange={(v) =>
          updateBlock<ActionBlock>(block.id, { secondary: v ? block.secondary ?? 'Decline' : null })
        }
      />
      {block.secondary !== null && (
        <>
          <Divider />
          <Popover.Root>
            <Tooltip label="Secondary button width">
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
                >
                  <Equal size={12} strokeWidth={1.75} />
                  {block.secondaryWidthPx !== undefined && (
                    <span className="font-mono text-[10px]">{block.secondaryWidthPx}px</span>
                  )}
                </button>
              </Popover.Trigger>
            </Tooltip>
            <Popover.Portal>
              <Popover.Content
                align="center"
                sideOffset={6}
                className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Secondary width</span>
                  <span className="text-xs font-mono text-gray-700 tabular-nums">{block.secondaryWidthPx ?? 'auto'}px</span>
                </div>
                <Slider
                  value={block.secondaryWidthPx ?? 0}
                  min={0}
                  max={400}
                  step={10}
                  onChange={(v) => updateBlock<ActionBlock>(block.id, { secondaryWidthPx: v || undefined })}
                  ariaLabel="Secondary button width"
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <Divider />
          <Tooltip label="Match secondary size to primary">
            <button
              type="button"
              onClick={() => updateBlock<ActionBlock>(block.id, {
                secondaryWidthPx: block.primaryWidthPx,
                secondaryPaddingY: block.primaryPaddingY,
              })}
              className="inline-flex items-center gap-1 px-2 h-8 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 text-gray-700 text-xs"
            >
              <Equal size={12} strokeWidth={1.75} />
              Match
            </button>
          </Tooltip>
        </>
      )}
        </>
      )}
    </>
  )
}

// ── Business name ─────────────────────────────────────────────────────────────

function BusinessNameControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: BusinessNameBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'sectionHeading'),
    align: 'left',
  }
  const layout = block.layout ?? 'row'
  const logoHeight = block.logoHeightPx ?? 40
  return (
    <div className="flex items-center gap-2">
      <PillToggle
        options={[
          { value: 'row', label: 'Row' },
          { value: 'stacked', label: 'Stacked' },
          { value: 'logo', label: 'Logo' },
          { value: 'name', label: 'Name' },
        ]}
        value={layout}
        onChange={(v) => updateBlock<BusinessNameBlock>(block.id, { layout: v as BusinessNameBlock['layout'] })}
      />
      <Divider />
      <Popover.Root>
        <Tooltip label="Logo size">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Square size={12} strokeWidth={1.75} />
              {logoHeight !== 40 && (
                <span className="font-mono text-[10px]">{logoHeight}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Logo Height</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{logoHeight}px</span>
            </div>
            <Slider
              value={logoHeight}
              min={24}
              max={160}
              step={4}
              onChange={(v) => updateBlock<BusinessNameBlock>(block.id, { logoHeightPx: v })}
              ariaLabel="Logo height"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {layout !== 'logo' && (
        <>
          <Divider />
          <TextStyleControls
            style={block.nameStyle}
            defaults={defaults}
            onChange={(patch) =>
              updateBlock<BusinessNameBlock>(block.id, { nameStyle: { ...(block.nameStyle ?? {}), ...patch } })
            }
            {...(expanded !== undefined ? { expanded } : {})}
            bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
          />
        </>
      )}
    </div>
  )
}

// ── Tagline ───────────────────────────────────────────────────────────────────

function TaglineControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: TaglineBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
    align: 'left',
  }
  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.textStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TaglineBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
        bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
      />
    </div>
  )
}

// ── Totals ────────────────────────────────────────────────────────────────────

type TotalsTarget = 'rows' | 'subtotal' | 'tax' | 'total'

function TotalsControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: TotalsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Clicking a specific row (subtotal / tax / total) targets its text style;
  // clicking elsewhere in the block falls back to 'rows' (the structural view:
  // layout, show toggles, tax %).
  const target: TotalsTarget =
    activeSubTarget === 'subtotal' || activeSubTarget === 'tax' || activeSubTarget === 'total'
      ? activeSubTarget
      : 'rows'

  const rowDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 13,
    fontWeight: 400,
    color: state.textColor || '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  const totalDefaults: TextStyleDefaults = {
    fontFamily: state.fontHeading,
    fontSize: 18,
    fontWeight: state.fontWeight,
    color: state.textColor || '#111827',
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
  }

  if (target === 'rows') {
    return (
      <div className="flex items-center gap-2">
        <ActiveTargetLabel label="Rows" />
        <Divider />
        <Tooltip label="Justify between columns">
          <button
            type="button"
            onClick={() => updateBlock<TotalsBlock>(block.id, { colSpread: !(block.colSpread ?? true) })}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md border cursor-pointer transition ${
              (block.colSpread ?? true)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
            }`}
          >
            <ColSpreadIcon />
          </button>
        </Tooltip>
        <Divider />
        <Toggle
          label="Subtotal"
          active={block.showSubtotal}
          onChange={(v) => updateBlock<TotalsBlock>(block.id, { showSubtotal: v })}
        />
        <Toggle
          label="Tax"
          active={block.showTax ?? true}
          onChange={(v) => updateBlock<TotalsBlock>(block.id, { showTax: v })}
        />
        <Divider />
        <NumberField
          label="Tax %"
          value={block.taxRate}
          min={0}
          max={50}
          step={0.5}
          onChange={(v) => updateBlock<TotalsBlock>(block.id, { taxRate: v })}
        />
      </div>
    )
  }

  const styleKey = target === 'subtotal' ? 'subtotalStyle' : target === 'tax' ? 'taxStyle' : 'totalStyle'
  const style = block[styleKey]
  const defaults = target === 'total' ? totalDefaults : rowDefaults

  return (
    <div className="flex items-center gap-2">
      <ActiveTargetLabel label={target === 'subtotal' ? 'Subtotal' : target === 'tax' ? 'Tax' : 'Total'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TotalsBlock>(block.id, { [styleKey]: { ...(style ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

// ── Payment Details ───────────────────────────────────────────────────────────

type PaymentDetailsTarget = 'heading' | 'label' | 'value' | 'note'

function PaymentDetailsControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: PaymentDetailsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Target from the preview click, defaulting to the heading.
  const target: PaymentDetailsTarget =
    activeSubTarget === 'label' ? 'label'
      : activeSubTarget === 'value' ? 'value'
        : activeSubTarget === 'note' ? 'note'
          : 'heading'

  const style =
    target === 'heading' ? block.headingStyle
      : target === 'label' ? block.labelStyle
        : target === 'value' ? block.valueStyle
          : block.noteStyle
  const defaults: TextStyleDefaults =
    target === 'heading'
      ? {
          fontFamily: state.fontHeading,
          fontSize: 16,
          fontWeight: state.fontWeight,
          color: state.textColor || '#111827',
          align: 'left',
          lineHeight: 1.3,
          letterSpacing: 0,
        }
      : target === 'label'
        ? {
            fontFamily: state.fontBody,
            fontSize: 12,
            fontWeight: 500,
            color: state.textColor || '#6B7280',
            align: 'left',
            lineHeight: 1.5,
            letterSpacing: 0,
          }
        : {
            fontFamily: state.fontBody,
            fontSize: 14,
            fontWeight: target === 'value' ? 500 : 400,
            color: state.textColor || '#111827',
            align: 'left',
            lineHeight: 1.5,
            letterSpacing: 0,
          }

  const styleKey =
    target === 'heading' ? 'headingStyle'
      : target === 'label' ? 'labelStyle'
        : target === 'value' ? 'valueStyle'
          : 'noteStyle'

  return (
    <div className="flex items-center gap-2">
      <ActiveTargetLabel label={target === 'heading' ? 'Heading' : target === 'label' ? 'Label' : target === 'value' ? 'Value' : 'Note'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<PaymentDetailsBlock>(block.id, { [styleKey]: { ...(style ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

// ── Line items ────────────────────────────────────────────────────────────────

type LineItemsTarget = 'rows' | 'header' | 'item'

function LineItemsControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: LineItemsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Clicking the header row or an item row targets its text style; clicking
  // elsewhere falls back to 'rows' (the structural view: row style, header
  // toggle, column layout).
  const target: LineItemsTarget =
    activeSubTarget === 'header' || activeSubTarget === 'item' ? activeSubTarget : 'rows'

  if (target === 'rows') {
    return (
      <div className="flex items-center gap-2">
        <ActiveTargetLabel label="Rows" />
        <Divider />
        <PillToggle
          options={[
            { value: 'lines', label: 'Lines' },
            { value: 'stripes', label: 'Stripes' },
            { value: 'plain', label: 'Plain' },
          ]}
          value={block.rowStyle ?? 'lines'}
          onChange={(v) => updateBlock<LineItemsBlock>(block.id, { rowStyle: v as 'lines' | 'stripes' | 'plain' })}
        />
        <Divider />
        <Toggle
          label="Header"
          active={block.showHeader ?? true}
          onChange={(v) => updateBlock<LineItemsBlock>(block.id, { showHeader: v })}
        />
        <Divider />
        <Tooltip label="Justify between columns">
          <button
            type="button"
            onClick={() => updateBlock<LineItemsBlock>(block.id, { colSpread: !(block.colSpread ?? false) })}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md border cursor-pointer transition ${
              block.colSpread
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
            }`}
          >
            <ColSpreadIcon />
          </button>
        </Tooltip>
      </div>
    )
  }

  const isHeader = target === 'header'
  const style = isHeader ? block.headerStyle : block.itemStyle
  const defaults: TextStyleDefaults = isHeader
    ? {
        fontFamily: state.fontBody,
        fontSize: 11,
        fontWeight: 500,
        color: '#9CA3AF',
        align: 'left',
        lineHeight: 1.4,
        letterSpacing: 0.06,
      }
    : {
        fontFamily: state.fontBody,
        fontSize: 14,
        fontWeight: 400,
        color: '#111827',
        align: 'left',
        lineHeight: 1.4,
        letterSpacing: 0,
      }

  return (
    <div className="flex items-center gap-2">
      <ActiveTargetLabel label={isHeader ? 'Header' : 'Items'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) => {
          const merged = { ...(style ?? {}), ...patch }
          updateBlock<LineItemsBlock>(
            block.id,
            isHeader ? { headerStyle: merged } : { itemStyle: merged },
          )
        }}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

// ── Header banner ─────────────────────────────────────────────────────────────

function HeaderBannerControls({
  block,
  updateBlock,
}: {
  block: HeaderBannerBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const scale = block.imageScale ?? 1
  const customised =
    (block.imageX !== undefined && block.imageX !== 50) ||
    (block.imageY !== undefined && block.imageY !== 50) ||
    block.heightPx !== undefined ||
    scale !== 1
  return (
    <div className="flex items-center gap-2">
      <PillToggle
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        value={block.fit ?? 'cover'}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { fit: v as 'cover' | 'contain' })}
      />
      <Divider />
      <div className="inline-flex items-center gap-2 h-8 px-2 rounded-md border border-gray-200 bg-white shrink-0">
        <span className="text-[11px] text-gray-500">Zoom</span>
        <div className="w-20">
          <Slider
            value={scale}
            min={1}
            max={4}
            step={0.1}
            onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { imageScale: parseFloat(v.toFixed(2)) })}
            ariaLabel="Image zoom"
          />
        </div>
        <span className="text-[11px] font-mono text-gray-700 tabular-nums w-9 text-right">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <Divider />
      <ColorPopover
        value={block.overlayColor ?? '#00000000'}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { overlayColor: v })}
        swatches={['#000000', '#FFFFFF', '#6B7280']}
        trigger={
          <button
            type="button"
            title="Overlay colour"
            className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
          >
            <span
              className="w-4 h-4 rounded ring-1 ring-black/10"
              style={{
                background: block.overlayColor ?? 'transparent',
                opacity: block.overlayOpacity ?? 0.5,
              }}
            />
          </button>
        }
      />
      <Divider />
      <Popover.Root>
        <Tooltip label="Overlay opacity">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Square size={12} strokeWidth={1.75} />
              {(block.overlayOpacity ?? 0.5) !== 0.5 && (
                <span className="font-mono text-[10px]">{Math.round((block.overlayOpacity ?? 0.5) * 100)}%</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Opacity</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{Math.round((block.overlayOpacity ?? 0.5) * 100)}%</span>
            </div>
            <Slider
              value={block.overlayOpacity ?? 0.5}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { overlayOpacity: parseFloat(v.toFixed(2)) })}
              ariaLabel="Overlay opacity"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Divider />
      <button
        type="button"
        onClick={() =>
          updateBlock<HeaderBannerBlock>(block.id, {
            imageX: 50,
            imageY: 50,
            heightPx: undefined,
            imageScale: 1,
            overlayColor: undefined,
            overlayOpacity: undefined,
          })
        }
        disabled={!customised && !block.overlayColor}
        className={`inline-flex items-center px-2 h-8 rounded-md text-xs border transition ${
          customised || block.overlayColor
            ? 'bg-white text-gray-700 border-gray-200 hover:text-gray-900 hover:bg-gray-50 cursor-pointer'
            : 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
        }`}
      >
        Reset
      </button>
      <span className="hidden lg:inline text-[11px] text-gray-400 pl-1">
        Drag to pan · +scroll to zoom · Drag edge to resize
      </span>
    </div>
  )
}

// ── Image ────────────────────────────────────────────────────────────────────

function ImageControls({
  block,
  updateBlock,
}: {
  block: ImageBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <PillToggle
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        value={block.fit ?? 'cover'}
        onChange={(v) =>
          updateBlock<ImageBlock>(block.id, { fit: v as 'cover' | 'contain' })
        }
      />
      <Divider />
      <Popover.Root>
        <Tooltip label="Height">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Equal size={12} strokeWidth={1.75} />
              {(block.heightPx ?? 160) !== 160 && (
                <span className="font-mono text-[10px]">{block.heightPx}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Height</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{block.heightPx ?? 160}px</span>
            </div>
            <Slider
              value={block.heightPx ?? 160}
              min={24}
              max={480}
              step={10}
              onChange={(v) => updateBlock<ImageBlock>(block.id, { heightPx: v })}
              ariaLabel="Image height"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

function DividerControls({
  block,
  updateBlock,
}: {
  block: DividerBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const widthPct = block.widthPct ?? 100
  return (
    <div className="flex items-center gap-2">
      <PillToggle
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
        ]}
        value={block.lineStyle ?? 'solid'}
        onChange={(v) =>
          updateBlock<DividerBlock>(block.id, { lineStyle: v as 'solid' | 'dashed' | 'dotted' })
        }
      />
      <Divider />
      <Popover.Root>
        <Tooltip label="Thickness">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Minus size={12} strokeWidth={1.75} />
              {(block.thickness ?? 1) > 1 && (
                <span className="font-mono text-[10px]">{block.thickness}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Thickness</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{block.thickness ?? 1}px</span>
            </div>
            <Slider
              value={block.thickness ?? 1}
              min={1}
              max={8}
              step={1}
              onChange={(v) => updateBlock<DividerBlock>(block.id, { thickness: v })}
              ariaLabel="Divider thickness"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Divider />
      <Tooltip label="Line colour">
        <ColorPopover
          value={block.color ?? '#E5E7EB'}
          onChange={(v) => updateBlock<DividerBlock>(block.id, { color: v })}
          swatches={['#E5E7EB', '#9CA3AF', '#374151', '#111827']}
          trigger={
            <button
              type="button"
              className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
            >
              <span
                className="w-4 h-4 rounded ring-1 ring-black/10"
                style={{ background: block.color ?? '#E5E7EB' }}
              />
            </button>
          }
        />
      </Tooltip>
      {/* Background colour sits right beside the line colour. */}
      <BackgroundControl block={block} updateBlock={updateBlock} />
      <Divider />
      <Popover.Root>
        <Tooltip label="Width">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Equal size={12} strokeWidth={1.75} />
              {widthPct !== 100 && (
                <span className="font-mono text-[10px]">{widthPct}%</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Width</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{widthPct}%</span>
            </div>
            <Slider
              value={widthPct}
              min={1}
              max={100}
              step={1}
              onChange={(v) => updateBlock<DividerBlock>(block.id, { widthPct: v })}
              ariaLabel="Divider width"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function FooterControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: FooterBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  // Clicking the social icon row targets it: swap the text-style controls for the
  // icon-row controls (spacing + optional background chip), keeping Include.
  if (activeSubTarget === 'social') {
    return <FooterSocialControls block={block} updateBlock={updateBlock} />
  }

  // Which text element the style controls target comes from the preview click
  // (note vs contact line), defaulting to the note. Visibility toggles stay in
  // the Include dropdown.
  const isNote = activeSubTarget !== 'contact'
  const style = isNote ? block.noteStyle : block.contactStyle
  const defaults: TextStyleDefaults = isNote
    ? {
        fontFamily: state.fontBody,
        fontSize: 12,
        fontWeight: state.fontBodyWeight ?? 400,
        color: state.textColor || '#6B7280',
        align: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
      }
    : {
        fontFamily: state.fontBody,
        fontSize: 11,
        fontWeight: 400,
        color: state.textColor || '#9CA3AF',
        align: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
      }
  const onStyleChange = (patch: TextStyle) => {
    const merged = { ...(style ?? {}), ...patch }
    updateBlock<FooterBlock>(block.id, isNote ? { noteStyle: merged } : { contactStyle: merged })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActiveTargetLabel label={isNote ? 'Note' : 'Contact'} />
      <Divider />
      <TextStyleControls style={style} defaults={defaults} onChange={onStyleChange} {...(expanded !== undefined ? { expanded } : {})} bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />} />
      <Divider />
      <FooterIncludeDropdown block={block} updateBlock={updateBlock} />
      <FooterGapControl block={block} updateBlock={updateBlock} />
    </div>
  )
}

/**
 * Single multi-select dropdown for everything the footer can show: the contact
 * line items (business name, phone, website, ABN, each shown by default) and the
 * social icons (off by default, rendered when a matching profile URL is set).
 * Collapsing these into one dropdown keeps the toolbar narrow.
 */
function FooterIncludeDropdown({
  block,
  updateBlock,
}: {
  block: FooterBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const groups = [
    {
      title: 'Contact details',
      rows: [
        { label: 'Phone', active: block.showPhone ?? true, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showPhone: v }) },
        { label: 'Website', active: block.showContactWebsite ?? true, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showContactWebsite: v }) },
        { label: 'ABN', active: block.showAbn ?? true, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showAbn: v }) },
      ],
    },
    {
      title: 'Social icons',
      rows: [
        { label: 'Facebook', Icon: Facebook, active: block.showFacebook ?? false, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showFacebook: v }) },
        { label: 'Instagram', Icon: Instagram, active: block.showInstagram ?? false, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showInstagram: v }) },
        { label: 'Twitter', Icon: Twitter, active: block.showTwitter ?? false, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showTwitter: v }) },
        { label: 'Pinterest', Icon: Pin, active: block.showPinterest ?? false, set: (v: boolean) => updateBlock<FooterBlock>(block.id, { showPinterest: v }) },
      ],
    },
  ]
  return (
    <Popover.Root>
      <Tooltip label="Show or hide footer items">
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200 text-gray-700 shrink-0"
          >
            <span className="text-gray-900 font-medium">Include</span>
            <ChevronDown size={10} strokeWidth={2} className="text-gray-400" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-[60] w-[220px] animate-modal-in"
        >
          {groups.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
              <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.08em] text-gray-400">{group.title}</div>
              {group.rows.map((row) => {
                const RowIcon = 'Icon' in row ? row.Icon : undefined
                return (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => row.set(!row.active)}
                    aria-pressed={row.active}
                    className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded border shrink-0 ${
                        row.active ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-transparent'
                      }`}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {RowIcon && <RowIcon size={13} strokeWidth={1.5} className="text-gray-400 shrink-0" />}
                    <span>{row.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Slider controlling the vertical gap between the footer's closing note and the
 * contact/social block beneath it. Defaults to 12px.
 */
function FooterGapControl({
  block,
  updateBlock,
}: {
  block: FooterBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const gap = block.noteGap ?? 12
  return (
    <Popover.Root>
      <Tooltip label="Space below note">
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition shrink-0 bg-white text-gray-600 border-gray-200 hover:text-gray-900"
          >
            <Minus size={12} strokeWidth={1.75} className="rotate-90" />
            <span className="font-mono text-[10px] opacity-80">{gap}px</span>
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 z-[60] w-[200px] animate-modal-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-[0.08em]">Space below note</span>
            <span className="text-[10px] font-mono text-gray-700 tabular-nums">{gap}px</span>
          </div>
          <Slider
            value={gap}
            min={0}
            max={48}
            step={1}
            onChange={(v) => updateBlock<FooterBlock>(block.id, { noteGap: v })}
            ariaLabel="Space below note"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Controls shown when the footer's social icon row is selected: spacing between
 * icons, plus an optional background chip (colour + rounding) behind each icon.
 * Include stays available so networks can still be toggled on/off from here.
 */
function FooterSocialControls({
  block,
  updateBlock,
}: {
  block: FooterBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const bgOn = block.socialIconBg != null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActiveTargetLabel label="Social" />
      <Divider />
      <MiniSlider
        icon={<Equal size={12} strokeWidth={1.75} />}
        tooltip="Icon spacing"
        label="Icon spacing"
        value={block.socialGap ?? 12}
        min={0}
        max={40}
        onChange={(v) => updateBlock<FooterBlock>(block.id, { socialGap: v })}
      />
      <Tooltip label="Icon colour">
        <ColorPopover
          value={block.socialIconColor || '#6B7280'}
          onChange={(v) => updateBlock<FooterBlock>(block.id, { socialIconColor: v })}
          swatches={COLOR_PALETTE}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200 text-xs text-gray-700"
            >
              <span className="w-4 h-4 rounded-full ring-1 ring-black/10" style={{ background: block.socialIconColor || '#6B7280' }} />
              Icon
            </button>
          }
        />
      </Tooltip>
      <Toggle
        label="Icon bg"
        active={bgOn}
        onChange={(v) => updateBlock(block.id, { socialIconBg: v ? '#F3F4F6' : undefined } as Partial<FooterBlock>)}
      />
      {bgOn && (
        <>
          <Tooltip label="Icon background colour">
            <ColorPopover
              value={block.socialIconBg || '#F3F4F6'}
              onChange={(v) => updateBlock<FooterBlock>(block.id, { socialIconBg: v })}
              swatches={COLOR_PALETTE}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
                >
                  <span className="w-4 h-4 rounded ring-1 ring-black/10" style={{ background: block.socialIconBg || '#F3F4F6' }} />
                </button>
              }
            />
          </Tooltip>
          <MiniSlider
            icon={<Square size={12} strokeWidth={1.75} />}
            tooltip="Icon rounding"
            label="Icon rounding"
            value={block.socialIconRadius ?? 8}
            min={0}
            max={20}
            onChange={(v) => updateBlock<FooterBlock>(block.id, { socialIconRadius: v })}
          />
        </>
      )}
      <Divider />
      <FooterIncludeDropdown block={block} updateBlock={updateBlock} />
    </div>
  )
}

/**
 * Style controls for the payment-schedule block. Clicking the subheading targets
 * it (headingStyle); clicking a line label targets the line labels (lineStyle).
 * The amounts/dates are dynamic chips, so they are not styleable here.
 */
function PaymentScheduleControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: PaymentScheduleBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  const target: 'heading' | 'line' | 'value' =
    activeSubTarget === 'line' ? 'line' : activeSubTarget === 'value' ? 'value' : 'heading'
  const style = target === 'line' ? block.lineStyle : target === 'value' ? block.valueStyle : block.headingStyle
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), target === 'heading' ? 'sectionHeading' : 'body'),
    align: 'left',
  }
  const onStyleChange = (patch: TextStyle) => {
    const merged = { ...(style ?? {}), ...patch }
    updateBlock<PaymentScheduleBlock>(
      block.id,
      target === 'line' ? { lineStyle: merged } : target === 'value' ? { valueStyle: merged } : { headingStyle: merged },
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActiveTargetLabel label={target === 'heading' ? 'Heading' : target === 'line' ? 'Line' : 'Amount & date'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={onStyleChange}
        {...(expanded !== undefined ? { expanded } : {})}
        bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
      />
    </div>
  )
}

// ── Package header ────────────────────────────────────────────────────────────

function PackageHeaderControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: PackageHeaderBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'sectionHeading'),
    align: 'left',
  }

  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.titleStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<PackageHeaderBlock>(block.id, { titleStyle: { ...(block.titleStyle ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
        bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
      />
    </div>
  )
}

// ── Package details ───────────────────────────────────────────────────────────

function PackageDetailsControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: PackageDetailsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const defaults: TextStyleDefaults = {
    ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
    align: 'left',
  }

  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.bodyStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<PackageDetailsBlock>(block.id, { bodyStyle: { ...(block.bodyStyle ?? {}), ...patch } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
        bgSlot={<BackgroundControl block={block} updateBlock={updateBlock} />}
      />
    </div>
  )
}

// ── Package inclusions ────────────────────────────────────────────────────────

type PackageInclusionsTarget = 'rows' | 'heading' | 'item'

function PackageInclusionsControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: PackageInclusionsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  const target: PackageInclusionsTarget =
    activeSubTarget === 'heading' || activeSubTarget === 'item' ? activeSubTarget : 'rows'

  if (target === 'rows') {
    return (
      <div className="flex items-center gap-2">
        <ActiveTargetLabel label="Rows" />
      </div>
    )
  }

  const isHeading = target === 'heading'
  const style = isHeading ? block.headingStyle : block.itemStyle
  const defaults: TextStyleDefaults = isHeading
    ? {
        ...roleDefaults(publicBrandingFromEditorState(state), 'sectionLabel'),
        align: 'left',
      }
    : {
        ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
        align: 'left',
      }

  return (
    <div className="flex items-center gap-2">
      <ActiveTargetLabel label={isHeading ? 'Heading' : 'Items'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) => {
          const merged = { ...(style ?? {}), ...patch }
          updateBlock<PackageInclusionsBlock>(
            block.id,
            isHeading ? { headingStyle: merged } : { itemStyle: merged },
          )
        }}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

// ── Package totals ────────────────────────────────────────────────────────────

type PackageTotalsTarget = 'rows' | 'subtotal' | 'total'

function PackageTotalsControls({
  block,
  state,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: PackageTotalsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  activeSubTarget: string | null
  expanded?: boolean
}) {
  const target: PackageTotalsTarget =
    activeSubTarget === 'subtotal' || activeSubTarget === 'total' ? activeSubTarget : 'rows'

  if (target === 'rows') {
    return (
      <div className="flex items-center gap-2">
        <ActiveTargetLabel label="Rows" />
      </div>
    )
  }

  const isSubtotal = target === 'subtotal'
  const style = isSubtotal ? block.subtotalStyle : block.totalStyle
  const defaults: TextStyleDefaults = isSubtotal
    ? {
        ...roleDefaults(publicBrandingFromEditorState(state), 'body'),
        align: 'left',
      }
    : {
        ...roleDefaults(publicBrandingFromEditorState(state), 'total'),
        align: 'left',
      }

  return (
    <div className="flex items-center gap-2">
      <ActiveTargetLabel label={isSubtotal ? 'Subtotal' : 'Total'} />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) => {
          const merged = { ...(style ?? {}), ...patch }
          updateBlock<PackageTotalsBlock>(
            block.id,
            isSubtotal ? { subtotalStyle: merged } : { totalStyle: merged },
          )
        }}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

/**
 * Compact toolbar button that opens a single-slider popover. Used for the footer
 * social icon spacing and rounding controls.
 */
function MiniSlider({
  icon,
  tooltip,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode
  tooltip: string
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <Popover.Root>
      <Tooltip label={tooltip}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition shrink-0 bg-white text-gray-600 border-gray-200 hover:text-gray-900"
          >
            {icon}
            <span className="font-mono text-[10px] opacity-80">{value}px</span>
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 z-[60] w-[200px] animate-modal-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-[0.08em]">{label}</span>
            <span className="text-[10px] font-mono text-gray-700 tabular-nums">{value}px</span>
          </div>
          <Slider value={value} min={min} max={max} step={1} onChange={onChange} ariaLabel={label} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
}

function Toggle({ label, active, onChange }: { label: string; active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs cursor-pointer border ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
      }`}
    >
      {active && <Check size={11} strokeWidth={2.5} />}
      {label}
    </button>
  )
}

function PillToggle<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; icon?: React.ReactNode }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-md p-0.5">
      {options.map((opt) => {
        const btn = (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-xs rounded-sm cursor-pointer transition ${
              value === opt.value ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {opt.icon ?? opt.label}
          </button>
        )
        return opt.icon ? (
          <Tooltip key={opt.value} label={opt.label}>{btn}</Tooltip>
        ) : btn
      })}
    </div>
  )
}

/**
 * Non-interactive label naming the sub-element the style controls are acting on
 * (the one clicked in the preview). Replaces the per-block target switchers:
 * selection happens by clicking in the preview, this just says what's selected.
 */
function ActiveTargetLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center h-8 px-2.5 rounded-md bg-gray-100 text-xs font-medium text-gray-900 whitespace-nowrap shrink-0">
      {label}
    </span>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value))
  const [focused, setFocused] = useState(false)

  const localRef = useRef(local)
  const minRef = useRef(min)
  const maxRef = useRef(max)
  const onChangeRef = useRef(onChange)
  const focusedRef = useRef(focused)

  useEffect(() => { localRef.current = local }, [local])
  useEffect(() => { minRef.current = min }, [min])
  useEffect(() => { maxRef.current = max }, [max])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { focusedRef.current = focused }, [focused])

  useEffect(() => {
    if (!focusedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocal(String(value))
    }
  }, [value])

  // Commit on unmount (e.g. popover closes before onBlur fires)
  useEffect(() => {
    return () => {
      const v = parseFloat(localRef.current)
      const zero = Math.max(0, minRef.current)
      const committed = isNaN(v) || localRef.current.trim() === ''
        ? zero
        : Math.min(maxRef.current, Math.max(minRef.current, v))
      onChangeRef.current(committed)
    }
  }, [])

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 border border-gray-200 rounded-md px-2 h-8">
      <span className="text-gray-500">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          const v = parseFloat(local)
          if (isNaN(v) || local.trim() === '') {
            const zero = Math.max(0, min)
            setLocal(String(zero))
            onChange(zero)
          } else {
            const clamped = Math.min(max, Math.max(min, v))
            setLocal(String(clamped))
            onChange(clamped)
          }
        }}
        className="w-12 bg-transparent outline-none text-gray-900"
      />
    </label>
  )
}

/**
 * Corner-radius control shown on every block's toolbar. Overrides the theme's
 * default corner radius for this block only; `undefined` (the default) inherits
 * the theme radius. The rounded-square glyph distinguishes it from the border
 * control's square glyph.
 */
function RadiusControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const radius = block.blockRadius
  const active = radius !== undefined
  return (
    <Popover.Root>
      <Tooltip label="Corner radius">
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition shrink-0 ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
            }`}
          >
            <span className="w-3 h-3 rounded-[4px] border-[1.5px] border-current" />
            {active && <span className="font-mono text-[10px] opacity-80">{radius}px</span>}
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[240px] animate-modal-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Corner radius</span>
            <span className="text-xs font-mono text-gray-700 tabular-nums">{radius ?? 'theme'}</span>
          </div>
          <Slider
            value={radius ?? 0}
            min={0}
            max={32}
            step={1}
            onChange={(v) => updateBlock(block.id, { blockRadius: v } as Partial<Block>)}
            ariaLabel="Corner radius"
          />
          {active && (
            <button
              type="button"
              onClick={() => updateBlock(block.id, { blockRadius: undefined } as Partial<Block>)}
              className="mt-3 w-full text-[11px] text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              Reset to theme
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function VAlignControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const value = block.blockVAlign ?? 'middle'
  return (
    <PillToggle
      options={[
        { value: 'top', label: 'Align top', icon: <VAlignIcon position="top" /> },
        { value: 'middle', label: 'Align middle', icon: <VAlignIcon position="middle" /> },
        { value: 'bottom', label: 'Align bottom', icon: <VAlignIcon position="bottom" /> },
      ]}
      value={value}
      onChange={(v) => updateBlock(block.id, { blockVAlign: v } as Partial<Block>)}
    />
  )
}

function ColSpreadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="4" height="2" rx="0.75" fill="currentColor" />
      <rect x="1" y="6.5" width="5" height="2" rx="0.75" fill="currentColor" />
      <rect x="1" y="10" width="3" height="2" rx="0.75" fill="currentColor" />
      <rect x="9" y="3" width="4" height="2" rx="0.75" fill="currentColor" />
      <rect x="8" y="6.5" width="5" height="2" rx="0.75" fill="currentColor" />
      <rect x="10" y="10" width="3" height="2" rx="0.75" fill="currentColor" />
    </svg>
  )
}

function VAlignIcon({ position }: { position: 'top' | 'middle' | 'bottom' }) {
  const lineY = position === 'top' ? 4 : position === 'middle' ? 6 : 8
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <rect x="3.5" y={lineY} width="7" height="2" rx="0.75" fill="currentColor" />
    </svg>
  )
}

// ── Spacer ────────────────────────────────────────────────────────────────────

function SpacerControls({
  block,
  updateBlock,
}: {
  block: SpacerBlock
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Popover.Root>
        <Tooltip label="Height">
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition bg-white text-gray-600 border-gray-200 hover:text-gray-900 shrink-0"
            >
              <Equal size={12} strokeWidth={1.75} />
              {(block.heightPx ?? 32) !== 32 && (
                <span className="font-mono text-[10px]">{block.heightPx}px</span>
              )}
            </button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content
            align="center"
            sideOffset={6}
            className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[200px] animate-modal-in"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Height</span>
              <span className="text-xs font-mono text-gray-700 tabular-nums">{block.heightPx ?? 32}px</span>
            </div>
            <Slider
              value={block.heightPx ?? 32}
              min={8}
              max={160}
              step={1}
              onChange={(v) => updateBlock<SpacerBlock>(block.id, { heightPx: Math.round(v) })}
              ariaLabel="Spacer height"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

function BackgroundControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  return (
    // Tooltip wraps the whole ColorPopover (its span sits outside Popover.Root),
    // so the hover label works without breaking the trigger's open-onClick. The
    // button itself must stay the direct child of Popover.Trigger `asChild` —
    // wrapping the button in <Tooltip> would swallow the click.
    <Tooltip label="Background colour">
      <ColorPopover
        value={block.bgColor || '#FFFFFF'}
        onChange={(v) => updateBlock(block.id, { bgColor: v } as Partial<Block>)}
        swatches={COLOR_PALETTE}
        trigger={
          <button
            type="button"
            className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
          >
            <span className="w-4 h-4 rounded ring-1 ring-black/10" style={{ background: block.bgColor || '#FFFFFF' }} />
          </button>
        }
      />
    </Tooltip>
  )
}

function SpacingControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const spaceAbove = block.spaceAbove ?? 0
  const spaceBelow = block.spaceBelow ?? 0
  const active = spaceAbove > 0 || spaceBelow > 0

  return (
    <Popover.Root>
      <Tooltip label="Spacing">
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition shrink-0 ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
            }`}
          >
            <Equal size={12} strokeWidth={1.75} />
            {active && <span className="font-mono text-[10px] opacity-80">S</span>}
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[240px] animate-modal-in"
        >
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Space above</span>
                <span className="text-xs font-mono text-gray-700 tabular-nums">{spaceAbove}px</span>
              </div>
              <Slider
                value={spaceAbove}
                min={0}
                max={100}
                step={1}
                onChange={(v) => updateBlock(block.id, { spaceAbove: v || undefined } as Partial<Block>)}
                ariaLabel="Space above"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Space below</span>
                <span className="text-xs font-mono text-gray-700 tabular-nums">{spaceBelow}px</span>
              </div>
              <Slider
                value={spaceBelow}
                min={0}
                max={100}
                step={1}
                onChange={(v) => updateBlock(block.id, { spaceBelow: v || undefined } as Partial<Block>)}
                ariaLabel="Space below"
              />
            </div>
          </div>
          {active && (
            <button
              type="button"
              onClick={() =>
                updateBlock(block.id, {
                  spaceAbove: undefined,
                  spaceBelow: undefined,
                } as Partial<Block>)
              }
              className="mt-3 w-full text-[11px] text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              Clear spacing
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function BorderControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const width = block.borderWidth ?? 0
  const color = block.borderColor || '#E5E7EB'
  const active = width > 0
  return (
    <Popover.Root>
      <Tooltip label="Border">
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs border cursor-pointer transition shrink-0 ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
            }`}
          >
            <Square size={12} strokeWidth={1.75} />
            {active && <span className="font-mono text-[10px] opacity-80">{width}px</span>}
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[240px] animate-modal-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Thickness</span>
            <span className="text-xs font-mono text-gray-700 tabular-nums">{width}px</span>
          </div>
          <Slider
            value={width}
            min={0}
            max={6}
            step={1}
            onChange={(v) => updateBlock(block.id, { borderWidth: v } as Partial<Block>)}
            ariaLabel="Border thickness"
          />
          <div className="mt-3 flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Color</span>
            <ColorPopover
              value={color}
              onChange={(v) => updateBlock(block.id, { borderColor: v } as Partial<Block>)}
              swatches={['#E5E7EB', '#D1D5DB', '#9CA3AF', '#374151', '#111827', '#0F172A']}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200"
                  title="Border color"
                >
                  <span
                    className="w-4 h-4 rounded ring-1 ring-black/10"
                    style={{ background: color }}
                  />
                  <span className="font-mono text-gray-600">{color.toUpperCase()}</span>
                </button>
              }
            />
          </div>
          {width > 0 && (
            <button
              type="button"
              onClick={() => updateBlock(block.id, { borderWidth: 0 } as Partial<Block>)}
              className="mt-3 w-full text-[11px] text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              Clear border
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

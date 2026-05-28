'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Copy, Trash2, Square, RotateCcw, Minus, AlignLeft, AlignCenter, AlignRight, Equal } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { TextStyleControls } from './text-style-controls'
import { ColorPopover } from '../components/color-popover'
import { Slider } from '../components/slider'
import { Tooltip } from '@/components/ui/tooltip'
import { COLOR_PALETTE } from '@/lib/branding/themes'
import { getTextColor } from '@/lib/branding/contrast'
import type { TextStyleDefaults } from './text-style'
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
} from './types'
import type { BrandPreviewState } from '@/types/branding-preview'

interface BlockToolbarProps {
  block: Block
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  onDuplicate: () => void
  onDelete: () => void
  onResetBlock: () => void
}

export function BlockToolbar({ block, state, updateBlock, onDuplicate, onDelete, onResetBlock }: BlockToolbarProps) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)] animate-modal-in"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Row 1: block-type-specific controls */}
      <div className="flex items-center gap-1 px-1 pt-1">
        <BlockSpecificControls block={block} state={state} updateBlock={updateBlock} />
      </div>

      {/* Row 2: structural controls + actions */}
      <div className="flex items-center gap-1 px-1 pb-1 pt-0.5 border-t border-gray-100 mt-1">
        {block.type !== 'headerBanner' && block.type !== 'action' && (
          <>
            <VAlignControl block={block} updateBlock={updateBlock} />
            <Divider />
          </>
        )}
        {block.type !== 'action' && <BorderControl block={block} updateBlock={updateBlock} />}
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
          <Tooltip label="Delete">
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete block"
              className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer transition"
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
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}

function BlockSpecificControls({ block, state, updateBlock, expanded }: ControlsProps) {
  switch (block.type) {
    case 'title':
      return <TitleControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'text':
      return <TextControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'action':
      return <ActionControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'headerBanner':
      return <HeaderBannerControls block={block} updateBlock={updateBlock} />
    case 'businessName':
      return <BusinessNameControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'tagline':
      return <TaglineControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'totals':
      return <TotalsControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'paymentDetails':
      return <PaymentDetailsControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'lineItems':
      return <LineItemsControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'divider':
      return <DividerControls block={block} updateBlock={updateBlock} />
    case 'footer':
      return <FooterControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'couplePortal':
      return null
    case 'paymentSchedule':
      return null
    case 'contractBody':
      return null
  }
}

// ── Title ─────────────────────────────────────────────────────────────────────

type TitleTarget = 'title' | 'subtitle' | 'meta'

function TitleControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: TitleBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<TitleTarget>('title')

  if (target === 'meta') {
    return (
      <div className="flex items-center gap-2">
        <TargetSwitcher
          target={target}
          setTarget={setTarget}
          options={[
            { value: 'title', label: 'Title' },
            { value: 'subtitle', label: 'Subtitle' },
            { value: 'meta', label: 'Meta' },
          ]}
        />
        <Divider />
        <Toggle
          label="Ref"
          active={block.showRef}
          onChange={(v) => updateBlock<TitleBlock>(block.id, { showRef: v })}
        />
        <Toggle
          label="Expires"
          active={block.showExpires}
          onChange={(v) => updateBlock<TitleBlock>(block.id, { showExpires: v })}
        />
        <Toggle
          label="ABN"
          active={block.showAbn}
          onChange={(v) => updateBlock<TitleBlock>(block.id, { showAbn: v })}
        />
      </div>
    )
  }

  const isTitle = target === 'title'
  const style = isTitle ? block.titleStyle : block.subtitleStyle
  const defaults: TextStyleDefaults = isTitle
    ? {
        fontFamily: state.fontHeading,
        fontSize: 36,
        fontWeight: state.fontWeight,
        color: '#111827',
        align: 'left',
        lineHeight: 1.1,
        letterSpacing: -0.01,
      }
    : {
        fontFamily: state.fontBody,
        fontSize: 14,
        fontWeight: 400,
        color: '#6B7280',
        align: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
      }
  const onStyleChange = (patch: TextStyle) => {
    const merged = { ...(style ?? {}), ...patch }
    updateBlock<TitleBlock>(block.id, isTitle ? { titleStyle: merged } : { subtitleStyle: merged })
  }

  return (
    <div className="flex items-center gap-2">
      <TargetSwitcher
        target={target}
        setTarget={setTarget}
        options={[
          { value: 'title', label: 'Title' },
          { value: 'subtitle', label: 'Subtitle' },
          { value: 'meta', label: 'Meta' },
        ]}
      />
      <Divider />
      <TextStyleControls style={style} defaults={defaults} onChange={onStyleChange} expanded={expanded} />
    </div>
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
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 400,
    color: '#6B7280',
    align: 'left',
    lineHeight: 1.6,
    letterSpacing: 0,
  }

  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.textStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TextBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...patch } })
        }
        expanded={expanded}
      />
    </div>
  )
}

// ── Action ────────────────────────────────────────────────────────────────────

type ActionTarget = 'block' | 'primary' | 'secondary'

function ActionControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: ActionBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<ActionTarget>('block')

  useEffect(() => {
    if (block.secondary === null && target === 'secondary') setTarget('block')
  }, [block.secondary, target])

  const options = [
    { value: 'block' as const, label: 'Block' },
    { value: 'primary' as const, label: 'Primary' },
    ...(block.secondary !== null ? [{ value: 'secondary' as const, label: 'Secondary' }] : []),
  ]

  if (target === 'block') {
    return (
      <div className="flex items-center gap-2 w-full">
        <TargetSwitcher target={target} setTarget={setTarget} options={options} />
        <Divider />
        <ActionBlockControls block={block} state={state} updateBlock={updateBlock} />
      </div>
    )
  }

  const isPrimary = target === 'primary'
  const style = isPrimary ? block.primaryStyle : block.secondaryStyle
  const buttonColor = block.buttonColor ?? state.brandColor
  const defaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: isPrimary ? getTextColor(buttonColor) : (state.secondaryTextColor || '#374151'),
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <TargetSwitcher target={target} setTarget={setTarget} options={options} />
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
        expanded={expanded}
      />
    </div>
  )
}

function ActionBlockControls({
  block,
  state,
  updateBlock,
}: {
  block: ActionBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const radius = block.buttonRadius ?? Math.min(state.cornerRadius, 12)
  return (
    <>
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
              {radius !== Math.min(state.cornerRadius, 12) && (
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
    fontFamily: state.fontHeading,
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }
  const layout = block.layout ?? 'row'
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
      {layout !== 'logo' && (
        <>
          <Divider />
          <TextStyleControls
            style={block.nameStyle}
            defaults={defaults}
            onChange={(patch) =>
              updateBlock<BusinessNameBlock>(block.id, { nameStyle: { ...(block.nameStyle ?? {}), ...patch } })
            }
            expanded={expanded}
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
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 400,
    color: '#6B7280',
    align: 'left',
    lineHeight: 1.4,
    letterSpacing: 0,
  }
  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.textStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TaglineBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...patch } })
        }
        expanded={expanded}
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
  expanded,
}: {
  block: TotalsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<TotalsTarget>('rows')

  const rowDefaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 13,
    fontWeight: 400,
    color: state.mutedColor || '#6B7280',
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
        <TargetSwitcher
          target={target}
          setTarget={setTarget}
          options={[
            { value: 'rows', label: 'Rows' },
            { value: 'subtotal', label: 'Subtotal' },
            { value: 'tax', label: 'Tax' },
            { value: 'total', label: 'Total' },
          ]}
        />
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
      <TargetSwitcher
        target={target}
        setTarget={setTarget}
        options={[
          { value: 'rows', label: 'Rows' },
          { value: 'subtotal', label: 'Subtotal' },
          { value: 'tax', label: 'Tax' },
          { value: 'total', label: 'Total' },
        ]}
      />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<TotalsBlock>(block.id, { [styleKey]: { ...(style ?? {}), ...patch } })
        }
        expanded={expanded}
      />
    </div>
  )
}

// ── Payment Details ───────────────────────────────────────────────────────────

type PaymentDetailsTarget = 'heading' | 'label' | 'value'

function PaymentDetailsControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: PaymentDetailsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<PaymentDetailsTarget>('heading')

  const isHeading = target === 'heading'
  const isLabel = target === 'label'
  const isValue = target === 'value'

  const style = isHeading ? block.headingStyle : isLabel ? block.labelStyle : block.valueStyle
  const defaults: TextStyleDefaults = isHeading
    ? {
        fontFamily: state.fontHeading,
        fontSize: 16,
        fontWeight: state.fontWeight,
        color: state.textColor || '#111827',
        align: 'left',
        lineHeight: 1.3,
        letterSpacing: 0,
      }
    : isLabel
      ? {
          fontFamily: state.fontBody,
          fontSize: 12,
          fontWeight: 500,
          color: state.mutedColor || '#6B7280',
          align: 'left',
          lineHeight: 1.5,
          letterSpacing: 0,
        }
      : {
          fontFamily: state.fontBody,
          fontSize: 14,
          fontWeight: 500,
          color: state.textColor || '#111827',
          align: 'left',
          lineHeight: 1.5,
          letterSpacing: 0,
        }

  const styleKey = isHeading ? 'headingStyle' : isLabel ? 'labelStyle' : 'valueStyle'

  return (
    <div className="flex items-center gap-2">
      <TargetSwitcher
        target={target}
        setTarget={setTarget}
        options={[
          { value: 'heading', label: 'Heading' },
          { value: 'label', label: 'Label' },
          { value: 'value', label: 'Value' },
        ]}
      />
      <Divider />
      <TextStyleControls
        style={style}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<PaymentDetailsBlock>(block.id, { [styleKey]: { ...(style ?? {}), ...patch } })
        }
        expanded={expanded}
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
  expanded,
}: {
  block: LineItemsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<LineItemsTarget>('rows')

  if (target === 'rows') {
    return (
      <div className="flex items-center gap-2">
        <TargetSwitcher
          target={target}
          setTarget={setTarget}
          options={[
            { value: 'rows', label: 'Rows' },
            { value: 'header', label: 'Header' },
            { value: 'item', label: 'Items' },
          ]}
        />
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
      <TargetSwitcher
        target={target}
        setTarget={setTarget}
        options={[
          { value: 'rows', label: 'Rows' },
          { value: 'header', label: 'Header' },
          { value: 'item', label: 'Items' },
        ]}
      />
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
        expanded={expanded}
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
      <button
        type="button"
        onClick={() =>
          updateBlock<HeaderBannerBlock>(block.id, {
            imageX: 50,
            imageY: 50,
            heightPx: undefined,
            imageScale: 1,
          })
        }
        disabled={!customised}
        className={`inline-flex items-center px-2 h-8 rounded-md text-xs border transition ${
          customised
            ? 'bg-white text-gray-700 border-gray-200 hover:text-gray-900 hover:bg-gray-50 cursor-pointer'
            : 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
        }`}
      >
        Reset
      </button>
      <span className="hidden lg:inline text-[11px] text-gray-400 pl-1">
        Drag to pan · ⌘+scroll to zoom · Drag edge to resize
      </span>
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
      <ColorPopover
        value={block.color ?? '#E5E7EB'}
        onChange={(v) => updateBlock<DividerBlock>(block.id, { color: v })}
        swatches={['#E5E7EB', '#9CA3AF', '#374151', '#111827']}
        trigger={
          <button
            type="button"
            className="inline-flex items-center h-8 px-2.5 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
            title="Line color"
          >
            <span
              className="w-4 h-4 rounded ring-1 ring-black/10"
              style={{ background: block.color ?? '#E5E7EB' }}
            />
          </button>
        }
      />
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

type FooterTarget = 'note' | 'contact'

function FooterControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: FooterBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  expanded?: boolean
}) {
  const [target, setTarget] = useState<FooterTarget>('note')

  const isNote = target === 'note'
  const style = isNote ? block.noteStyle : block.contactStyle
  const defaults: TextStyleDefaults = isNote
    ? {
        fontFamily: state.fontBody,
        fontSize: 12,
        fontWeight: state.fontBodyWeight ?? 400,
        color: state.mutedColor || '#6B7280',
        align: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
      }
    : {
        fontFamily: state.fontBody,
        fontSize: 11,
        fontWeight: 400,
        color: state.mutedColor || '#9CA3AF',
        align: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
      }
  const onStyleChange = (patch: TextStyle) => {
    const merged = { ...(style ?? {}), ...patch }
    updateBlock<FooterBlock>(block.id, isNote ? { noteStyle: merged } : { contactStyle: merged })
  }

  return (
    <div className="flex items-center gap-2">
      <TargetSwitcher
        target={target}
        setTarget={setTarget}
        options={[
          { value: 'note', label: 'Note' },
          { value: 'contact', label: 'Contact' },
        ]}
      />
      <Divider />
      <TextStyleControls style={style} defaults={defaults} onChange={onStyleChange} expanded={expanded} />
    </div>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

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

function TargetSwitcher<V extends string>({
  target,
  setTarget,
  options,
}: {
  target: V
  setTarget: (v: V) => void
  options: { value: V; label: string }[]
}) {
  const current = options.find((o) => o.value === target) ?? options[0]
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200 text-gray-700"
        >
          <span className="text-gray-900 font-medium">{current.label}</span>
          <ChevronDown size={10} strokeWidth={2} className="text-gray-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="bg-white border border-gray-200 rounded-lg shadow-xl p-1 z-[60] min-w-[160px]"
        >
          {options.map((opt) => (
            <Popover.Close asChild key={opt.value}>
              <button
                type="button"
                onClick={() => setTarget(opt.value)}
                className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-sm cursor-pointer ${
                  target === opt.value ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="flex-1 text-left">{opt.label}</span>
                {target === opt.value && <Check size={11} strokeWidth={2.5} className="text-gray-900" />}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  useEffect(() => { localRef.current = local }, [local])
  useEffect(() => { minRef.current = min }, [min])
  useEffect(() => { maxRef.current = max }, [max])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (!focused) setLocal(String(value))
  }, [value, focused])

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

function RadiusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <NumberField label="Radius" value={value} min={0} max={32} step={1} onChange={onChange} />
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

function BorderControl({
  block,
  updateBlock,
}: {
  block: Block
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  const width = block.borderWidth ?? 0
  const color = block.borderColor || '#E5E7EB'
  const radius = block.blockRadius
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
          <div className="mt-3 flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Radius</span>
            <span className="text-xs font-mono text-gray-700 tabular-nums">{radius ?? 'theme'}</span>
          </div>
          <Slider
            value={radius ?? 0}
            min={0}
            max={24}
            step={1}
            onChange={(v) => updateBlock(block.id, { blockRadius: v } as Partial<Block>)}
            ariaLabel="Block corner radius"
          />
          {(width > 0 || radius !== undefined) && (
            <button
              type="button"
              onClick={() => updateBlock(block.id, { borderWidth: 0, blockRadius: undefined } as Partial<Block>)}
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

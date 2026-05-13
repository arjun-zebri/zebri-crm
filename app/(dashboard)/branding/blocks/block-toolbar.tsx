'use client'

import { useState } from 'react'
import { ChevronDown, Check, Copy, Trash2, Plus, Lock, Unlock, Eye, EyeOff, Paintbrush, ClipboardPaste, Maximize2, Minimize2 } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { TextStyleControls } from './text-style-controls'
import { ColorPopover } from '../components/color-popover'
import { COLOR_PALETTE } from '@/lib/branding/themes'
import type { TextStyleDefaults } from './text-style'
import type {
  Block,
  TextStyle,
  TitleBlock,
  MessageBlock,
  ActionBlock,
  BusinessNameBlock,
  TaglineBlock,
  TotalsBlock,
  LineItemsBlock,
  DividerBlock,
  HeaderBannerBlock,
} from './types'
import type { BrandPreviewState } from '../branding-preview-types'

interface BlockToolbarProps {
  block: Block
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
  onDuplicate: () => void
  onDelete: () => void
  onAddBelow: () => void
  onToggleLock: () => void
  onToggleHide: () => void
  onCopyStyle: () => void
  onPasteStyle: () => void
  hasStyleClipboard: boolean
}

export function BlockToolbar({
  block,
  state,
  updateBlock,
  onDuplicate,
  onDelete,
  onAddBelow,
  onToggleLock,
  onToggleHide,
  onCopyStyle,
  onPasteStyle,
  hasStyleClipboard,
}: BlockToolbarProps) {
  const [expanded, setExpanded] = useState(false)
  const locked = !!block.locked
  const hidden = !!block.hidden
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)] animate-modal-in"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-1 p-1 max-w-[min(960px,calc(100vw-32px))] overflow-x-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <BlockSpecificControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
        <Divider />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onCopyStyle}
            aria-label="Copy style"
            title="Copy style (⌘⌥C)"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
          >
            <Paintbrush size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onPasteStyle}
            disabled={!hasStyleClipboard}
            aria-label="Paste style"
            title="Paste style (⌘⌥V)"
            className={`p-1.5 rounded-md transition ${
              hasStyleClipboard
                ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <ClipboardPaste size={13} strokeWidth={1.75} />
          </button>
          {expanded && (
            <>
              <Divider />
              <button
                type="button"
                onClick={onToggleHide}
                aria-label={hidden ? 'Show block' : 'Hide block'}
                title={hidden ? 'Show' : 'Hide'}
                className={`p-1.5 rounded-md cursor-pointer transition ${
                  hidden ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {hidden ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
              </button>
              <button
                type="button"
                onClick={onToggleLock}
                aria-label={locked ? 'Unlock block' : 'Lock block'}
                title={locked ? 'Unlock' : 'Lock'}
                className={`p-1.5 rounded-md cursor-pointer transition ${
                  locked ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {locked ? <Lock size={13} strokeWidth={1.75} /> : <Unlock size={13} strokeWidth={1.75} />}
              </button>
              <button
                type="button"
                onClick={onDuplicate}
                aria-label="Duplicate block"
                title="Duplicate"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
              >
                <Copy size={13} strokeWidth={1.75} />
              </button>
            </>
          )}
          <Divider />
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete block"
            title="Delete"
            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer transition"
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onAddBelow}
            aria-label="Add block below"
            title="Add block below"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
          >
            <Plus size={13} strokeWidth={1.75} />
          </button>
          <Divider />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse toolbar' : 'Expand toolbar'}
            aria-pressed={expanded}
            title={expanded ? 'Less' : 'More'}
            className={`p-1.5 rounded-md cursor-pointer transition ${
              expanded ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {expanded ? <Minimize2 size={13} strokeWidth={1.75} /> : <Maximize2 size={13} strokeWidth={1.75} />}
          </button>
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
    case 'message':
      return <MessageControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'action':
      return <ActionControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'headerBanner':
      return <HeaderBannerControls block={block} state={state} updateBlock={updateBlock} />
    case 'businessName':
      return <BusinessNameControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'tagline':
      return <TaglineControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'totals':
      return <TotalsControls block={block} state={state} updateBlock={updateBlock} expanded={expanded} />
    case 'lineItems':
      return <LineItemsControls block={block} state={state} updateBlock={updateBlock} />
    case 'divider':
      return <DividerControls block={block} updateBlock={updateBlock} />
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

// ── Message ───────────────────────────────────────────────────────────────────

function MessageControls({
  block,
  state,
  updateBlock,
  expanded,
}: {
  block: MessageBlock
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
      <PillToggle
        options={[
          { value: 'plain', label: 'Plain' },
          { value: 'card', label: 'Card' },
        ]}
        value={block.style}
        onChange={(v) => updateBlock<MessageBlock>(block.id, { style: v as 'plain' | 'card' })}
      />
      <Divider />
      <TextStyleControls
        style={block.textStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<MessageBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...patch } })
        }
        expanded={expanded}
      />
    </div>
  )
}

// ── Action ────────────────────────────────────────────────────────────────────

type ActionTarget = 'primary' | 'secondary' | 'button'

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
  const [target, setTarget] = useState<ActionTarget>('primary')

  const options = [
    { value: 'primary' as const, label: 'Primary' },
    ...(block.secondary !== null ? [{ value: 'secondary' as const, label: 'Secondary' }] : []),
    { value: 'button' as const, label: 'Button' },
  ]

  if (target === 'button') {
    return (
      <div className="flex items-center gap-2">
        <TargetSwitcher target={target} setTarget={setTarget} options={options} />
        <Divider />
        <ColorPopover
          value={block.buttonColor ?? state.brandColor}
          onChange={(v) => updateBlock<ActionBlock>(block.id, { buttonColor: v })}
          swatches={COLOR_PALETTE}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200"
              title="Button color"
            >
              <span
                className="w-4 h-4 rounded ring-1 ring-black/10"
                style={{ background: block.buttonColor ?? state.brandColor }}
              />
              <span className="text-gray-700">Button</span>
            </button>
          }
        />
        <RadiusInput
          value={block.buttonRadius ?? Math.min(state.cornerRadius, 12)}
          onChange={(v) => updateBlock<ActionBlock>(block.id, { buttonRadius: v })}
        />
        <Toggle
          label="Decline"
          active={block.secondary !== null}
          onChange={(v) =>
            updateBlock<ActionBlock>(block.id, { secondary: v ? block.secondary ?? 'Decline' : null })
          }
        />
      </div>
    )
  }

  const isPrimary = target === 'primary'
  const style = isPrimary ? block.primaryStyle : block.secondaryStyle
  const defaults: TextStyleDefaults = {
    fontFamily: state.fontBody,
    fontSize: 14,
    fontWeight: 500,
    color: isPrimary ? '#FFFFFF' : '#374151',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
  }

  return (
    <div className="flex items-center gap-2">
      <TargetSwitcher target={target} setTarget={setTarget} options={options} />
      <Divider />
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
  return (
    <div className="flex items-center gap-2">
      <TextStyleControls
        style={block.nameStyle}
        defaults={defaults}
        onChange={(patch) =>
          updateBlock<BusinessNameBlock>(block.id, { nameStyle: { ...(block.nameStyle ?? {}), ...patch } })
        }
        expanded={expanded}
      />
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
  return (
    <div className="flex items-center gap-2">
      <Toggle
        label="Subtotal"
        active={block.showSubtotal}
        onChange={(v) => updateBlock<TotalsBlock>(block.id, { showSubtotal: v })}
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
      <Divider />
      <span className="text-[11px] text-gray-400 hidden sm:inline">Total style:</span>
      <TextStyleControls
        style={block.totalStyle}
        defaults={{
          fontFamily: state.fontHeading,
          fontSize: 18,
          fontWeight: state.fontWeight,
          color: '#111827',
          align: 'left',
          lineHeight: 1.2,
          letterSpacing: 0,
        }}
        onChange={(patch) =>
          updateBlock<TotalsBlock>(block.id, { totalStyle: { ...(block.totalStyle ?? {}), ...patch } })
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
}: {
  block: LineItemsBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
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
        <Toggle
          label="Add line"
          active={block.showAddPlaceholder}
          onChange={(v) => updateBlock<LineItemsBlock>(block.id, { showAddPlaceholder: v })}
        />
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
      />
    </div>
  )
}

// ── Header banner ─────────────────────────────────────────────────────────────

function HeaderBannerControls({
  block,
  state,
  updateBlock,
}: {
  block: HeaderBannerBlock
  state: BrandPreviewState
  updateBlock: <B extends Block>(id: string, patch: Partial<B>) => void
}) {
  void state
  const overlayColor = block.overlayColor ?? '#000000'
  const overlayOpacity = block.overlayOpacity ?? 0
  return (
    <div className="flex items-center gap-2">
      <PillToggle
        options={[
          { value: 'sm', label: 'Sm' },
          { value: 'md', label: 'Md' },
          { value: 'lg', label: 'Lg' },
        ]}
        value={block.height ?? 'md'}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { height: v as 'sm' | 'md' | 'lg' })}
      />
      <Divider />
      <PillToggle
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        value={block.fit ?? 'cover'}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { fit: v as 'cover' | 'contain' })}
      />
      <Divider />
      <ColorPopover
        value={overlayColor}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { overlayColor: v })}
        swatches={['#000000', '#111827', '#FFFFFF', '#7C2D12', '#1E40AF']}
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200"
            title="Overlay color"
          >
            <span
              className="w-4 h-4 rounded ring-1 ring-black/10"
              style={{ background: overlayColor }}
            />
            <span className="text-gray-700">Overlay</span>
          </button>
        }
      />
      <NumberField
        label="Opacity"
        value={overlayOpacity}
        min={0}
        max={100}
        step={5}
        onChange={(v) => updateBlock<HeaderBannerBlock>(block.id, { overlayOpacity: v })}
      />
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
      <NumberField
        label="Thickness"
        value={block.thickness ?? 1}
        min={1}
        max={8}
        step={1}
        onChange={(v) => updateBlock<DividerBlock>(block.id, { thickness: v })}
      />
      <Divider />
      <ColorPopover
        value={block.color ?? '#E5E7EB'}
        onChange={(v) => updateBlock<DividerBlock>(block.id, { color: v })}
        swatches={['#E5E7EB', '#9CA3AF', '#374151', '#111827']}
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs hover:bg-gray-100 cursor-pointer border border-gray-200"
            title="Line color"
          >
            <span
              className="w-4 h-4 rounded ring-1 ring-black/10"
              style={{ background: block.color ?? '#E5E7EB' }}
            />
            <span className="text-gray-700">Color</span>
          </button>
        }
      />
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
  options: { value: V; label: string }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-md p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-xs rounded-sm cursor-pointer transition ${
            value === opt.value ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
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
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 border border-gray-200 rounded-md px-2 h-8">
      <span className="text-gray-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        className="w-12 bg-transparent outline-none text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  )
}

function RadiusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <NumberField label="Radius" value={value} min={0} max={32} step={1} onChange={onChange} />
  )
}

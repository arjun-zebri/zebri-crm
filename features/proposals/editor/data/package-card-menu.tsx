'use client'

/**
 * The pencil in a package card's corner and the popover behind it: the
 * card's non-text settings (Recommended badge, itemised vs fixed pricing,
 * GST) plus move left/right and remove. Always visible on the canvas so
 * a first-time user can see the card is editable (the hover-only pill
 * the packages section used to carry was the hidden-chrome pattern the
 * founder rejected on 2026-09-17). Everything here commits at once.
 *
 * @module features/proposals/editor/data/package-card-menu
 */
import * as Popover from '@radix-ui/react-popover'
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { PillToggle } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip } from '@/components/ui/tooltip'

import { plainText } from '../../model/doc'
import type { PackageOption } from '../../model/packages'

import { setPackageOptions, type PackageCardArgs } from './package-args'

const PRICING: { value: PackageOption['pricingMode']; label: string }[] = [
  { value: 'itemised', label: 'Sum of lines' },
  { value: 'single', label: 'Fixed price' },
]

/** Props for {@link PackageCardMenu}. */
export interface PackageCardMenuProps {
  args: PackageCardArgs
  option: PackageOption
  index: number
}

/** One label-left, control-right row (same rhythm as the section Style popover). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-body text-text-muted">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

/** The per-card pencil and its settings popover. */
export function PackageCardMenu({ args, option, index }: PackageCardMenuProps) {
  const { options, onFocus } = args
  const [open, setOpen] = useState(false)

  const write = (next: PackageOption[]) => setPackageOptions(args, next, true)
  const patch = (next: Partial<PackageOption>) => write(options.map((o) => (o.id === option.id ? { ...o, ...next } : o)))
  const move = (to: number) => {
    const next = options.filter((o) => o.id !== option.id)
    next.splice(to, 0, option)
    write(next)
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) onFocus() }}>
      <Tooltip side="top" label="Edit package">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Edit package ${plainText(option.title) || index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-text-muted shadow-sm transition hover:text-text"
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          onClick={(e) => e.stopPropagation()}
          className="z-[60] w-[280px] animate-modal-in rounded-control border border-border bg-surface p-4 shadow-xl"
        >
          <Row label="Recommended">
            <Checkbox
              ariaLabel="Recommended"
              checked={option.isPopular}
              // One badge per section: marking this card clears the others.
              onChange={(isPopular) => write(options.map((o) => ({ ...o, isPopular: o.id === option.id ? isPopular : false })))}
            />
          </Row>
          <Row label="Pricing">
            <PillToggle value={option.pricingMode} onChange={(pricingMode) => patch({ pricingMode })} options={PRICING} />
          </Row>
          <Row label="Price incl. GST">
            <Checkbox ariaLabel="Price incl. GST" checked={option.gstInclusive} onChange={(gstInclusive) => patch({ gstInclusive })} />
          </Row>

          <div className="my-2 border-t border-border" />

          <div className="flex items-center gap-1">
            <Tooltip side="top" label="Move left">
              <Button variant="ghost" iconOnly aria-label="Move left" disabled={index === 0} onClick={() => move(index - 1)}>
                <ArrowLeft size={14} strokeWidth={1.5} />
              </Button>
            </Tooltip>
            <Tooltip side="top" label="Move right">
              <Button variant="ghost" iconOnly aria-label="Move right" disabled={index >= options.length - 1} onClick={() => move(index + 1)}>
                <ArrowRight size={14} strokeWidth={1.5} />
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              className="ml-auto text-danger"
              onClick={() => { setOpen(false); write(options.filter((o) => o.id !== option.id)) }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Remove package
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

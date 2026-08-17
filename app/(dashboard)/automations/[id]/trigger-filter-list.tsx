/**
 * Trigger filters, rendered as chips inside the step card.
 *
 * Triggers carry up to a dozen optional filters. Rendering them all as
 * permanently-visible dropdowns produced a column of "Any source"
 * selects with no signal about which ones were actually set. Here a
 * filter exists only once it's been added: each is a chip reading
 * `label value`, clicking the chip picks a new value, and the ✕ drops
 * it. Everything not yet used sits behind one "Add filter" chip.
 *
 * Most filters are a flat list of choices, so they declare `options` +
 * `apply` and this component renders the picker for them. `render` is
 * the escape hatch for compound controls (an operator plus a number).
 * Controls inside the popover must not portal: a nested Radix portal
 * counts as an outside interaction and closes the popover on click.
 *
 * @module app/(dashboard)/automations/[id]/trigger-filter-list
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { Check, Plus, X } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'

import { MenuItem, MenuPanel, type MenuWidth } from '@/components/ui/menu'

/** Trigger config object, as owned by the inspector's form state. */
export type FilterConfig = Record<string, unknown>

/** Reads a config key as a string, treating absent or non-string as `''`. */
export function configString(config: FilterConfig, key: string): string {
  const raw = config[key]
  return typeof raw === 'string' ? raw : ''
}

export interface FilterOption {
  value: string
  label: string
}

/** One available filter on a trigger. */
export interface TriggerFilterDef {
  /** Stable id, unique within the trigger. Used as the React key. */
  key: string
  /** Full name, shown in the "Add filter" menu. */
  label: string
  /** Short name shown inside the chip. Defaults to {@link label}. */
  chipLabel?: string
  /**
   * A required parameter of the trigger rather than an optional
   * narrowing: the chip is always present, renders no ✕, and never
   * appears in the "Add filter" menu. For "N days before the due
   * date"-style triggers whose number is the point of the trigger.
   */
  required?: boolean
  /** Current value, shown emphasised in the chip (e.g. "already set"). */
  valueLabel: (config: FilterConfig) => string
  /** Self-contained phrase for the card's collapsed summary line. */
  summary: (config: FilterConfig) => string
  /** True when this filter is currently set on the config. */
  isActive: (config: FilterConfig) => boolean
  /** Config patch that puts the filter into its default "just added" state. */
  add: (config: FilterConfig) => FilterConfig
  /** Config patch that removes every field this filter owns. */
  remove: (config: FilterConfig) => FilterConfig
  /** Choices, rendered as rows in the chip's popover. */
  options?: FilterOption[]
  /** Writes a chosen option into the config. Required alongside `options`. */
  apply?: (config: FilterConfig, value: string) => FilterConfig
  /** Currently selected option value, for the tick. */
  current?: (config: FilterConfig) => string
  /** Compound control, rendered in the popover instead of `options`. */
  render?: (config: FilterConfig, setConfig: (c: FilterConfig) => void) => React.ReactNode
  /**
   * Which chip to open once this one has been added, when it is not
   * this chip itself. For a filter that appends to a list (the
   * branch's conditions) the new chip's key depends on how many there
   * now are, so it is computed from the config `add` produced.
   */
  openAfterAdd?: (config: FilterConfig) => string
  /**
   * Panel width for this chip's popover. The default (`md`) fits a
   * status or a lead source; a filter whose rows are phrases needs
   * more, and `MenuPanel` truncates rather than wrapping.
   */
  panelWidth?: MenuWidth
}

/**
 * Collapsed-card summary for a trigger: every active filter's phrase,
 * joined. Falls back to `emptyLabel` when nothing is set.
 *
 * `required` filters always count, exactly as they always show in the
 * chip row. Their `isActive` is false until the config is first
 * written, so keying off that alone left a trigger reading "A reminder
 * a set number of days before…" while its own chip said "7 days
 * before" right underneath.
 */
export function activeFilterSummary(
  filters: TriggerFilterDef[],
  config: FilterConfig,
  emptyLabel: string,
): string {
  const parts = filters
    .filter((f) => f.required || f.isActive(config))
    .map((f) => f.summary(config))
  return parts.length > 0 ? parts.join(' · ') : emptyLabel
}

interface Props {
  filters: TriggerFilterDef[]
  config: FilterConfig
  setConfig: (c: FilterConfig) => void
  /** Label on the dashed add chip. Triggers add filters; steps add options. */
  addLabel?: string
  /** Panel width for the add menu, when its rows are phrases. */
  addWidth?: MenuWidth
}

/**
 * The "Only when" chip row. Pass the same `config` / `setConfig` the
 * step card's debounced autosave watches; nothing here persists on
 * its own.
 */
export function TriggerFilterList({
  filters,
  config,
  setConfig,
  addLabel = 'Add filter',
  addWidth,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  // Opening the new chip's picker in the same tick the add menu closes
  // doesn't stick: the chip's Popover doesn't exist yet, and the add
  // menu's dismissable layer is still tearing down. Wait a frame, by
  // which point the chip is mounted and the other layer is gone.
  useEffect(() => {
    if (!pendingKey) return
    const frame = requestAnimationFrame(() => {
      setOpenKey(pendingKey)
      setPendingKey(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingKey])

  const active = filters.filter((f) => f.required || f.isActive(config))
  const available = filters.filter((f) => !f.required && !f.isActive(config))

  function addFilter(filter: TriggerFilterDef) {
    const next = filter.add(config)
    setConfig(next)
    setAddOpen(false)
    // Land straight in the value picker: adding a filter is never the
    // goal, choosing its value is.
    setPendingKey(filter.openAfterAdd ? filter.openAfterAdd(next) : filter.key)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((filter) => (
        <FilterChip
          key={filter.key}
          filter={filter}
          config={config}
          setConfig={setConfig}
          open={openKey === filter.key}
          onOpenChange={(o) => setOpenKey(o ? filter.key : null)}
        />
      ))}

      {/* Always the menu, even for a single choice: adding a filter
          seeds a default value, and a default nobody picked is a
          setting nobody knows they have. The menu names what is about
          to be added first. */}
      {available.length > 0 && (
        <Popover.Root open={addOpen} onOpenChange={setAddOpen}>
          <Popover.Trigger asChild>
            <AddChip label={addLabel} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={6} className="z-[90]">
              <MenuPanel
                {...(addWidth ? { width: addWidth } : {})}
                className="max-h-72 overflow-y-auto"
              >
                {available.map((filter) => (
                  <MenuItem key={filter.key} onClick={() => addFilter(filter)}>
                    {filter.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  )
}

/** The dashed "add" pill, as a trigger or as a plain button. */
const AddChip = forwardRef<HTMLButtonElement, { label: string; onClick?: () => void }>(
  function AddChip({ label, onClick, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        {...(onClick ? { onClick } : {})}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-dashed border-border px-3 text-body text-text-muted transition-colors hover:border-border-strong hover:text-text"
      >
        <Plus size={14} strokeWidth={1.5} />
        {label}
      </button>
    )
  },
)

function FilterChip({
  filter,
  config,
  setConfig,
  open,
  onOpenChange,
}: {
  filter: TriggerFilterDef
  config: FilterConfig
  setConfig: (c: FilterConfig) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current = filter.current?.(config) ?? ''
  const contentRef = useRef<HTMLDivElement | null>(null)

  /**
   * Radix's focus scope focuses the first tabbable element with
   * `select: true`, which highlighted the whole number in any popover
   * holding a field. Racing it with a collapse-the-selection effect
   * made the highlight intermittent instead of gone (whichever ran
   * last won). So auto-focus is prevented outright and the first
   * control is focused by hand — `.focus()` selects nothing.
   */
  function focusFirstControl(event: Event) {
    event.preventDefault()
    const target = contentRef.current?.querySelector<HTMLElement>('input, [role="menuitem"]')
    target?.focus({ preventScroll: true })
  }

  // A chip with no ✕ reserves no room for one: `pr-1` here plus the
  // trigger's own `pr-2` left a label-less chip reading off-centre.
  const removable = !filter.required
  const label = filter.chipLabel ?? filter.label

  return (
    <span
      className={`inline-flex h-8 items-center rounded-pill border border-border bg-surface transition-colors hover:border-border-strong${
        removable ? ' pr-1' : ''
      }`}
    >
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`inline-flex h-full cursor-pointer items-center gap-2 rounded-pill pl-3 text-body${
              removable ? ' pr-2' : ' pr-3'
            }`}
          >
            {/* Empty when the chip is one of several parts of a phrase
                (the branch's conditions), where a name per pill would
                be noise. The span is dropped entirely rather than
                rendered blank, which left a `gap-2` hanging in front
                of the value. */}
            {label ? <span className="text-text-muted">{label}</span> : null}
            <span className="font-medium text-text">{filter.valueLabel(config)}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            ref={contentRef}
            align="start"
            sideOffset={6}
            // z-[90] is the shared popover tier (see the design-system
            // Select): above a base modal's z-[60] panel, below the
            // confirm-dialog tier. At z-50 these opened *behind* the
            // modal that contains them.
            className="z-[90]"
            onOpenAutoFocus={focusFirstControl}
          >
            {filter.options && filter.apply ? (
              <MenuPanel
                {...(filter.panelWidth ? { width: filter.panelWidth } : {})}
                className="max-h-72 overflow-y-auto"
              >
                {filter.options.map((option) => (
                  <MenuItem
                    key={option.value}
                    selected={option.value === current}
                    trailing={
                      option.value === current ? <Check size={14} strokeWidth={1.5} /> : null
                    }
                    onClick={() => {
                      setConfig(filter.apply!(config, option.value))
                      onOpenChange(false)
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            ) : (
              // Same panel as the option lists, and no extra padding:
              // compound controls own their own rows so the two kinds
              // of popover read as one control.
              <MenuPanel {...(filter.panelWidth ? { width: filter.panelWidth } : {})}>
                {filter.render?.(config, setConfig)}
              </MenuPanel>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {removable && (
        <button
          type="button"
          onClick={() => setConfig(filter.remove(config))}
          className="ml-0.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-pill text-text-subtle transition-colors hover:bg-surface-muted hover:text-danger"
          aria-label={`Remove ${filter.label} filter`}
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      )}
    </span>
  )
}

/**
 * Build the `isActive` / `add` / `remove` trio for a filter whose whole
 * state is a fixed set of config keys, the common case. `add` writes
 * `defaults`, `remove` clears every key in it.
 *
 * Each value in `defaults` must satisfy the trigger's Zod schema. Two
 * constraints meet here: a freshly-added filter has to read as active
 * before the MC picks a value (or the chip disappears on the next
 * render), and the dispatcher re-validates the saved config on every
 * event, and a placeholder the schema rejects is a silently dead
 * automation. The "nothing chosen yet" value is therefore `''` for
 * free text and the enum's own `'any'` member for enums, both of which
 * the matcher already reads as "no narrowing".
 */
export function fieldFilter(
  defaults: FilterConfig,
): Pick<TriggerFilterDef, 'isActive' | 'add' | 'remove'> {
  const keys = Object.keys(defaults)
  return {
    isActive: (config) => keys.some((k) => config[k] !== undefined),
    add: (config) => ({ ...config, ...defaults }),
    remove: (config) => {
      const next = { ...config }
      for (const key of keys) delete next[key]
      return next
    },
  }
}

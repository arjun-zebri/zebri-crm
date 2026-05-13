'use client'

import * as Popover from '@radix-ui/react-popover'

interface ColorPopoverProps {
  value: string
  onChange: (v: string) => void
  swatches?: readonly string[]
  trigger: React.ReactNode
  align?: 'start' | 'end' | 'center'
}

export function ColorPopover({
  value,
  onChange,
  swatches = [],
  trigger,
  align = 'start',
}: ColorPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[220px] animate-modal-in"
        >
          <div className="flex items-center gap-2 mb-3">
            <label className="relative w-9 h-9 rounded-lg ring-1 ring-black/10 cursor-pointer overflow-hidden shrink-0">
              <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="absolute inset-0" style={{ background: value }} />
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
              placeholder="#000000"
            />
          </div>
          {swatches.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  title={c}
                  className={`w-7 h-7 rounded-md ring-1 ring-black/10 hover:scale-110 transition cursor-pointer ${
                    value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-gray-900 ring-offset-1' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

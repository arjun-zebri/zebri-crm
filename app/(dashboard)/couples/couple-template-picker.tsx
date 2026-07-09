/**
 * Template picker popover for the couple Templates tab.
 *
 * Mirrors the Automations run-picker: a Radix popover anchored to the
 * Test / Send button listing the MC's email templates. Picking one
 * doesn't fire immediately. It hands the template up to the parent,
 * which opens the compose modal (live preview + missing-variable fill)
 * pre-selected to that template.
 *
 * @module app/(dashboard)/couples/couple-template-picker
 */
'use client'

import * as Popover from '@radix-ui/react-popover'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical, Mail } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Mode = 'send' | 'test'

interface TemplateRow {
  id: string
  name: string
  /** Joined category (the user's grouping), when the template has one. */
  category: { name: string } | null
}

const MODE = {
  send: { label: 'Send email', variant: 'primary' as const, icon: Mail, hint: 'Pick a template to send this couple' },
  test: { label: 'Test', variant: 'outline' as const, icon: FlaskConical, hint: 'Pick a template. The test comes to your inbox' },
}

interface Props {
  mode: Mode
  /** Fired with the chosen template id; the parent opens the preview modal. */
  onPick: (templateId: string) => void
}

/** Pulsing placeholder rows shown while the template list loads. */
function PickerSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="h-3.5 flex-1 animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  )
}

export function CoupleTemplatePicker({ mode, onPick }: Props) {
  const cfg = MODE[mode]
  const Icon = cfg.icon
  const [open, setOpen] = useState(false)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates-picker'],
    enabled: open,
    queryFn: async (): Promise<TemplateRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase.from('email_templates').select('id, name, category:email_template_categories(name)').order('position')
      if (error) throw error
      return (data ?? []) as TemplateRow[]
    },
  })

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant={cfg.variant} size="sm" className="cursor-pointer gap-1.5">
          <Icon size={14} strokeWidth={1.5} /> {cfg.label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[80] w-72 rounded-xl border border-border bg-surface py-1.5 shadow-lg"
        >
          <p className="px-3 py-1.5 text-xs text-text-subtle">{cfg.hint}</p>
          {isLoading ? (
            <PickerSkeleton />
          ) : (templates ?? []).length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-text-muted">No templates yet. Add some on the Templates page.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {(templates ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onPick(t.id)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-text transition hover:bg-surface-muted cursor-pointer"
                >
                  <span className="truncate">{t.name}</span>
                  {t.category && (
                    <span className="shrink-0 text-xs text-text-subtle">{t.category.name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

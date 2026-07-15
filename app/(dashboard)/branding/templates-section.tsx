'use client'

import type { SurfaceTab } from '@/types/branding-preview'

import { templatesForSurface } from './templates'

interface TemplatesSectionProps {
  surface: SurfaceTab
  applyTemplate: (id: string) => void
}

/**
 * Template picker — displays available templates for the current surface as cards.
 *
 * Each card shows the template name and description. Clicking applies the template
 * to replace that surface's block layout only (does not touch tokens or other surfaces).
 */
export function TemplatesSection({ surface, applyTemplate }: TemplatesSectionProps) {
  const templates = templatesForSurface(surface)

  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => applyTemplate(tpl.id)}
          className="rounded-xl border border-border hover:border-border-strong bg-surface-muted hover:bg-surface text-left transition cursor-pointer p-3 min-h-[92px] flex flex-col gap-1.5"
          title={`Apply ${tpl.name}`}
        >
          <p className="text-sm font-medium text-text truncate">{tpl.name}</p>
          <p className="text-xs text-text-muted leading-snug line-clamp-2">{tpl.description}</p>
        </button>
      ))}
    </div>
  )
}

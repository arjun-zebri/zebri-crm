'use client'

import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

import type { SurfaceTab } from '@/types/branding-preview'

import { templatesForSurface } from './templates'

interface TemplatesSectionProps {
  surface: SurfaceTab
  applyTemplate: (id: string) => void
  resetToTemplate?: () => void
}

/**
 * Template picker — displays available templates for the current surface as cards.
 *
 * Each card shows the template name and description. Clicking applies the template
 * to replace that surface's block layout only (does not touch tokens or other surfaces).
 *
 * If resetToTemplate is provided, shows a reset button that applies the surface's template.
 */
export function TemplatesSection({ surface, applyTemplate, resetToTemplate }: TemplatesSectionProps) {
  const templates = templatesForSurface(surface)
  const [armedReset, setArmedReset] = useState(false)

  const handleResetClick = () => {
    if (armedReset) {
      resetToTemplate?.()
      setArmedReset(false)
    } else {
      setArmedReset(true)
    }
  }

  return (
    <div className="space-y-3">
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

      {resetToTemplate && templates.length > 0 && (
        <button
          type="button"
          onClick={handleResetClick}
          className={`w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-sm font-medium transition cursor-pointer ${
            armedReset
              ? 'bg-red-50 hover:bg-red-100 text-red-700'
              : 'bg-surface-muted hover:bg-surface text-text border border-border'
          }`}
          title="Reset this page to its template"
        >
          <RotateCcw size={14} strokeWidth={1.5} />
          {armedReset ? 'Reset design?' : 'Reset to template'}
        </button>
      )}
    </div>
  )
}

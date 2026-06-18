/**
 * Missing-variable panel for the couple Send-email modal.
 *
 * Lists every variable the template can't fill from the couple's data
 * and lets the MC type a value inline. These fills are temporary — used
 * for this one send only, never written back to the couple record.
 *
 * @module app/(dashboard)/couples/send-email-missing-panel
 */
'use client'

import { AlertTriangle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { variableLabel } from '@/lib/automations/variables'
import type { VariableOverrides } from '@/lib/email/templates'

interface MissingPanelProps {
  missing: string[]
  overrides: VariableOverrides
  onChange: (next: VariableOverrides) => void
}

export function SendEmailMissingPanel({ missing, overrides, onChange }: MissingPanelProps) {
  if (missing.length === 0) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
        <AlertTriangle size={16} strokeWidth={1.5} />
        Fill these before sending
      </div>
      <p className="mb-3 text-xs text-amber-800">
        This couple is missing some details. Type a value to use just for this email — it won&apos;t change their record.
      </p>
      <div className="space-y-2">
        {missing.map((path) => (
          <Input
            key={path}
            label={variableLabel(path)}
            size="sm"
            value={overrides[path] ?? ''}
            onChange={(e) => onChange({ ...overrides, [path]: e.target.value })}
            placeholder={`Enter ${variableLabel(path).toLowerCase()}`}
          />
        ))}
      </div>
    </div>
  )
}

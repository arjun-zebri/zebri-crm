'use client'

import type { ReactNode } from 'react'

/**
 * A toolbar control with a small caption above it saying what it edits,
 * mirroring the toolbar's existing label style. Shared by the form-field
 * controls and every proposal block's controls: a row of otherwise
 * unlabelled inputs (a bare Select, a bare Input) doesn't explain itself.
 *
 * @module app/(dashboard)/branding/blocks/proposal/labelled-control
 */
export function LabelledControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-subtle uppercase tracking-[0.08em]">{label}</span>
      {children}
    </div>
  )
}

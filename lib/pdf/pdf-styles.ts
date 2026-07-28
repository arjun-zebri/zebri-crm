/**
 * PDF typography and styling as CSS custom properties.
 *
 * Converts PublicBranding into a `:root` block of CSS custom properties
 * for use in PDF HTML generators. All font sizes are derived via the same
 * `type-scale.ts` module the web renderers use, so PDFs and web surfaces
 * cannot drift again.
 *
 * @module lib/pdf/pdf-styles
 */

import type { PublicBranding } from '@/lib/branding/public-branding'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { roleSizePx, type TypeRole } from '@/lib/branding/type-scale'

/**
 * Emit CSS custom properties for every role and colour.
 *
 * The PDF builders inject this `:root` block into their `<head>`, then
 * replace all hardcoded font sizes and colours with `var(--pdf-*)`
 * references. This ensures PDFs scale with the global typography settings
 * and honour the MC's brand palette.
 *
 * Font sizes are derived from `roleSizePx`, the same helper the web
 * renderers use, so both channels apply the global `heading_size` and
 * `body_size` settings uniformly.
 *
 * @param branding - The PublicBranding object with global type and colour settings.
 * @returns        A `:root { ... }` CSS block ready to inject into `<style>`.
 */
export function pdfTypeCss(branding: PublicBranding): string {
  const roles: TypeRole[] = [
    'docTitle',
    'sectionHeading',
    'total',
    'subtitle',
    'body',
    'finePrint',
    'sectionLabel',
  ]

  // Build size declarations.
  const sizes = roles
    .map(role => {
      const px = roleSizePx(role, branding.heading_size, branding.body_size)
      const cssName = role === 'docTitle' ? 'doc-title'
        : role === 'sectionHeading' ? 'section-heading'
        : role === 'finePrint' ? 'fine-print'
        : role === 'sectionLabel' ? 'section-label'
        : role
      return `    --pdf-${cssName}: ${px}px;`
    })
    .join('\n')

  // Build colour declarations: which roles draw from which colour field.
  // The roles and their colour sources are defined in lib/branding/type-defaults.ts.
  const colorMappings: Array<{ role: string; color: string }> = [
    { role: 'doc-title', color: branding.heading_color },
    { role: 'section-heading', color: branding.heading_color },
    { role: 'total', color: branding.heading_color },
    { role: 'subtitle', color: branding.subheading_color },
    { role: 'section-label', color: branding.subheading_color },
    { role: 'body', color: branding.text_color },
    { role: 'fine-print', color: branding.text_color },
  ]

  const colors = colorMappings
    .map(({ role, color }) => `    --pdf-${role}-color: ${color};`)
    .join('\n')

  // Border colour — used for hairlines and table dividers.
  const border = `    --pdf-border: ${branding.border_color};`

  // Audit trail section: success-tinted surfaces (contract signing confirmation).
  // Background and border use semi-transparent success color for a subtle tint.
  // Text uses the opaque success color for emphasis.
  const auditTrailBg = '#F0FDF4' // Light success tint (fallback, browser renders well)
  const auditTrailBorder = '#BBEDD5' // Medium success tint
  const auditTrailText = STATUS_COLORS.success // Opaque success green

  // Bank details background: neutral light surface.
  const bankDetailsBg = '#FAFAFA' // Neutral light surface (fallback)

  const accents = `    --pdf-audit-bg: ${auditTrailBg};
    --pdf-audit-border: ${auditTrailBorder};
    --pdf-audit-text: ${auditTrailText};
    --pdf-bank-bg: ${bankDetailsBg};`

  return `:root {\n${sizes}\n${colors}\n${border}\n${accents}\n  }`
}

/**
 * Turn a saved schedule's template stages into a short, human summary such as
 * "25%, then remainder". The library list and the invoice empty state both
 * render this instead of prose stored in the database, so a summary can never
 * drift from the stages it describes.
 *
 * @module lib/payments/describe-schedule
 */
import type { TemplateStage } from '@/types/payment-schedule'

/** The amount portion of one stage: "25%", "$500", or "remainder". */
function token(stage: TemplateStage): string {
  if (stage.amountType === 'remainder') return 'remainder'
  if (stage.amountType === 'fixed') return `$${String(stage.amountValue ?? 0)}`
  return `${String(stage.amountValue ?? 0)}%`
}

/**
 * Summarise a schedule's shape from its stages.
 *
 * A trailing remainder reads as ", then remainder" so the common
 * deposit-plus-balance shape is obvious at a glance; everything else is a
 * plain comma-joined list. Zero stages means a single-payment invoice.
 */
export function describeSchedule(stages: TemplateStage[]): string {
  if (stages.length === 0) return 'Single payment'
  const tokens = stages.map(token)
  const last = stages[stages.length - 1]
  if (stages.length > 1 && last?.amountType === 'remainder') {
    return `${tokens.slice(0, -1).join(', ')}, then remainder`
  }
  return tokens.join(', ')
}

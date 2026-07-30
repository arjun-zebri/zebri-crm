/**
 * Multi-stage payment schedule, used by both rendering paths
 * (branded block-tree + hardcoded fallback). Maps over `invoice.stages`
 * to render N payment rows instead of the previous hardcoded
 * deposit + final model.
 *
 * Rules:
 * - Only the earliest unpaid stage gets a Pay button; the route
 *   enforces this server-side.
 * - Later unpaid stages show "Available once the previous payment clears".
 * - Paid stages show a Paid check and no button.
 * - A pay-in-full action appears below the list only when multiple
 *   stages remain unpaid.
 *
 * The "Paid" check uses STATUS_COLORS.success; brand colours flow
 * through the PayWithCardButton via the branding prop.
 *
 * @module app/invoice/[token]/_components/invoice-payment-schedule
 */
import { CheckCircle } from 'lucide-react';

import { getRgb } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { STATUS_COLORS } from '@/lib/branding/status-colors';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { PayWithCardButton } from '../pay-with-card-button';

import { formatCurrency, formatDate, type PublicInvoice } from './public-invoice';

export interface InvoicePaymentScheduleProps {
  invoice: PublicInvoice;
  /** Id of the earliest unpaid stage, the only one with a live Pay button. */
  nextPayableStageId: string | null;
  showPayButtons: boolean;
  /** Global branding for type scale, colours, and fonts. */
  branding: PublicBranding;
  /** Action block overrides for button color and radius. Required. */
  actionStyle: { color: string; radius: number } | null;
}

export function InvoicePaymentSchedule({
  invoice,
  nextPayableStageId,
  showPayButtons,
  branding,
  actionStyle,
}: InvoicePaymentScheduleProps) {
  const bodyDefaults = roleDefaults(branding, 'body');
  const finePrintDefaults = roleDefaults(branding, 'finePrint');

  // Compute soft-opacity border for schedule rows.
  // Composited from branding colour to avoid Zebri app-chrome tokens.
  const borderRgb = getRgb(branding.border_color);
  const borderColorHalf = borderRgb
    ? `rgba(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]}, 0.5)`
    : branding.border_color;

  const stages = invoice.stages ?? [];
  // Count how many stages remain unpaid to determine pay-in-full visibility.
  const unpaidCount = stages.filter((s) => !s.paid_at).length;

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => (
        <div
          key={stage.id}
          className={`py-2.5 ${idx < stages.length - 1 ? 'border-b' : ''}`}
          style={idx < stages.length - 1 ? { borderBottomColor: borderColorHalf } : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <span
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {stage.label}
              </span>
              {stage.due_date ? (
                <span
                  className="block"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: finePrintDefaults.color,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  Due {formatDate(stage.due_date)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="font-medium tabular-nums"
                style={{
                  fontSize: `${bodyDefaults.fontSize}px`,
                  color: bodyDefaults.color,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                  fontWeight: bodyDefaults.fontWeight,
                  lineHeight: bodyDefaults.lineHeight,
                }}
              >
                {formatCurrency(stage.amount_cents / 100)}
              </span>
              {stage.paid_at ? (
                <span
                  className="flex items-center gap-1"
                  style={{
                    fontSize: `${finePrintDefaults.fontSize}px`,
                    color: STATUS_COLORS.success,
                    fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                    fontWeight: finePrintDefaults.fontWeight,
                    lineHeight: finePrintDefaults.lineHeight,
                  }}
                >
                  <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Paid
                </span>
              ) : null}
            </div>
          </div>
          {/* Only the earliest unpaid stage is payable; later ones show
              an explanatory message instead. */}
          {showPayButtons && actionStyle && stage.id === nextPayableStageId ? (
            <div className="mt-2">
              <PayWithCardButton
                invoiceId={invoice.id}
                shareToken={invoice.share_token}
                branding={branding}
                actionStyle={actionStyle}
                paymentType="stage"
                stageId={stage.id}
                label={`Pay ${stage.label.toLowerCase()}`}
              />
            </div>
          ) : !stage.paid_at && stage.id !== nextPayableStageId ? (
            <span
              className="mt-2 block"
              style={{
                fontSize: `${finePrintDefaults.fontSize}px`,
                color: finePrintDefaults.color,
                fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
                fontWeight: finePrintDefaults.fontWeight,
                lineHeight: finePrintDefaults.lineHeight,
              }}
            >
              Available once the previous payment clears
            </span>
          ) : null}
        </div>
      ))}

      {/* Pay-in-full action: only show when multiple stages remain unpaid.
          With a single stage, the stage's own button would duplicate this. */}
      {showPayButtons && actionStyle && unpaidCount > 1 ? (
        <div className="pt-2">
          <PayWithCardButton
            invoiceId={invoice.id}
            shareToken={invoice.share_token}
            branding={branding}
            actionStyle={actionStyle}
            paymentType="remaining"
            label="Pay remaining balance"
          />
        </div>
      ) : null}
    </div>
  );
}

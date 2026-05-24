/**
 * Vertical-timeline payment schedule for the Invoice builder.
 *
 * Replaces the previous two-card layout (`invoice-payment-schedule.tsx`).
 *
 * ```
 * ● Deposit  30% · $2,805  Paid 12 Jun  ✓
 * ┊
 * ○ Final    70% · $6,545  Due 14 Aug   [Mark paid]
 * ```
 *
 * - Filled dot when the stage is paid; hollow dot when it's still due.
 * - State pill inline (Paid / Due).
 * - Vertical `┊` connector between the two stages — drawn with a
 *   single `border-l` div.
 * - Each stage has its own "Mark paid" button when actionable.
 * - The deposit % is editable until the deposit is marked paid; the
 *   final % is always `100 - deposit`.
 *
 * @module components/builders/parts/payment-schedule
 */
'use client';

import { useEffect, useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';
import { StatePill } from '@/components/ui/state-pill';

// Shared field styling so the % input + DatePicker + Mark paid
// button all line up at the same height + corner radius. Matches
// the DatePicker primitive (`rounded-xl px-3 py-2 text-sm`) so we
// don't have to override the primitive in this one spot.
const FIELD_CLS =
  'h-9 inline-flex items-center rounded-xl border border-border bg-surface px-3 text-sm text-text transition-colors';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export interface PaymentScheduleProps {
  canEdit: boolean;
  depositPercent: number;
  depositDueDate: string;
  finalDueDate: string;
  depositPaidAt: string | null;
  finalPaidAt: string | null;
  depositAmount: number;
  finalAmount: number;
  onDepositPercentChange: (v: number) => void;
  onDepositDueDateChange: (v: string) => void;
  onFinalDueDateChange: (v: string) => void;
  onMarkDepositPaid: () => void;
  onMarkFinalPaid: () => void;
  /** Removes the schedule entirely (back to single due-date invoice). */
  onRemove?: () => void;
  markDepositPending: boolean;
  markFinalPending: boolean;
}

export function PaymentSchedule({
  canEdit,
  depositPercent,
  depositDueDate,
  finalDueDate,
  depositPaidAt,
  finalPaidAt,
  depositAmount,
  finalAmount,
  onDepositPercentChange,
  onDepositDueDateChange,
  onFinalDueDateChange,
  onMarkDepositPaid,
  onMarkFinalPaid,
  onRemove,
  markDepositPending,
  markFinalPending,
}: PaymentScheduleProps) {
  // Local %-input state so the parent isn't spammed on every keystroke
  // (commits onBlur).
  const [percentStr, setPercentStr] = useState(String(depositPercent));
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => {
    if (!isFocused) setPercentStr(String(depositPercent));
  }, [depositPercent, isFocused]);

  const depositPaid = Boolean(depositPaidAt);
  const finalPaid = Boolean(finalPaidAt);

  // Removal is only sensible while nothing has been paid — once a
  // payment is recorded the schedule must stay on the invoice.
  const canRemove = canEdit && !depositPaid && !finalPaid && Boolean(onRemove);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-caption font-medium uppercase tracking-wide text-text-muted">
          Payment schedule
        </h4>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-caption text-text-muted hover:text-danger transition-colors cursor-pointer"
          >
            Remove schedule
          </button>
        ) : null}
      </div>

      <div className="relative pl-7">
        {/* Vertical connector between the two dots */}
        <div
          aria-hidden
          className="absolute left-2.5 top-3 bottom-3 w-px border-l border-dashed border-border"
        />

        {/* Deposit row */}
        <Stage
          dot={depositPaid ? 'filled' : 'hollow'}
          tone={depositPaid ? 'success' : 'warning'}
          label="Deposit"
          percent={depositPercent}
          amount={depositAmount}
          dueLabel={
            depositPaid
              ? `Paid ${formatDateShort(depositPaidAt)}`
              : `Due ${formatDateShort(depositDueDate) ?? '—'}`
          }
          state={{ label: depositPaid ? 'Paid' : 'Due', tone: depositPaid ? 'success' : 'warning' }}
        >
          {/* Editor row — only visible when actionable. */}
          {!depositPaid && canEdit ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className={`${FIELD_CLS} gap-1`}>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={percentStr}
                  onChange={(e) => setPercentStr(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    setIsFocused(false);
                    const v = Math.min(99, Math.max(1, Number(percentStr) || 1));
                    setPercentStr(String(v));
                    onDepositPercentChange(v);
                  }}
                  aria-label="Deposit percentage"
                  className="w-10 bg-transparent text-sm text-text tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm text-text-muted">%</span>
              </div>
              <DatePicker value={depositDueDate} onChange={onDepositDueDateChange} />
              <button
                type="button"
                onClick={onMarkDepositPaid}
                disabled={markDepositPending}
                className={`${FIELD_CLS} text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50 cursor-pointer`}
              >
                {markDepositPending ? 'Saving…' : 'Mark paid'}
              </button>
            </div>
          ) : null}
        </Stage>

        {/* Final row */}
        <div className="mt-6">
          <Stage
            dot={finalPaid ? 'filled' : 'hollow'}
            tone={finalPaid ? 'success' : 'warning'}
            label="Final"
            percent={100 - depositPercent}
            amount={finalAmount}
            dueLabel={
              finalPaid
                ? `Paid ${formatDateShort(finalPaidAt)}`
                : `Due ${formatDateShort(finalDueDate) ?? '—'}`
            }
            state={{ label: finalPaid ? 'Paid' : 'Due', tone: finalPaid ? 'success' : 'warning' }}
          >
            {!finalPaid && canEdit && depositPaid ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DatePicker value={finalDueDate} onChange={onFinalDueDateChange} />
                <button
                  type="button"
                  onClick={onMarkFinalPaid}
                  disabled={markFinalPending}
                  className={`${FIELD_CLS} text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50 cursor-pointer`}
                >
                  {markFinalPending ? 'Saving…' : 'Mark paid'}
                </button>
              </div>
            ) : null}
          </Stage>
        </div>
      </div>
    </div>
  );
}

/* ─── Stage row ─────────────────────────────────────────────────── */

interface StageProps {
  dot: 'filled' | 'hollow';
  tone: 'success' | 'warning';
  label: string;
  percent: number;
  amount: number;
  dueLabel: string | null;
  state: { label: string; tone: 'success' | 'warning' };
  children?: React.ReactNode;
}

function Stage({ dot, tone, label, percent, amount, dueLabel, state, children }: StageProps) {
  return (
    <div className="relative">
      {/* Dot on the timeline */}
      <span
        aria-hidden
        className={`absolute -left-7 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full ${
          dot === 'filled'
            ? tone === 'success'
              ? 'bg-success'
              : 'bg-warning'
            : `border-2 ${tone === 'success' ? 'border-success' : 'border-warning'} bg-surface`
        }`}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-text">{label}</span>
        <span className="text-caption text-text-muted tabular-nums">
          {percent}% · {formatCurrency(amount)}
        </span>
        {dueLabel ? <span className="text-caption text-text-muted">{dueLabel}</span> : null}
        <span className="ml-auto">
          <StatePill label={state.label} tone={state.tone} dot={dot} />
        </span>
      </div>
      {children}
    </div>
  );
}

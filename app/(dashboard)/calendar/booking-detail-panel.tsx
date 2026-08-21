'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useQueryClient } from '@tanstack/react-query';
import { Video } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatePill } from '@/components/ui/state-pill';
import { TimeSelect } from '@/components/ui/time-select';
import { useToast } from '@/components/ui/toast';
import { zonedTimeToUtc, zonedDateParts } from '@/lib/scheduling/timezone';

import { cancelBookingAction, rescheduleBookingAction } from './booking-actions';
import { BookingDetailFacts } from './booking-detail-facts';
import { BookingDetailSummary } from './booking-detail-summary';
import type { Booking } from './use-bookings';

export interface BookingDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking;
  /** MC's timezone. Every time on this surface is theirs, not the booker's. */
  mcTimezone?: string;
  /** Opens the couple profile behind the modal. Omit to keep the couple as text. */
  onSelectCouple?: (coupleId: string) => void;
}

/**
 * Modal for one booking: what it is, who booked it, and the two things an MC
 * can still change about it.
 *
 * Laid out like the quote and invoice builders: identity and state pill in
 * the header band, the contextual action (Join video call) beside the close
 * button, a `text-section` hero over a muted meta line, then label-and-value
 * rows. Cancel sits behind a confirmation because the booker is emailed. A
 * failed action keeps the modal open with its error rather than closing over
 * the problem.
 *
 * @module app/(dashboard)/calendar/booking-detail-panel
 */
export function BookingDetailPanel({
  isOpen,
  onClose,
  booking,
  mcTimezone = 'Australia/Melbourne',
  onSelectCouple,
}: BookingDetailPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Seed the reschedule fields from the booking's current slot, so opening
  // the form and saving without touching it is a no-op rather than a jump.
  useEffect(() => {
    if (!isOpen || !booking) return;
    const utcDate = new Date(booking.starts_at);
    const { date } = zonedDateParts(utcDate, mcTimezone);
    const time = utcDate.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: mcTimezone,
    });
    setRescheduleDate(date);
    setRescheduleTime(time);
  }, [isOpen, booking, mcTimezone]);

  // Reset error and mode state when the modal closes
  useEffect(() => {
    if (isOpen) return;
    setCancelError(null);
    setRescheduleError(null);
    setRescheduleMode(false);
  }, [isOpen]);

  if (!booking) return null;

  const isCancelled = booking.status === 'cancelled';
  const hasEnded = new Date(booking.ends_at).getTime() < new Date().getTime();
  const canJoin = Boolean(booking.video_join_url) && !isCancelled;

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelError(null);
    const result = await cancelBookingAction(booking.id);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast('Booking cancelled');
      onClose();
    } else {
      setCancelError(result.error);
    }
    setCancelLoading(false);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select a date and time');
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError(null);
    const startsAt = zonedTimeToUtc(rescheduleDate, rescheduleTime, mcTimezone).toISOString();
    const result = await rescheduleBookingAction(booking.id, startsAt, mcTimezone);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast('Booking rescheduled');
      setRescheduleMode(false);
      onClose();
    } else {
      setRescheduleError(result.error);
    }
    setRescheduleLoading(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        // Identity plus state pill in the header band, the same shape the
        // quote and invoice builders use, so a booking reads as one of the
        // app's documents rather than a one-off surface.
        title={
          <>
            <span className="text-text">Booking</span>
            <StatePill
              label={isCancelled ? 'Cancelled' : hasEnded ? 'Done' : 'Confirmed'}
              tone={isCancelled || hasEnded ? 'neutral' : 'success'}
              dot="filled"
            />
          </>
        }
        // The contextual next action lives in the header, beside the close
        // button, exactly like the builders' "Mark paid". Copy link sits
        // with it: both do the same job for the same call, one for the MC
        // and one for whoever they are about to send it to.
        headerActions={
          canJoin ? (
            <div className="flex items-center gap-2">
              <a
                href={booking.video_join_url ?? undefined}
                target="_blank"
                // noreferrer alongside noopener: the link leaves the app, and
                // the destination has no business reading where it came from.
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-control bg-brand-fg px-3 text-body font-medium text-text-inverse transition-opacity hover:opacity-90"
                data-testid="booking-join-link"
              >
                <Video size={14} strokeWidth={1.5} aria-hidden="true" />
                Join
              </a>
              <CopyButton
                value={booking.video_join_url ?? ''}
                label="Copy link"
                variant="outline"
              />
            </div>
          ) : undefined
        }
        footer={
          !isCancelled && (
            <div className="flex items-center justify-between gap-2">
              {/* Both footer slots stay bordered controls, so the left one
                  does not lose its edges when the modal flips into
                  reschedule mode. */}
              {rescheduleMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRescheduleMode(false);
                      setRescheduleError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button loading={rescheduleLoading} onClick={handleReschedule}>
                    Confirm reschedule
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setCancelConfirm(true)}>
                    Cancel booking
                  </Button>
                  <Button variant="outline" onClick={() => setRescheduleMode(true)}>
                    Reschedule
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        <div className="space-y-6">
          <BookingDetailSummary booking={booking} timeZone={mcTimezone} />

          <BookingDetailFacts
            booking={booking}
            timeZone={mcTimezone}
            {...(onSelectCouple && { onSelectCouple })}
          />

          {rescheduleMode && (
            <div>
              <h4 className="text-body font-semibold uppercase tracking-wider text-text">
                New time
              </h4>
              <div className="mt-3 space-y-3">
                <Input
                  type="date"
                  label="Date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
                <TimeSelect
                  value={rescheduleTime}
                  onChange={setRescheduleTime}
                  placeholder="Select time"
                />
                {rescheduleError && (
                  <p className="text-body text-danger" role="alert">
                    {rescheduleError}
                  </p>
                )}
              </div>
            </div>
          )}

          {cancelError && (
            <div
              className="rounded-control border border-danger bg-danger/10 p-3 text-body text-danger"
              role="alert"
            >
              {cancelError}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel booking"
        description="The booker will be notified by email. This cannot be undone."
        onConfirm={handleCancel}
        onCancel={() => setCancelConfirm(false)}
        loading={cancelLoading}
        confirmLabel="Cancel"
        loadingLabel="Cancelling..."
      />
    </>
  );
}

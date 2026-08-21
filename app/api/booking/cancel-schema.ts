/**
 * Validation for the public booking cancel request.
 *
 * @module app/api/booking/cancel-schema
 */
import { z } from 'zod';

/**
 * Cancel booking request payload.
 * manageToken is the booking's manage capability UUID.
 */
export const bookingCancelSchema = z.object({
  manageToken: z.uuid(),
});

export type BookingCancelInput = z.infer<typeof bookingCancelSchema>;

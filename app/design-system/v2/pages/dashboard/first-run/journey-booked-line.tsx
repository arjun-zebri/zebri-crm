/**
 * The line under Journeys' title on the arrival from the booking
 * celebration, in place of the page's own (leaving Journeys puts the
 * page's own back): the couple the MC just
 * booked is on their journey now, what is next (the planning call, the
 * MC's own step, so the line says what amber means by example), and what
 * Zebri does by itself. Nothing plays or moves: the journey is shown on
 * the MC's own booking, with dates from their own terms (founder,
 * 2026-10-08: a simulated couple walking the line "feels really cheap";
 * no Add your first client here, Home has it).
 *
 * @module app/design-system/v2/pages/dashboard/first-run/journey-booked-line
 */

export interface JourneyBookedLineProps {
  /** The couple just booked, "Clara & Felix". */
  couple: string;
  /** When their planning call is due, "26 Feb"; left out when they have no date. */
  planningBy: string | undefined;
  /** When Zebri sends their balance, "12 Mar"; left out when they have no date. */
  balanceOn: string | undefined;
}

/** The line. See {@link JourneyBookedLineProps}. */
export function JourneyBookedLine({ couple, planningBy, balanceOn }: JourneyBookedLineProps) {
  return (
    <p className="max-w-2xl text-pretty type-body text-zebra-500">
      {couple} are on your journey now. Next is their planning call, yours to do{planningBy ? ` by ${planningBy}` : ''}.
      Zebri sends their balance{balanceOn ? ` on ${balanceOn}` : ''} by itself.
    </p>
  );
}

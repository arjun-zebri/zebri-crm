/**
 * Zebri's side of the Workflows page, faked for the preview: the shape
 * of a drafted message and the one suggestion it has for a workflow the
 * MC is missing.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/zebri-chat
 */

export interface Draft {
  subject: string;
  body: string;
}

/** The one gap Zebri has noticed, shown on the Workflows tab. */
export const SUGGESTION = {
  /** The trigger whose absence makes it true. */
  trigger: 'invoice_overdue',
  text: 'You chased 4 late deposits by hand this month. Want Zebri to do it for you?',
  description: 'When an invoice goes overdue, email a friendly reminder, then 3 days later chase again, then if the deposit is not paid remind me to call',
};

/**
 * Ready-made workflows for an MC's year. The New workflow dialog puts
 * one in the box to edit first; with no workflows at all, the list
 * builds one in a click.
 */
export const STARTERS = [
  { label: 'Reply to every enquiry', text: "When a new enquiry comes in, reply within 15 minutes with my booking link, then send the proposal the next day, then if they haven't replied in 3 days follow up" },
  { label: 'Welcome a booked client', text: "When a proposal is accepted, send a welcome email straight away, then 2 days later send the questionnaire, then if the questionnaire isn't back in 5 days nudge them, then 8 weeks before the event book a planning call" },
  { label: 'Chase late payments', text: 'When an invoice goes overdue, email a friendly reminder, then 3 days later chase again, then if the deposit is not paid remind me to call' },
  { label: 'Thank them after the day', text: 'After the event, 2 days after the event send a thank you and ask for a review' },
];

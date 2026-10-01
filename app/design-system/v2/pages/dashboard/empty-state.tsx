/**
 * A page with nothing in it yet (a new account's Clients, Proposals or
 * Payments): a heading and one line of what will live here, sitting on
 * the backdrop in the middle of the screen. No panel: a white card
 * around "nothing yet" reads as an empty box, and the gradient is calmer.
 *
 * It fills what is left of the page under the title row (the page and
 * its tab panel stretch for it), and the bottom padding lifts it by
 * about half that row (more on a phone, where the row is taller), so it lands on the screen's middle rather than
 * the middle of the space below the title.
 *
 * @module app/design-system/v2/pages/dashboard/empty-state
 */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-1 px-4 pb-56 text-center md:pb-16">
      <p className="type-subheading text-zebra-950">{title}</p>
      <p className="max-w-md text-balance type-body text-zebra-500">{body}</p>
    </div>
  );
}

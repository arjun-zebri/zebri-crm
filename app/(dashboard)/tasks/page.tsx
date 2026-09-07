import { redirect } from 'next/navigation';

/**
 * The Tasks page retired into Workflows.
 *
 * Kept as a redirect rather than deleted: real users have this URL in
 * bookmarks and browser history. Their to-dos are now steps on a
 * couple's workflow, and the queue is the cross-couple view of them.
 */
export default function TasksRedirect() {
  redirect('/workflows');
}

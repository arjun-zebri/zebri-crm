import { redirect } from 'next/navigation';

/**
 * The Automations page retired into Workflows.
 *
 * Kept as a redirect rather than deleted: real users have this URL in
 * bookmarks and browser history. It lands on the template library, which
 * is where their automations now live as workflow templates.
 */
export default function AutomationsRedirect() {
  redirect('/workflows?tab=templates');
}

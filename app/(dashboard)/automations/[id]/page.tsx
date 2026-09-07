import { redirect } from 'next/navigation';

/**
 * A single automation's canvas, retired into the Workflows builder.
 *
 * An old automation id cannot be mapped to its converted template from
 * the URL alone, so this lands on the library rather than 404ing. The
 * MC's automations are all there under their original names.
 */
export default function AutomationCanvasRedirect() {
  redirect('/workflows?tab=templates');
}

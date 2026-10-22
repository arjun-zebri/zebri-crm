'use client';

import type { EmailBlock } from '../email/email-data';
import { EmailBody } from '../email/render/email-body';
import { quirksOf } from '../email/render/quirks';

/**
 * The brand kit's Email preview: a short email to a couple as it lands,
 * starting and ending as Settings > Email says (what heads it, the
 * signature), in the kit's colours and faces. The real email renderer, so
 * what is seen here is what every email does.
 *
 * @module app/design-system/v2/pages/dashboard/brand/kit-email-preview
 */

const SAMPLE: EmailBlock[] = [
  { kind: 'text', text: 'Hi Sarah and Tom,\n\nThank you for getting in touch. Your proposal is ready whenever you are, with everything we talked about.' },
  { kind: 'button', label: 'View your proposal' },
];

/** The preview. */
export function KitEmailPreview() {
  return (
    <div aria-hidden="true" inert className="overflow-hidden">
      <EmailBody blocks={SAMPLE} signature="full" quirks={quirksOf('apple', 'desktop', 10)} />
    </div>
  );
}

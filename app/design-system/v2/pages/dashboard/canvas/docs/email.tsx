'use client';

import { field, logo, page, part, rule, text } from './build';
import { businessFields, type DesignSpec } from './spec';
import { CtaButton } from './widgets/client-parts';

/**
 * Emails as a design: one 600px page, as email clients draw them. The
 * words come from each email template; the button (its link) and the
 * footer (who it is from, and how to stop hearing from the MC, which
 * Australia's Spam Act asks of marketing email) are locked.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/email
 */

/** What an email is filled from. */
export interface EmailData {
  subject: string;
  body: string;
  button: string;
}

const EMAIL_PAGE = { width: 600, height: 760 };

export const EMAIL: DesignSpec<EmailData> = {
  kind: 'email',
  label: 'Email',
  layout: () => ({
    id: 'email',
    kind: 'email',
    title: 'Email',
    pages: [
      page('email-1', [
        logo('logo', { x: 200, y: 40, w: 200, h: 40 }),
        field('subject', 'Heading', 'email.subject', 'subheading', { x: 48, y: 130, w: 504 }, { align: 'center' }),
        field('body', 'Message', 'email.body', 'body', { x: 48, y: 200, w: 504 }),
        part('button', 'Button', 'button', { x: 170, y: 420, w: 260, h: 48 }),
        rule('rule', { x: 48, y: 620, w: 504 }),
        field('foot', 'Footer', 'business.footer', 'body', { x: 48, y: 644, w: 504 }, { color: 'kit:muted', align: 'center', locked: true }),
        text('unsubscribe', 'Unsubscribe', 'Unsubscribe', 'body', { x: 48, y: 676, w: 504 }, { color: 'kit:muted', align: 'center', underline: true, locked: true }),
      ], EMAIL_PAGE),
    ],
  }),
  sample: () => ({
    subject: 'Your deposit invoice',
    body: 'Hi Sarah and Tom,\n\nThank you for choosing me for your day. Your deposit invoice is ready: paying it holds 12 March 2027 for you.\n\nSee you soon,\nArjun',
    button: 'Pay deposit',
  }),
  fill: (d, account) => {
    const b = businessFields(account);
    return {
      fields: { ...b.fields, 'email.subject': d.subject, 'email.body': d.body },
      fieldNames: { ...b.fieldNames, 'email.subject': 'Subject', 'email.body': 'Message' },
      widgets: { button: (size) => <CtaButton label={d.button} size={size} /> },
    };
  },
};

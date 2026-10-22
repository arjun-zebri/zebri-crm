'use client';

import { useState } from 'react';

import { EmailBuilder } from '../journeys/email-builder';
import { filled } from '../journeys/step-email';

import { blankEmail, saveEmailTemplate, useEmailTemplates, type EmailTemplate } from './email-templates';
import type { TemplateRow } from './kind-section';

/**
 * Emails, as one kind of document on the Documents page, on every
 * account: a row per email template, opening it in the email builder
 * Journeys uses (the email itself is the editor, in the MC's brand),
 * whose Design opens the canvas on the one email design every email
 * wears. New email opens the builder on a blank one, saved only on Save.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-email-documents
 */

/** Its subject as the sample couple gets it, so the row says what it is for. */
const lead = (t: EmailTemplate) => filled(t.email.subject) || 'No subject yet';

/** Emails for the Documents page. */
export function useEmailDocuments() {
  const templates = useEmailTemplates();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const write = () => setEditing(blankEmail());
  const rows: TemplateRow[] = templates.map((t) => ({
    key: t.id,
    name: t.name,
    detail: lead(t),
    note: `Edited ${t.edited}`,
    onOpen: () => setEditing(t),
  }));
  const isNew = editing !== null && !templates.some((t) => t.id === editing.id);
  return {
    rows,
    newDocument: write,
    newTemplate: write,
    dialogs: editing ? (
      <EmailBuilder
        key={editing.id}
        purpose={editing.name}
        renamable
        value={editing.email}
        draft={editing.email}
        button={editing.button}
        resetLabel="Undo changes"
        // Unchanged comes back undefined: a new one still saves, so New then Save keeps a blank to fill later.
        onSave={(email, name) => (email || isNew || name !== editing.name ? saveEmailTemplate({ ...editing, name, email: email ?? editing.email }) : undefined)}
        onClose={() => setEditing(null)}
      />
    ) : null,
  };
}

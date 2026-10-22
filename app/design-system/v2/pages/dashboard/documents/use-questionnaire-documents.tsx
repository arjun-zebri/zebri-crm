'use client';

import { useState } from 'react';

import { BuilderDialog } from '../questionnaires/builder/builder-dialog';
import { asked, newTemplate, titleOf, type Template } from '../questionnaires/questionnaire-data';
import { useSent, useTemplates } from '../questionnaires/questionnaire-store';

import type { TemplateRow } from './kind-section';

/**
 * Questionnaires, as one kind of document on the Documents page: a row
 * per questionnaire the MC has written, opening it in the builder. A questionnaire is always written as a template first and
 * sent from a client or a journey, so New questionnaire opens the
 * builder on a blank one.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-questionnaire-documents
 */

/** "12 questions · Sent to 3 clients". */
function statsOf(t: Template, sentTo: number) {
  const n = asked(t).length;
  return `${n} ${n === 1 ? 'question' : 'questions'} · ${sentTo ? `Sent to ${sentTo} ${sentTo === 1 ? 'client' : 'clients'}` : 'Not sent yet'}`;
}

/** Questionnaires for the Documents page. */
export function useQuestionnaireDocuments() {
  const templates = useTemplates();
  const sent = useSent();
  const [editing, setEditing] = useState<Template | null>(null);
  const write = () => setEditing(newTemplate());
  const rows: TemplateRow[] = templates.map((t) => ({
    key: t.id,
    name: titleOf(t),
    detail: statsOf(t, new Set(sent.filter((s) => s.templateId === t.id).map((s) => s.client)).size),
    note: `Edited ${t.edited}`,
    onOpen: () => setEditing(t),
  }));
  return {
    rows,
    newDocument: write,
    newTemplate: write,
    dialogs: <BuilderDialog key={editing?.id ?? 'closed'} template={editing} onClose={() => setEditing(null)} />,
  };
}

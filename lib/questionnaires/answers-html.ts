/**
 * Printable HTML for a questionnaire's answers.
 *
 * A self-contained, calm document the MC can print or save as PDF from the
 * couple profile (ceremony prep in hand at rehearsals). Pure string builder —
 * every dynamic value is HTML-escaped — so it's unit-testable and safe to
 * open in a new window.
 *
 * @module lib/questionnaires/answers-html
 */

import { QUESTION_TYPE_META, type Question, type Responses } from './question-schema'

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Formats a stored answer value for display. */
export function formatAnswer(value: Responses[string] | undefined): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/**
 * Builds the full printable document: title, couple + status line, then each
 * section heading and question/answer pair. Unanswered questions render a
 * quiet "No answer" so gaps are visible on paper too.
 */
export function answersPrintHtml(opts: {
  title: string
  coupleName: string
  completedAt: string | null
  questions: Question[]
  responses: Responses
}): string {
  const { title, coupleName, completedAt, questions, responses } = opts
  const blocks = questions
    .map((q) => {
      if (q.type === 'section') {
        return `<h2>${esc(q.label)}</h2>`
      }
      if (!QUESTION_TYPE_META[q.type].isInput) return ''
      const answer = formatAnswer(responses[q.id])
      return `<div class="qa"><p class="q">${esc(q.label)}</p>${
        answer ? `<p class="a">${esc(answer)}</p>` : '<p class="a none">No answer</p>'
      }</div>`
    })
    .join('\n')

  const completedLine = completedAt
    ? `Completed ${new Date(completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Not yet completed'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; max-width: 640px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 13px; margin: 0 0 28px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin: 28px 0 4px; }
  .qa { margin: 14px 0; page-break-inside: avoid; }
  .q { font-weight: 600; font-size: 14px; margin: 0 0 2px; }
  .a { font-size: 14px; margin: 0; white-space: pre-wrap; }
  .a.none { color: #9ca3af; font-style: italic; }
  @media print { body { margin: 0 auto; } }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(coupleName)} · ${esc(completedLine)}</p>
  ${blocks}
</body></html>`
}

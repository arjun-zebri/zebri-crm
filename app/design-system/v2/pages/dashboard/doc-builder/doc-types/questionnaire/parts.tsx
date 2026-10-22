'use client';

import type { Template } from '../../../questionnaires/questionnaire-data';
import { type DocParts, headingCss, PartText, roleCss, RULE } from '../../sections/parts/parts';

/**
 * A questionnaire's one working part, drawn for `template`: its name and
 * the line to the client, the questions with the room each answer takes,
 * and the button that sends the answers, in the brand colour and the
 * brand kit's button corners (white, on a coloured section). All of it is written in the questionnaire
 * builder, so the design only places and styles it.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/questionnaire/parts
 */

/** The parts for `template`. */
export function questionnaireParts(template: Template): DocParts {
  return {
    questions: ({ section, theme, branding }) => (
      <div className="space-y-10">
        <div className="space-y-3">
          <h2 style={headingCss(theme, 'heading2', section)}>{template.title.trim() || 'Your questionnaire'}</h2>
          {template.intro ? <PartText theme={theme} muted>{template.intro}</PartText> : null}
        </div>
        <ol className="space-y-8">
          {template.questions.map((q, n) => (
            <li key={q.id} className="space-y-2">
              <PartText theme={theme} strong>
                {n + 1}. {q.label || 'Your question'}
                {q.required ? ' *' : ''}
              </PartText>
              {q.help ? <PartText theme={theme} muted>{q.help}</PartText> : null}
              {q.options.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {q.options.map((o) => (
                    <span key={o} style={roleCss(theme, 'paragraph')} className={`rounded-pill border px-3 py-1 ${RULE}`}>
                      {o}
                    </span>
                  ))}
                </div>
              ) : (
                // The answer's line, in the section's own ink.
                <div className={`h-8 border-b ${RULE}`} />
              )}
            </li>
          ))}
        </ol>
        <span
          // The MC's brand colour and button corners: runtime values. On a
          // coloured section it turns white with brand words, or it would
          // vanish into a brand-colour background.
          style={{
            ...roleCss(theme, 'paragraph'),
            fontWeight: 600,
            borderRadius: branding.button_radius,
            ...(section.style.background ? { background: '#ffffff', color: branding.brand_color } : { background: branding.brand_color, color: '#ffffff' }),
          }}
          className="inline-flex items-center px-6 py-3"
        >
          Send my answers
        </span>
      </div>
    ),
  };
}

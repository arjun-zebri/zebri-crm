import { createIcon } from './icon-base';

/**
 * Questionnaire glyph: the run sheet clipboard with a question mark on it. For questionnaires.
 *
 * @example
 * ```tsx
 * <QuestionnaireIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/questionnaire
 */
export const QuestionnaireIcon = createIcon(
  'QuestionnaireIcon',
  'glyph',
  <>
    <rect x="4.5" y="4" width="15" height="18" rx="4" />
    <path d="M9.5 4a2.5 2.5 0 0 1 5 0" />
    <path d="M9.75 11a2.25 2.25 0 1 1 3.1 2.08c-.5.2-.85.62-.85 1.17v.75" />
    <path d="M12 17.75h0" />
  </>,
);

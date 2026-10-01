import { CalendarDays, FileText, Flag, GitBranch, Mail, SquareCheck, Workflow, type LucideIcon } from 'lucide-react';

import type { StepKind } from '../model';

/**
 * One plain icon per kind of step, drawn at 14px on a soft zebra-100
 * chip in the story, the add menu and the step panel.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/step-icons
 */

export const STEP_ICON: Record<StepKind, LucideIcon> = {
  email: Mail,
  todo: SquareCheck,
  appointment: CalendarDays,
  document: FileText,
  stage: Flag,
  if: GitBranch,
  start: Workflow,
};

/** What the step panel calls each kind. */
export const STEP_NAME: Record<StepKind, string> = {
  email: 'Email',
  todo: 'To-do',
  appointment: 'Meeting',
  document: 'Send a document',
  stage: 'Change stage',
  if: 'If',
  start: 'Start a workflow',
};

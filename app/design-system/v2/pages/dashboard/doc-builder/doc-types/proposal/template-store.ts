import { useMemo, useSyncExternalStore } from 'react';



import { TEMPLATES, templateOf, type Template, type TemplateId } from '../../../proposals/templates-data';
import type { DocLayout } from '../../model/types';
import { kept } from '../../state/kept';
import type { BookingTerms } from '../../state/use-doc-editor';

/**
 * Proposal templates as the MC has them: Zebri's four, any they edited,
 * and their own (made with New template, each starting from one of
 * Zebri's layouts). A template is addressed by its key: a built-in's id
 * ('full-day') or a custom one's ('custom-…'). A template the MC never
 * opened is Zebri's own page (`templateLayout`); once edited, its page
 * and booking terms live here and every new proposal from it starts from
 * them. Saved as the MC works, like a draft; "Back to Zebri's" drops it.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/template-store
 */

/** An edited template: its page (couple details as chips) and what saying yes sets going. */
export interface EditedTemplate {
  layout: DocLayout;
  terms: BookingTerms;
  at: number;
}

/** One of the MC's own templates: its name and the Zebri layout it grew from. */
export interface CustomTemplate {
  key: string;
  name: string;
  base: TemplateId;
  at: number;
}

/**
 * A template to pick: its key, and the template it reads as (a custom
 * one wears its base's words and packages under its own name).
 */
export interface TemplateChoice {
  key: string;
  template: Template;
  custom: boolean;
}

const edits = kept<EditedTemplate>('zebri-v2-proposal-templates');
const customs = kept<CustomTemplate>('zebri-v2-custom-templates');

/** The MC's edit of template `key`, or null while it is still as it started. */
export const readTemplate = (key: string): EditedTemplate | null => edits.read(key);

/** Saves the MC's edit of template `key`. */
export const writeTemplate = (key: string, t: EditedTemplate) => edits.write(key, t);

/** Puts template `key` back to the page it started as. */
export const clearTemplate = (key: string) => edits.remove(key);

const asChoice = (c: CustomTemplate): TemplateChoice => ({ key: c.key, custom: true, template: { ...templateOf(c.base), name: c.name, use: `Your own, from ${templateOf(c.base).name}` } });

/** The template `key` picks: a built-in, else one of the MC's own, else the first built-in. */
export function choiceOf(key: string): TemplateChoice {
  const built = TEMPLATES.find((t) => t.id === key);
  if (built) return { key, template: built, custom: false };
  const c = customs.read(key);
  return c ? asChoice(c) : { key: TEMPLATES[0]!.id, template: TEMPLATES[0]!, custom: false };
}

/** Makes one of the MC's own templates, starting from `base`'s page as it stands; returns its key. */
export function createTemplate(name: string, base: TemplateId): string {
  const key = `custom-${Date.now()}`;
  customs.write(key, { key, name, base, at: Date.now() });
  const from = edits.read(base);
  if (from) edits.write(key, { ...from, at: Date.now() });
  return key;
}

/** Removes one of the MC's own templates and its page. */
export function deleteTemplate(key: string) {
  customs.remove(key);
  edits.remove(key);
}

/**
 * The MC's edit of template `key`, kept current: a thumbnail or preview
 * re-renders the moment the template is saved. Null on the server, where
 * there is no browser storage, so the first paint matches it.
 */
export function useEditedTemplate(key: string): EditedTemplate | null {
  return useSyncExternalStore(edits.subscribe, () => edits.read(key), () => null);
}

// A stable snapshot for useSyncExternalStore: rebuilt only when the store changes.
let snapshot: CustomTemplate[] = [];
let stale = true;
customs.subscribe(() => {
  stale = true;
});
const readCustoms = () => {
  if (stale) {
    snapshot = customs.all();
    stale = false;
  }
  return snapshot;
};
const NONE: CustomTemplate[] = [];

/** Every template to pick from: Zebri's four, then the MC's own, oldest first. */
export function useTemplateChoices(): TemplateChoice[] {
  const own = useSyncExternalStore(customs.subscribe, readCustoms, () => NONE);
  return useMemo(() => [...TEMPLATES.map((t) => ({ key: t.id, template: t, custom: false })), ...own.map(asChoice)], [own]);
}

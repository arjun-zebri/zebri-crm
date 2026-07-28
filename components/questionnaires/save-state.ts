/**
 * Shared autosave-state vocabulary for the questionnaire fill surfaces.
 *
 * The fill page's autosave hook produces one of these, and both renderers
 * (typeform + classic form) display it, so a couple always knows whether the
 * answer they just typed made it to the server.
 *
 * @module components/questionnaires/save-state
 */

/** Lifecycle of the debounced autosave. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Human copy for each save state; empty string renders nothing. */
export function saveStateLabel(state: SaveState): string {
  switch (state) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return "Couldn't save. Check your connection"
    default:
      return ''
  }
}

/**
 * Focuses the first rich-text field of the item `itemId` inside the section
 * `sectionId` once React has painted it. Deferred with `requestAnimationFrame`
 * from the click handler that added the item (never an effect): the new
 * item's DOM does not exist until the dispatch above commits, and a fresh
 * "Add question" that leaves the caret on the button reads as broken (the
 * live check typed straight after clicking and the text went nowhere).
 * `attr` picks the id attribute to match: `data-item-id` for a list item,
 * `data-option-id` for a package card (stamped by the shared card).
 *
 * @module features/proposals/editor/data/focus-new-item
 */
export function focusNewItem(sectionId: string, itemId: string, attr: 'data-item-id' | 'data-option-id' = 'data-item-id'): void {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>(
      `[data-canvas-section-id="${sectionId}"] [${attr}="${itemId}"] .ProseMirror`,
    )
    field?.focus()
  })
}

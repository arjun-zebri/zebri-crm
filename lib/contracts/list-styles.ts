/**
 * Numbering formats for contract lists: `1.`, `1.1`, `(a)`, `(i)` and so on.
 *
 * A contract clause tree is nested ordered lists. Two attributes on the
 * `orderedList` node drive the markers, both drawn by the global
 * `ol[data-list-…]` `::marker` rules in `globals.css`, which is why one CSS
 * block serves the editor, both previews, the public page and the PDF alike:
 *
 * - `listStyle` (`data-list-style`): the format of one list. Each nested list
 *   is its own node, so every level can be styled independently.
 * - `listScheme` (`data-list-scheme`): a whole-tree preset on the outermost
 *   list. `legal` numbers the levels `1.` / `1.1` / `(a)` / `(i)` by depth, so
 *   a sub-list made later with Tab is numbered right without another pick.
 *   A `listStyle` on a list inside the tree overrides the scheme for that list.
 *
 * Typing a marker at the start of a line (`a. `, `(a) `, `i. `, `(i) `, `A. `,
 * `I. `, `1.1 `) starts a list in that format, as Word's automatic lists do.
 *
 * Security: the stored JSON is user-writable (contracts under RLS), so the
 * catalogues below are the allowlist. Anything else is dropped at render time,
 * and the sanitisers only admit the two attributes on `<ol>`.
 *
 * No React here: the server render imports this module too.
 *
 * @module lib/contracts/list-styles
 */
import { Extension, wrappingInputRule } from '@tiptap/core'
import { ListItem } from '@tiptap/extension-list'
import type { EditorState } from '@tiptap/pm/state'

/** One numbering format the picker offers. */
export interface ContractListStyle {
  /** Stored id; also the `data-list-style` value the CSS matches on. */
  id: string
  /** How the first marker reads; leads the menu row. */
  example: string
  /** Plain-words name for the menu row. */
  label: string
}

/**
 * The formats, in menu order. `decimal` is the default and is stored as
 * `null` (no attribute) so an untouched list renders exactly as before.
 */
export const CONTRACT_LIST_STYLES: readonly ContractListStyle[] = [
  { id: 'decimal', example: '1.', label: 'Numbers' },
  { id: 'decimal-outline', example: '1.1', label: 'Numbers with parent (1.1)' },
  { id: 'lower-alpha', example: 'a.', label: 'Letters' },
  { id: 'lower-alpha-paren', example: '(a)', label: 'Letters in brackets' },
  { id: 'upper-alpha', example: 'A.', label: 'Capital letters' },
  { id: 'lower-roman', example: 'i.', label: 'Roman numerals' },
  { id: 'lower-roman-paren', example: '(i)', label: 'Roman numerals in brackets' },
  { id: 'upper-roman', example: 'I.', label: 'Capital roman numerals' },
]

const LIST_STYLE_IDS = new Set(CONTRACT_LIST_STYLES.map((s) => s.id))

/** True when `value` is a catalogued format id. */
export function isContractListStyle(value: unknown): value is string {
  return typeof value === 'string' && LIST_STYLE_IDS.has(value)
}

/** The one whole-tree preset: `1.` / `1.1` / `(a)` / `(i)`, then `(i)` again. */
export const LEGAL_SCHEME = 'legal'

/** The format the Legal scheme gives each depth (0 = outermost). */
export const LEGAL_SCHEME_LEVELS: readonly string[] = [
  'decimal',
  'decimal-outline',
  'lower-alpha-paren',
  'lower-roman-paren',
]

/** True when `value` is a known scheme id. */
export function isContractListScheme(value: unknown): value is string {
  return value === LEGAL_SCHEME
}

/**
 * Autoformat triggers: the marker an MC types at the start of a line, and the
 * format it starts. Only the first marker of each format, so `a. ` fires but
 * `b. ` does not, which keeps a sentence such as "B. Smith agrees" intact.
 * `1. ` is StarterKit's own rule and stays a plain numbered list. `i. ` is
 * listed before the letters so it reads as roman, as Word treats it.
 */
const INPUT_RULES: readonly { find: RegExp; style: string }[] = [
  { find: /^\s*\(i\)\s$/, style: 'lower-roman-paren' },
  { find: /^\s*i\.\s$/, style: 'lower-roman' },
  { find: /^\s*I\.\s$/, style: 'upper-roman' },
  { find: /^\s*\(a\)\s$/, style: 'lower-alpha-paren' },
  { find: /^\s*a\.\s$/, style: 'lower-alpha' },
  { find: /^\s*A\.\s$/, style: 'upper-alpha' },
  { find: /^\s*\d+\.\d+\s$/, style: 'decimal-outline' },
]

/**
 * The format the list under the caret renders with: its own `listStyle`, else
 * the scheme's format for its depth, else `decimal`. `null` outside a list.
 * The toolbar's split button shows this.
 */
export function effectiveListStyle(state: EditorState): string | null {
  const { $from } = state.selection
  let own: string | null | undefined
  let depthInScheme = -1
  let scheme: string | null = null
  // Walk up to the outermost list, counting lists on the way. The nearest
  // list's own format is remembered; the scheme is whichever list declares it.
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'orderedList') continue
    if (own === undefined) own = isContractListStyle(node.attrs['listStyle']) ? node.attrs['listStyle'] : null
    depthInScheme++
    if (isContractListScheme(node.attrs['listScheme'])) {
      scheme = node.attrs['listScheme']
      break
    }
  }
  if (own === undefined) return null
  if (own) return own
  if (scheme === LEGAL_SCHEME) {
    return LEGAL_SCHEME_LEVELS[Math.min(depthInScheme, LEGAL_SCHEME_LEVELS.length - 1)] ?? 'decimal'
  }
  return 'decimal'
}

/**
 * StarterKit's list item, but admitting a heading as the item's first block.
 *
 * A clause title such as "1. Definitions" is a numbered heading, and with
 * the stock `paragraph block*` content the H1/H2 toolbar buttons silently
 * did nothing inside a list. Register this with
 * `StarterKit.configure({ listItem: false })` wherever `ContractListStyles`
 * is registered (editor and both server renders), so the stored JSON
 * round-trips identically. The `.contract-content` CSS sizes the marker to
 * match a heading item.
 */
export const ContractListItem = ListItem.extend({
  content: '(paragraph | heading) block*',

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // Enter at the end of a heading item starts the next item as a heading
      // of the same level, so clause titles run on ("1. Definitions", Enter,
      // "2. Services") without re-styling each one. `splitListItem` alone
      // gives the new item the schema's default block, a paragraph. Mid-title
      // it already splits into two headings, and an empty item still lifts
      // out of the list, so only the end-of-title case is special.
      Enter: () => {
        const { $from, empty } = this.editor.state.selection
        const block = $from.parent
        const atEnd = empty && $from.parentOffset === block.content.size
        const continueHeading = block.type.name === 'heading' && block.content.size > 0 && atEnd
        if (!continueHeading) return this.editor.commands.splitListItem(this.name)
        return this.editor
          .chain()
          .splitListItem(this.name)
          .setNode('heading', block.attrs)
          .run()
      },
    }
  },
})

/** The scheme on the outermost list around the caret, or null. */
export function activeListScheme(state: EditorState): string | null {
  const { $from } = state.selection
  for (let depth = 1; depth <= $from.depth; depth++) {
    const node = $from.node(depth)
    if (node.type.name === 'orderedList') {
      return isContractListScheme(node.attrs['listScheme']) ? node.attrs['listScheme'] : null
    }
  }
  return null
}

/**
 * Adds the `listStyle` and `listScheme` attributes to StarterKit's
 * `orderedList` node, the commands that set them, and the typing autoformats.
 *
 * A global attribute rather than `OrderedList.extend()`, so StarterKit's own
 * node (and its keymap and input rules) stays registered untouched. Register
 * this on both the editor and the server `generateHTML` call: an unregistered
 * attribute is silently dropped, which would revert every list to decimal in
 * the locked snapshot the couple signs.
 */
export const ContractListStyles = Extension.create({
  name: 'contractListStyles',

  addCommands() {
    return {
      setListStyle:
        (style) =>
        ({ chain, editor }) => {
          const listStyle = style === 'decimal' ? null : style
          const c = chain()
          if (!editor.isActive('orderedList')) c.toggleOrderedList()
          // Not `updateAttributes`: that walks every node spanning the
          // selection, so from inside a nested list it would restyle the
          // parent too. Walk up from the caret and mark only the first list.
          return c
            .command(({ tr }) => {
              const { $from } = tr.selection
              for (let depth = $from.depth; depth > 0; depth--) {
                const node = $from.node(depth)
                if (node.type.name === 'orderedList') {
                  tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, listStyle })
                  return true
                }
              }
              return false
            })
            .run()
        },

      setListScheme:
        (scheme) =>
        ({ chain, editor }) => {
          const c = chain()
          if (!editor.isActive('orderedList')) c.toggleOrderedList()
          return c
            .command(({ tr }) => {
              const { $from } = tr.selection
              // The outermost list is the shallowest one above the caret.
              let rootDepth = 0
              for (let depth = $from.depth; depth > 0; depth--) {
                if ($from.node(depth).type.name === 'orderedList') rootDepth = depth
              }
              if (rootDepth === 0) return false
              const rootPos = $from.before(rootDepth)
              const root = $from.node(rootDepth)
              // Positions are collected first: setNodeMarkup keeps sizes, so
              // they stay valid, but reading and writing in one pass is
              // harder to follow.
              const lists: number[] = []
              root.descendants((node, pos) => {
                if (node.type.name === 'orderedList') lists.push(rootPos + 1 + pos)
              })
              // A preset owns every level: per-list formats set earlier would
              // fight it, so they are cleared, on the root as well.
              tr.setNodeMarkup(rootPos, undefined, {
                ...root.attrs,
                listScheme: scheme,
                ...(scheme ? { listStyle: null } : {}),
              })
              if (scheme) {
                for (const pos of lists) {
                  const node = tr.doc.nodeAt(pos)
                  if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, listStyle: null })
                }
              }
              return true
            })
            .run()
        },
    }
  },

  addInputRules() {
    const type = this.editor.schema.nodes['orderedList']
    if (!type) return []
    return INPUT_RULES.map(({ find, style }) =>
      wrappingInputRule({
        find,
        type,
        getAttributes: () => ({ listStyle: style }),
        // The wrapping rule merges the new list into a same-type neighbour,
        // which turned "(a) " typed under a `1.` list into its item 3. Only
        // continue a list that is already in this format.
        joinPredicate: (_match, node) => node.attrs['listStyle'] === style,
      }),
    )
  },

  addGlobalAttributes() {
    return [
      {
        types: ['orderedList'],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute('data-list-style')
              return isContractListStyle(value) ? value : null
            },
            renderHTML: (attributes: { listStyle?: unknown }) =>
              // `decimal` is the default look, so it needs no attribute.
              isContractListStyle(attributes.listStyle) && attributes.listStyle !== 'decimal'
                ? { 'data-list-style': attributes.listStyle }
                : {},
          },
          listScheme: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute('data-list-scheme')
              return isContractListScheme(value) ? value : null
            },
            renderHTML: (attributes: { listScheme?: unknown }) =>
              isContractListScheme(attributes.listScheme)
                ? { 'data-list-scheme': attributes.listScheme }
                : {},
          },
        },
      },
    ]
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    contractListStyles: {
      /**
       * Set the numbering format of the ordered list under the caret,
       * starting one first if the caret is not in a list. `'decimal'` clears
       * the attribute.
       */
      setListStyle: (style: string) => ReturnType
      /**
       * Set (or with `null`, clear) the whole-tree preset on the outermost
       * list around the caret, starting a list first if there is none.
       * Setting a scheme clears every per-list format inside the tree.
       */
      setListScheme: (scheme: string | null) => ReturnType
    }
  }
}

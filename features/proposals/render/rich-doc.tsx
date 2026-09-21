'use client'

/**
 * React renderer for a v2 rich doc (spec §2.2, §6). One switch over the
 * spec's node list; marks wrap text; variables resolve from `ctx.values`
 * (falling back to the chip's own `fallback` attr when empty);
 * unknown nodes and unknown variable ids render nothing. Buttons with an
 * `accept` / `decline` / `jump` action call `ctx.onAction` (the page wires
 * these to the stepper); link buttons are real anchors. Print mode
 * degrades embeds and audio to links.
 *
 * Renders from JSON only, never stored HTML, so there is no sanitiser in
 * this path: every attribute below is set explicitly.
 *
 * @module features/proposals/render/rich-doc
 */
import type { JSONContent } from '@tiptap/core'
import type { CSSProperties, ReactNode } from 'react'

import { fluidFontSize } from '@/lib/branding/fluid-type'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction, ButtonAttrs, ImageAttrs } from '../model/doc'
import type { RichDoc } from '../model/layout'
import type { ProposalTheme } from '../model/theme'
import { isProposalVariable } from '../model/variables'

import { AudioNode, ButtonNode, ColumnsFrame, EmbedNode, ImageNode, isSafeHref, SpacerBox } from './rich-doc-nodes'
import { TableNode } from './table-node'
import { HEADING_ROLE, roleCss } from './text-roles'

export { isHttpUrl } from './rich-doc-nodes'

/** How a rich doc is being rendered: the live public page, the editor canvas, or a PDF/print pass. */
export type RenderMode = 'page' | 'edit' | 'print'

/** Everything a rich doc needs to render: branding, mode, variable values, and section-level overrides. */
export interface RichDocContext {
  branding: PublicBranding
  /** The layout's canvas theme: styles Heading 1/2/3 and Paragraph (`render/text-roles.ts`'s `roleCss`). Optional only for a node view rendering a lone atom (a button) with no text roles of its own; every section render passes it. */
  theme?: ProposalTheme | undefined
  mode: RenderMode
  /** Variable id → display value; missing ids render as empty text. */
  values: Record<string, string>
  /** Section-level colour override for every text node. */
  textColor?: string | undefined
  /** Section-level default alignment. */
  align?: 'left' | 'center' | 'right' | undefined
  /** Called for `accept` / `decline` / `jump` button actions instead of navigating. */
  onAction?: ((action: ButtonAction) => void) | undefined
}

type Mark = { type: string; attrs?: Record<string, unknown> }

// Applies marks innermost-first by folding the node through each mark in
// order, so `[bold, link]` wraps as <a><strong>text</strong></a>.
function applyMarks(node: ReactNode, marks: Mark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return node
  return marks.reduce<ReactNode>((inner, mark, i) => {
    const k = `${key}-m${i}`
    switch (mark.type) {
      case 'bold': return <strong key={k}>{inner}</strong>
      case 'italic': return <em key={k}>{inner}</em>
      case 'underline': return <u key={k}>{inner}</u>
      case 'strike': return <s key={k}>{inner}</s>
      case 'link': {
        const href = String(mark.attrs?.href ?? '')
        return isSafeHref(href)
          ? <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="underline">{inner}</a>
          : <span key={k}>{inner}</span>
      }
      case 'textStyle': {
        const a = mark.attrs ?? {}
        const style: CSSProperties = {}
        if (typeof a.color === 'string') style.color = a.color
        // Same fluid rule as the theme roles, so a 46px title an author sets
        // by hand shrinks on a phone the way a 46px Heading 1 does.
        if (typeof a.fontSize === 'string') style.fontSize = fluidFontSize(a.fontSize)
        if (typeof a.fontFamily === 'string') style.fontFamily = a.fontFamily
        if (typeof a.fontWeight === 'string') style.fontWeight = a.fontWeight
        if (typeof a.letterSpacing === 'string') style.letterSpacing = a.letterSpacing
        return <span key={k} style={style}>{inner}</span>
      }
      case 'highlight': return <mark key={k} style={{ background: typeof mark.attrs?.color === 'string' ? mark.attrs.color : undefined }}>{inner}</mark>
      case 'textCase': return <span key={k} style={{ textTransform: mark.attrs?.value === 'sentence' ? 'none' : (mark.attrs?.value as CSSProperties['textTransform']) }}>{inner}</span>
      default: return inner
    }
  }, node)
}

/**
 * ProseMirror's own rule for keeping a text block's last line open: an
 * empty block, or one whose last inline is a hard break, gets a trailing
 * `<br>` (its `ProseMirror-trailingBreak`), because an empty `<p>` and a
 * `<br>` at the very end of one both lay out at zero height. Without the
 * same here the blank lines an author pressed Enter for showed on the
 * canvas and vanished from the Preview and the couple's page.
 */
function needsTrailingBreak(nodes: JSONContent[] | undefined): boolean {
  if (!nodes?.length) return true
  return nodes[nodes.length - 1]?.type === 'hardBreak'
}

function renderInline(nodes: JSONContent[] | undefined, ctx: RichDocContext, key: string): ReactNode[] {
  const out = (nodes ?? []).map((n, i) => {
    const k = `${key}-${i}`
    switch (n.type) {
      case 'text': return applyMarks(n.text ?? '', n.marks as Mark[] | undefined, k)
      case 'hardBreak': return <br key={k} />
      case 'variable': {
        const id = String(n.attrs?.id ?? '')
        if (!isProposalVariable(id)) return null
        // The chip's own fallback stands in for an empty value; a proposal
        // sent before the venue is known reads "your venue", not a gap.
        const fallback = typeof n.attrs?.fallback === 'string' ? n.attrs.fallback : ''
        return <span key={k}>{ctx.values[id] || fallback}</span>
      }
      default: return null
    }
  })
  if (needsTrailingBreak(nodes)) out.push(<br key={`${key}-tb`} />)
  return out
}

function textStyle(ctx: RichDocContext, role: Parameters<typeof roleCss>[1]): CSSProperties {
  return {
    // An empty-string textColor (e.g. a cleared colour picker) must behave
    // like "unset", not like a real override, so this is a truthiness test.
    ...roleCss(ctx.branding, role, { inheritColor: !!ctx.textColor, theme: ctx.theme }),
    // Section alignment wins over the theme role's own; a node's `textAlign`
    // attr (applied by the caller) wins over both.
    ...(ctx.align ? { textAlign: ctx.align } : {}),
  }
}

const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])

/**
 * Allowlist a node's `textAlign` attr before it reaches inline CSS;
 * anything else is unset. A stored `'left'` renders as a real override
 * exactly like `'center'`/`'right'`: it is always a deliberate pick from
 * the Align pill, because `extensions/text-align.ts` drops a pasted
 * `'left'` on parse (see that module's doc). Erasing it here instead
 * meant "Align left" could never pull a paragraph out of a centred
 * section or centred theme role (live bug, 2026-09-20). Only an absent
 * attr defers to the section/role alignment.
 */
function safeTextAlign(value: unknown): CSSProperties['textAlign'] | undefined {
  if (typeof value !== 'string' || !TEXT_ALIGN_VALUES.has(value)) return undefined
  return value as CSSProperties['textAlign']
}

/** A node's `lineHeight`/`topSpacing` attrs as inline CSS, when they're the plain strings the extensions write (`line-height.ts`/`top-spacing.ts`); anything else (a stray non-string from malformed JSON) is left unset rather than handed to the DOM raw. */
function blockSpacing(attrs: { lineHeight?: unknown; topSpacing?: unknown } | undefined): CSSProperties {
  const style: CSSProperties = {}
  if (typeof attrs?.lineHeight === 'string') style.lineHeight = attrs.lineHeight
  if (typeof attrs?.topSpacing === 'string') style.marginTop = attrs.topSpacing
  return style
}

function renderBlock(n: JSONContent, ctx: RichDocContext, key: string): ReactNode {
  const children = (nodes: JSONContent[] | undefined) => (nodes ?? []).map((c, i) => renderBlock(c, ctx, `${key}-${i}`))
  const nodeAlign = safeTextAlign(n.attrs?.textAlign)
  const align = nodeAlign ? { textAlign: nodeAlign } : {}
  const spacing = blockSpacing(n.attrs)
  switch (n.type) {
    case 'paragraph': return <p key={key} className="m-0 mb-3" style={{ ...textStyle(ctx, 'body'), ...align, ...spacing }}>{renderInline(n.content, ctx, key)}</p>
    case 'heading': {
      const level = (n.attrs?.level === 1 || n.attrs?.level === 2 || n.attrs?.level === 3 ? n.attrs.level : 2) as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <Tag key={key} className="m-0 mb-4" style={{ ...textStyle(ctx, HEADING_ROLE[level]), ...align, ...spacing }}>{renderInline(n.content, ctx, key)}</Tag>
    }
    case 'bulletList': return <ul key={key} className="mb-3 list-disc pl-6">{children(n.content)}</ul>
    case 'orderedList': return <ol key={key} className="mb-3 list-decimal pl-6">{children(n.content)}</ol>
    case 'listItem':
      // A marker only ever inherits colour/weight from its own `<li>`, never
      // from a `<p>` or `<strong>` inside it - so without a style of its own
      // here a bullet/number rendered in the browser's default colour while
      // its text took the branded body colour, and stayed regular weight
      // when its text was bolded. The base style matches `textStyle(ctx,
      // 'body')` exactly (same as the plain-paragraph case above); the two
      // `:has()` selectors bold the marker to match a bolded leading run,
      // mirroring the fix already shipped for `.contract-content` in
      // `globals.css` (one level of mark nesting covered, for bold wrapped
      // in a `textStyle` mark's own `<span>`).
      return (
        <li
          key={key}
          className="[&>p]:mb-1 [&:has(>p>strong:first-child)]:marker:font-bold [&:has(>p>span:first-child>strong:first-child)]:marker:font-bold"
          style={textStyle(ctx, 'body')}
        >
          {children(n.content)}
        </li>
      )
    case 'blockquote': return <blockquote key={key} className="my-4 border-l-2 border-current pl-4 opacity-80">{children(n.content)}</blockquote>
    case 'table': return <TableNode key={key} node={n}>{children(n.content)}</TableNode>
    case 'tableRow': return <tr key={key}>{children(n.content)}</tr>
    // Cell borders read the table's `--table-border` (`TableNode` sets it
    // from the node's `borderColor`), else the text colour at 20%.
    case 'tableCell': return <td key={key} className="border [border-color:var(--table-border,color-mix(in_oklab,currentColor_20%,transparent))] px-3 py-2 align-top">{children(n.content)}</td>
    case 'tableHeader': return <th key={key} className="border [border-color:var(--table-border,color-mix(in_oklab,currentColor_20%,transparent))] px-3 py-2 text-left font-medium">{children(n.content)}</th>
    case 'horizontalRule': return <hr key={key} className="my-6 border-current/20" />
    case 'image': return <ImageNode key={key} attrs={n.attrs as ImageAttrs} />
    case 'button': return <ButtonNode key={key} attrs={n.attrs as ButtonAttrs} ctx={ctx} />
    case 'embed': return <EmbedNode key={key} url={String(n.attrs?.url ?? '')} mode={ctx.mode} />
    case 'audio': return <AudioNode key={key} src={String(n.attrs?.src ?? '')} title={typeof n.attrs?.title === 'string' ? n.attrs.title : undefined} mode={ctx.mode} />
    case 'columns': {
      const cols = n.content ?? []
      // Print keeps two columns side by side and stacks three (spec §6).
      const stack = ctx.mode === 'print' && cols.length === 3
      const ratios = cols.map((c) => Number(c.attrs?.ratio ?? 1 / cols.length))
      return <ColumnsFrame key={key} stack={stack} ratios={ratios}>{cols.map((c) => children(c.content))}</ColumnsFrame>
    }
    case 'column': return <div key={key}>{children(n.content)}</div>
    case 'spacer': return <SpacerBox key={key} heightPx={Number(n.attrs?.heightPx ?? 0)} mode={ctx.mode} />
    // Inline nodes at block level (a stray text node) render as a paragraph.
    case 'text': case 'hardBreak': case 'variable': return <p key={key} className="m-0 mb-3" style={textStyle(ctx, 'body')}>{renderInline([n], ctx, key)}</p>
    default: return null
  }
}

/** Renders one rich doc. Clears floats at the end so a floated image never leaks into the next section. */
export function RichDocView({ doc, ctx }: { doc: RichDoc; ctx: RichDocContext }) {
  return (
    <div className="after:clear-both after:table after:content-['']" style={ctx.textColor ? { color: ctx.textColor } : undefined}>
      {(doc.content ?? []).map((n, i) => renderBlock(n, ctx, `n${i}`))}
    </div>
  )
}

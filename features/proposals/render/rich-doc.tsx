'use client'

/**
 * React renderer for a v2 rich doc (spec §2.2, §6). One switch over the
 * spec's node list; marks wrap text; variables resolve from `ctx.values`;
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

import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction, ButtonAttrs, ImageAttrs } from '../model/doc'
import type { RichDoc } from '../model/layout'
import { isProposalVariable } from '../model/variables'

import { AudioNode, ButtonNode, ColumnsFrame, EmbedNode, ImageNode, isSafeHref, SpacerBox } from './rich-doc-nodes'
import { HEADING_ROLE, roleCss } from './text-roles'

export { isHttpUrl } from './rich-doc-nodes'

/** How a rich doc is being rendered: the live public page, the editor canvas, or a PDF/print pass. */
export type RenderMode = 'page' | 'edit' | 'print'

/** Everything a rich doc needs to render: branding, mode, variable values, and section-level overrides. */
export interface RichDocContext {
  branding: PublicBranding
  mode: RenderMode
  /** Variable id → display value; missing ids render as empty text. */
  values: Record<string, string>
  /** Section-level colour override for every text node. */
  textColor?: string | undefined
  /** Section-level default alignment. */
  align?: 'left' | 'center' | undefined
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
          ? <a key={k} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
          : <span key={k}>{inner}</span>
      }
      case 'textStyle': {
        const a = mark.attrs ?? {}
        const style: CSSProperties = {}
        if (typeof a.color === 'string') style.color = a.color
        if (typeof a.fontSize === 'string') style.fontSize = a.fontSize
        if (typeof a.fontFamily === 'string') style.fontFamily = a.fontFamily
        return <span key={k} style={style}>{inner}</span>
      }
      case 'highlight': return <mark key={k} style={{ background: typeof mark.attrs?.color === 'string' ? mark.attrs.color : undefined }}>{inner}</mark>
      case 'textCase': return <span key={k} style={{ textTransform: mark.attrs?.value === 'sentence' ? 'none' : (mark.attrs?.value as CSSProperties['textTransform']) }}>{inner}</span>
      default: return inner
    }
  }, node)
}

function renderInline(nodes: JSONContent[] | undefined, ctx: RichDocContext, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}-${i}`
    switch (n.type) {
      case 'text': return applyMarks(n.text ?? '', n.marks as Mark[] | undefined, k)
      case 'hardBreak': return <br key={k} />
      case 'variable': {
        const id = String(n.attrs?.id ?? '')
        return isProposalVariable(id) ? <span key={k}>{ctx.values[id] ?? ''}</span> : null
      }
      default: return null
    }
  })
}

function textStyle(ctx: RichDocContext, role: Parameters<typeof roleCss>[1], fluid = false): CSSProperties {
  return {
    // An empty-string textColor (e.g. a cleared colour picker) must behave
    // like "unset", not like a real override, so this is a truthiness test.
    ...roleCss(ctx.branding, role, { fluid, inheritColor: !!ctx.textColor }),
    ...(ctx.align ? { textAlign: ctx.align } : {}),
  }
}

const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])

/** Allowlist a node's `textAlign` attr before it reaches inline CSS; anything else is unset. */
function safeTextAlign(value: unknown): CSSProperties['textAlign'] | undefined {
  return typeof value === 'string' && TEXT_ALIGN_VALUES.has(value) ? (value as CSSProperties['textAlign']) : undefined
}

function renderBlock(n: JSONContent, ctx: RichDocContext, key: string): ReactNode {
  const children = (nodes: JSONContent[] | undefined) => (nodes ?? []).map((c, i) => renderBlock(c, ctx, `${key}-${i}`))
  const nodeAlign = safeTextAlign(n.attrs?.textAlign)
  const align = nodeAlign ? { textAlign: nodeAlign } : {}
  switch (n.type) {
    case 'paragraph': return <p key={key} className="m-0 mb-3" style={{ ...textStyle(ctx, 'body'), ...align }}>{renderInline(n.content, ctx, key)}</p>
    case 'heading': {
      const level = (n.attrs?.level === 1 || n.attrs?.level === 2 || n.attrs?.level === 3 ? n.attrs.level : 2) as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <Tag key={key} className="m-0 mb-4" style={{ ...textStyle(ctx, HEADING_ROLE[level], level === 1), ...align }}>{renderInline(n.content, ctx, key)}</Tag>
    }
    case 'bulletList': return <ul key={key} className="mb-3 list-disc pl-6">{children(n.content)}</ul>
    case 'orderedList': return <ol key={key} className="mb-3 list-decimal pl-6">{children(n.content)}</ol>
    case 'listItem': return <li key={key} className="[&>p]:mb-1">{children(n.content)}</li>
    case 'blockquote': return <blockquote key={key} className="my-4 border-l-2 border-current pl-4 opacity-80">{children(n.content)}</blockquote>
    case 'table': return <div key={key} className="my-4 overflow-x-auto"><table className="w-full border-collapse"><tbody>{children(n.content)}</tbody></table></div>
    case 'tableRow': return <tr key={key}>{children(n.content)}</tr>
    case 'tableCell': return <td key={key} className="border border-current/20 px-3 py-2 align-top">{children(n.content)}</td>
    case 'tableHeader': return <th key={key} className="border border-current/20 px-3 py-2 text-left font-medium">{children(n.content)}</th>
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

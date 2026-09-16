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

import { getTextColor } from '@/lib/branding/contrast'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction, ButtonAttrs, ImageAttrs } from '../model/doc'
import type { RichDoc } from '../model/layout'
import { isProposalVariable } from '../model/variables'

import { embedSrc } from './embed-src'
import { HEADING_ROLE, roleCss } from './text-roles'

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

// The schema (`model/schema.ts`) is the primary guard against unsafe
// hrefs/srcs on write; this is the second guard, at render time, because a
// stored doc can reach the renderer without being re-parsed (a stale cached
// row, a future editor bypass). `isSafeHref` matches the link mark's own
// allowlist (http(s), mailto, tel); `isHttpUrl` is stricter for `src`
// attributes (image/audio), which have no legitimate non-http(s) use.
const isSafeHref = (href: string): boolean => /^(https?:\/\/|mailto:|tel:)/i.test(href)
/** `http(s)` only, exported so `render/section.tsx` can apply the same render-time guard to section background media. */
export const isHttpUrl = (src: string): boolean => /^https?:\/\//i.test(src)

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

const BUTTON_SIZE: Record<ButtonAttrs['size'], string> = { sm: 'h-8 px-3', md: 'h-10 px-5', lg: 'h-12 px-7 text-section' }
const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

function ButtonNode({ attrs, ctx }: { attrs: ButtonAttrs; ctx: RichDocContext }) {
  const color = attrs.color ?? ctx.branding.brand_color
  const radius = attrs.radius ?? ctx.branding.button_radius
  // A fill button's label must read against whatever colour it sits on, so
  // it is computed the same way the v1 accept block already does (see
  // lib/branding/public-blocks/proposal/accept.tsx), not hardcoded white:
  // an MC with a light brand colour (pale gold, blush) would otherwise get
  // an unreadable white-on-light button.
  const style: CSSProperties = attrs.variant === 'outline'
    ? { borderColor: color, color, borderRadius: radius }
    : { background: color, color: getTextColor(color), borderRadius: radius }
  const cls = `inline-flex items-center font-medium border-2 ${attrs.variant === 'outline' ? 'bg-transparent' : 'border-transparent'} ${BUTTON_SIZE[attrs.size]}`
  const wrap = (child: ReactNode) => <div className={`flex ${ALIGN_CLASS[attrs.align]} my-4`}>{child}</div>
  if (attrs.action.kind === 'link') {
    // An unsafe href degrades to a plain, non-interactive label rather than
    // an inert anchor, so the button still reads correctly on the page.
    return isSafeHref(attrs.action.href)
      ? wrap(<a href={attrs.action.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{attrs.label}</a>)
      : wrap(<span className={cls} style={style}>{attrs.label}</span>)
  }
  const action = attrs.action
  return wrap(
    <button type="button" className={`${cls} cursor-pointer`} style={style} onClick={() => ctx.onAction?.(action)}>
      {attrs.label}
    </button>,
  )
}

const IMAGE_LAYOUT: Record<ImageAttrs['layout'], string> = {
  inline: 'my-4',
  left: 'float-left mr-6 mb-4 max-md:float-none max-md:mr-0',
  right: 'float-right ml-6 mb-4 max-md:float-none max-md:ml-0',
  full: 'my-6',
}

function ImageNode({ attrs }: { attrs: ImageAttrs }) {
  // Schema-validated storage URLs are already http(s)-only; this is the
  // render-time second guard (see the comment on isSafeHref/isHttpUrl above).
  if (!isHttpUrl(attrs.src)) return null
  const width = attrs.layout === 'full' ? '100%' : `${attrs.widthPct}%`
  return (
    <figure className={`m-0 max-md:!w-full ${IMAGE_LAYOUT[attrs.layout]}`} style={{ width }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- MC-uploaded media at arbitrary sizes */}
      <img src={attrs.src} alt={attrs.alt ?? ''} className="block w-full h-auto rounded-control" loading="lazy" />
      {attrs.caption ? <figcaption className="mt-2 text-body text-text-muted">{attrs.caption}</figcaption> : null}
    </figure>
  )
}

function EmbedNode({ url, mode }: { url: string; mode: RenderMode }) {
  const resolved = embedSrc(url)
  if (!resolved) return null
  if (mode === 'print') return <p className="my-4"><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></p>
  return (
    <div className="my-6 aspect-video w-full overflow-hidden rounded-control">
      <iframe
        src={resolved.src}
        title={`${resolved.provider} embed`}
        className="h-full w-full border-0"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </div>
  )
}

function AudioNode({ src, title, mode }: { src: string; title: string | undefined; mode: RenderMode }) {
  if (mode === 'print') return isSafeHref(src) ? <p className="my-4"><a href={src} target="_blank" rel="noopener noreferrer">{title ?? 'Listen'}</a></p> : null
  if (!isHttpUrl(src)) return null
  return (
    <figure className="mx-0 my-6">
      {title ? <figcaption className="mb-2 text-body font-medium">{title}</figcaption> : null}
      <audio src={src} controls preload="none" className="w-full" />
    </figure>
  )
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
      return (
        <div key={key} data-columns className={`my-4 ${stack ? 'flex flex-col' : 'flex max-md:flex-col'} gap-6`}>
          {cols.map((c, i) => (
            <div key={`${key}-${i}`} style={{ flex: `${Number(c.attrs?.ratio ?? 1 / cols.length)} 1 0%` }} className="min-w-0 max-md:!flex-auto">
              {children(c.content)}
            </div>
          ))}
        </div>
      )
    }
    case 'column': return <div key={key}>{children(n.content)}</div>
    case 'spacer': {
      const h = Number(n.attrs?.heightPx ?? 0)
      return <div key={key} data-spacer aria-hidden style={{ height: ctx.mode === 'print' ? 0 : (Number.isFinite(h) ? h : 0) }} />
    }
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

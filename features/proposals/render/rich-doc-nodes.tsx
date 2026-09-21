'use client'

/**
 * The rich-doc atom/container node components: `ButtonNode`, `ImageNode`,
 * `EmbedNode`, `AudioNode`, `ColumnsFrame` and `SpacerBox`. Split out of
 * `rich-doc.tsx` (Proposal Layout v2 Phase 2 Task 7) so the Task 7 editor
 * node views can render the exact same markup the public page renders
 * (WYSIWYG), without importing the whole renderer module. `rich-doc.tsx`
 * re-exports `isHttpUrl` from here for its existing consumers; nothing
 * about the public page's rendered output changes by this split.
 *
 * @module features/proposals/render/rich-doc-nodes
 */
import type { CSSProperties, ReactNode } from 'react'

import { getTextColor } from '@/lib/branding/contrast'
import { resolveTemplateString } from '@/lib/branding/template-string'

import type { ButtonAttrs, ImageAttrs } from '../model/doc'

import { embedSrc } from './embed-src'
import type { RenderMode, RichDocContext } from './rich-doc'

// The schema (`model/schema.ts`) is the primary guard against unsafe
// hrefs/srcs on write; this is the second guard, at render time, because a
// stored doc can reach the renderer without being re-parsed (a stale cached
// row, a future editor bypass). `isSafeHref` matches the link mark's own
// allowlist (http(s), mailto, tel); `isHttpUrl` is stricter for `src`
// attributes (image/audio), which have no legitimate non-http(s) use.
/** `http(s)`, `mailto:` or `tel:` only; the render-time guard `rich-doc.tsx`'s link mark and this module's audio print fallback both apply to a raw `href`. */
export const isSafeHref = (href: string): boolean => /^(https?:\/\/|mailto:|tel:)/i.test(href)
/** `http(s)` only, for `src` attributes (image/audio) and section background media (`render/section-backdrop.tsx`). */
export const isHttpUrl = (src: string): boolean => /^https?:\/\//i.test(src)

const BUTTON_SIZE: Record<ButtonAttrs['size'], string> = { sm: 'h-8 px-3', md: 'h-10 px-5', lg: 'h-12 px-7 text-section' }
const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

/** Renders a `button` node: a call-to-action that either navigates (a `link` action) or drives the proposal stepper (`accept` / `decline` / `jump`, via `ctx.onAction`). */
export function ButtonNode({ attrs, ctx }: { attrs: ButtonAttrs; ctx: RichDocContext }) {
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
  // A button label is a plain string, so it carries `{{ id | fallback }}`
  // text where rich text would carry a chip; resolved against the same values.
  const label = resolveTemplateString(attrs.label, ctx.values)
  const cls = `inline-flex items-center font-medium border-2 ${attrs.variant === 'outline' ? 'bg-transparent' : 'border-transparent'} ${BUTTON_SIZE[attrs.size]}`
  const wrap = (child: ReactNode) => <div className={`flex ${ALIGN_CLASS[attrs.align]} my-4`}>{child}</div>
  if (attrs.action.kind === 'link') {
    // An unsafe href degrades to a plain, non-interactive label rather than
    // an inert anchor, so the button still reads correctly on the page.
    return isSafeHref(attrs.action.href)
      ? wrap(<a href={attrs.action.href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{label}</a>)
      : wrap(<span className={cls} style={style}>{label}</span>)
  }
  const action = attrs.action
  return wrap(
    <button type="button" className={`${cls} cursor-pointer`} style={style} onClick={() => ctx.onAction?.(action)}>
      {label}
    </button>,
  )
}

const IMAGE_LAYOUT: Record<ImageAttrs['layout'], string> = {
  inline: 'my-4',
  left: 'float-left mr-6 mb-4 max-md:float-none max-md:mr-0',
  right: 'float-right ml-6 mb-4 max-md:float-none max-md:ml-0',
  full: 'my-6',
}

/** Renders an `image` node: a captioned, positioned figure. Renders nothing for a non-`http(s)` `src` (the render-time guard). */
export function ImageNode({ attrs }: { attrs: ImageAttrs }) {
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

/** Renders an `embed` node: an allowlisted external iframe, or a plain link in print mode. Renders nothing when `url`'s host is not allowlisted (`embedSrc` returns `null`). */
export function EmbedNode({ url, mode }: { url: string; mode: RenderMode }) {
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

/** Renders an `audio` node: a native player, or a link in print mode. Renders nothing for a non-`http(s)` `src` outside print. */
export function AudioNode({ src, title, mode }: { src: string; title: string | undefined; mode: RenderMode }) {
  if (mode === 'print') return isSafeHref(src) ? <p className="my-4"><a href={src} target="_blank" rel="noopener noreferrer">{title ?? 'Listen'}</a></p> : null
  if (!isHttpUrl(src)) return null
  return (
    <figure className="mx-0 my-6">
      {title ? <figcaption className="mb-2 text-body font-medium">{title}</figcaption> : null}
      <audio src={src} controls preload="none" className="w-full" />
    </figure>
  )
}

/** Props for {@link ColumnsFrame}. */
export interface ColumnsFrameProps {
  /** Print stacks a 3-up row instead of keeping it side by side (spec §6); 2-up rows never stack. */
  stack: boolean
  /** Each column's width share (spec's `column.ratio`), in the same order as `children`. */
  ratios: number[]
  /** One already-rendered subtree per column. */
  children: ReactNode[]
}

/**
 * Renders a `columns` row: the flex wrapper plus a per-column `flex-basis`
 * derived from its `ratio`. Stacks on a narrow `@container/doc` (not a
 * viewport `max-md:`: the editor's mobile canvas and Preview are a
 * fixed-width column inside a desktop browser, so a viewport breakpoint
 * never fires there - live-found 2026-09-19, stayed side-by-side on
 * mobile). The print-forced `stack` (3-up rows only, spec §6) is separate
 * and always wins regardless of container width.
 */
export function ColumnsFrame({ stack, ratios, children }: ColumnsFrameProps) {
  return (
    <div data-columns className={`my-4 ${stack ? 'flex flex-col' : 'flex @max-3xl/doc:flex-col'} gap-6`}>
      {children.map((child, i) => (
        <div key={i} style={{ flex: `${ratios[i] ?? 1 / ratios.length} 1 0%` }} className="min-w-0 @max-3xl/doc:!flex-auto">
          {child}
        </div>
      ))}
    </div>
  )
}

/** Renders a `spacer` node: a fixed-height gap, collapsed to 0 in print. */
export function SpacerBox({ heightPx, mode }: { heightPx: number; mode: RenderMode }) {
  return <div data-spacer aria-hidden style={{ height: mode === 'print' ? 0 : (Number.isFinite(heightPx) ? heightPx : 0) }} />
}

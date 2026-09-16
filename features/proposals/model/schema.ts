/**
 * Runtime validation for a v2 layout (spec §2, §10). One recursive node
 * schema keyed by `NODE_TYPES`, one mark schema keyed by `MARK_TYPES`, then
 * the section and layout schemas with the size limits. `parseProposalLayout`
 * is the only entry point; it returns a tagged result so callers never
 * throw on user input.
 *
 * @module features/proposals/model/schema
 */
import { z } from 'zod'

import type { ProposalLayout } from './layout'
import { detectEmbedProvider, LAYOUT_LIMITS } from './rich-doc-spec'

/** `http(s)`, `mailto` and `tel` only: anything else (javascript:, data:) is refused. */
const safeHref = z.string().max(2000).refine((v) => /^(https?:\/\/|mailto:|tel:)/i.test(v), 'Unsafe link')
// http(s) only: an image/audio/video `src` reaches the DOM directly (no
// sanitiser downstream, see `render/rich-doc.tsx`), so javascript:/data:
// URLs must be refused at the write boundary, not just filtered at render.
const storageUrl = z.url({ protocol: /^https?$/ }).max(2000)
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Colour must be #RRGGBB or #RRGGBBAA')

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('link'), attrs: z.looseObject({ href: safeHref, target: z.string().optional() }) }),
  z.object({
    type: z.literal('textStyle'),
    attrs: z.looseObject({
      color: hexColor.optional().nullable(),
      fontSize: z.string().max(8).optional().nullable(),
      fontFamily: z.string().max(80).optional().nullable(),
    }).optional(),
  }),
  z.object({ type: z.literal('highlight'), attrs: z.object({ color: z.string().max(32).optional().nullable() }).optional() }),
  z.object({ type: z.literal('textCase'), attrs: z.object({ value: z.enum(['sentence', 'capitalize', 'uppercase', 'lowercase']) }) }),
])

const buttonAction = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('link'), href: safeHref }),
  z.object({ kind: z.literal('accept') }),
  z.object({ kind: z.literal('decline') }),
  z.object({ kind: z.literal('jump'), sectionId: z.string().min(1).max(64) }),
])

/** Shape of one rich-doc node before Zod narrows it to a specific `NodeType`. */
type NodeJSON = {
  type: string
  attrs?: Record<string, unknown> | undefined
  content?: NodeJSON[] | undefined
  marks?: unknown[] | undefined
  text?: string | undefined
}

// Every entry in `NODE_TYPES` / `MARK_TYPES` must have a branch below and in
// `markSchema`; there is no compile-time link between the spec's string
// literals and these discriminated unions, so coverage is pinned instead by
// the schema tests ("accepts every node the spec lists" / "accepts every
// mark the spec lists" in schema.test.ts), which assert against the spec's
// arrays directly and fail the moment a new type is added to one but not
// the other.
const baseNode: z.ZodType<NodeJSON> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string().max(20_000), marks: z.array(markSchema).max(8).optional() }),
    z.object({ type: z.literal('paragraph'), attrs: z.looseObject({ textAlign: z.string().optional().nullable() }).optional(), content: z.array(baseNode).optional() }),
    z.object({ type: z.literal('heading'), attrs: z.looseObject({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), textAlign: z.string().optional().nullable() }), content: z.array(baseNode).optional() }),
    z.object({ type: z.literal('bulletList'), content: z.array(baseNode) }),
    z.object({ type: z.literal('orderedList'), attrs: z.looseObject({ start: z.number().int().optional() }).optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('listItem'), content: z.array(baseNode) }),
    z.object({ type: z.literal('blockquote'), content: z.array(baseNode) }),
    z.object({ type: z.literal('table'), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableRow'), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableCell'), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('tableHeader'), attrs: z.record(z.string(), z.unknown()).optional(), content: z.array(baseNode) }),
    z.object({ type: z.literal('horizontalRule') }),
    z.object({ type: z.literal('hardBreak') }),
    z.object({
      type: z.literal('image'),
      attrs: z.object({
        src: storageUrl, alt: z.string().max(300).optional(), caption: z.string().max(300).optional(),
        layout: z.enum(['inline', 'left', 'right', 'full']), widthPct: z.number().min(20).max(100),
      }),
    }),
    z.object({
      type: z.literal('button'),
      attrs: z.object({
        label: z.string().min(1).max(80), action: buttonAction, variant: z.enum(['fill', 'outline']),
        size: z.enum(['sm', 'md', 'lg']), align: z.enum(['left', 'center', 'right']),
        color: hexColor.optional(), radius: z.number().min(0).max(40).optional(),
      }),
    }),
    z.object({
      type: z.literal('embed'),
      attrs: z.object({ url: z.string().max(2000).refine((u) => detectEmbedProvider(u) !== null, 'Embed host is not allowed') }),
    }),
    z.object({ type: z.literal('audio'), attrs: z.object({ src: storageUrl, title: z.string().max(120).optional(), durationSec: z.number().min(0).optional() }) }),
    z.object({ type: z.literal('columns'), attrs: z.object({ count: z.union([z.literal(2), z.literal(3)]) }), content: z.array(baseNode).min(2).max(3) }),
    z.object({ type: z.literal('column'), attrs: z.object({ ratio: z.number().min(0.1).max(0.9) }), content: z.array(baseNode) }),
    z.object({ type: z.literal('spacer'), attrs: z.object({ heightPx: z.number().min(8).max(160) }) }),
    z.object({ type: z.literal('variable'), attrs: z.object({ id: z.string().min(1).max(64) }) }),
  ]),
)

/** Recursively count a node and all its descendants (used against `LAYOUT_LIMITS.maxNodesPerDoc`). */
function countNodes(node: NodeJSON): number {
  return 1 + (node.content ?? []).reduce((n, child) => n + countNodes(child), 0)
}

const richDocSchema = z
  .object({ type: z.literal('doc'), content: z.array(baseNode).optional() })
  // `countNodes` counts the `doc` root itself as 1, but the root is a
  // container, not content, so it is not charged against the limit: hence
  // `- 1` here rather than raising `maxNodesPerDoc` by one everywhere else.
  .refine((d) => countNodes(d as NodeJSON) - 1 <= LAYOUT_LIMITS.maxNodesPerDoc, `A section holds at most ${LAYOUT_LIMITS.maxNodesPerDoc} nodes`)

const widthOrPx = z.union([z.enum(['narrow', 'medium', 'wide']), z.number().min(320).max(1400)])
const paddingOrPx = z.union([z.enum(['compact', 'cozy', 'roomy']), z.number().min(0).max(240)])

const sectionStyleSchema = z.object({
  background: z.object({
    color: hexColor.optional(), image: storageUrl.optional(), video: storageUrl.optional(),
    poster: storageUrl.optional(), overlay: z.number().min(0).max(100).optional(),
  }).optional(),
  height: z.enum(['fit', 'full']),
  contentWidth: widthOrPx,
  padding: paddingOrPx,
  textColor: hexColor.optional(),
  align: z.enum(['left', 'center']).optional(),
})

// Phase 1 keeps the v1 data shapes opaque but bounded: each is an object,
// checked for size, and rendered by the v1 components that already
// validate their own fields. Phase 3 replaces this with typed schemas.
const boundedObject = z.record(z.string(), z.unknown()).refine((o) => JSON.stringify(o).length <= 200_000, 'Section data too large')
const sectionDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('packages'), packages: boundedObject }),
  z.object({ kind: z.literal('gallery'), gallery: boundedObject }),
  z.object({ kind: z.literal('video'), video: boundedObject }),
  z.object({ kind: z.literal('testimonials'), testimonials: boundedObject }),
  z.object({ kind: z.literal('faq'), faq: boundedObject }),
  z.object({ kind: z.literal('accept'), accept: boundedObject }),
])

const sectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(['content', 'packages', 'gallery', 'video', 'testimonials', 'faq', 'accept']),
    name: z.string().max(80).optional(),
    style: sectionStyleSchema,
    hideOnMobile: z.boolean().optional(),
    intro: richDocSchema.optional(),
    content: richDocSchema.optional(),
    data: sectionDataSchema.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.kind === 'content' && !s.content) ctx.addIssue({ code: 'custom', message: 'A content section needs content' })
    if (s.kind !== 'content' && (!s.data || s.data.kind !== s.kind)) ctx.addIssue({ code: 'custom', message: `A ${s.kind} section needs matching data` })
  })

const pageSettingsSchema = z.object({
  passwordHash: z.string().max(200).nullable().optional(),
  allowDownload: z.boolean().optional(),
  linkPreview: z.object({ title: z.string().max(120).optional(), imageUrl: storageUrl.optional() }).optional(),
  sectionNav: z.boolean().optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
})

/** The whole layout. Exported for callers that want Zod composition; prefer {@link parseProposalLayout}. */
export const proposalLayoutSchema = z
  .object({ version: z.literal(2), sections: z.array(sectionSchema).max(LAYOUT_LIMITS.maxSections), page: pageSettingsSchema.optional() })
  // Duplicate ids break React keys (render/layout.tsx) and make a `jump`
  // button's target section ambiguous, so a layout carrying them is invalid
  // even though nothing in the UI can produce one today.
  .refine((l) => new Set(l.sections.map((s) => s.id)).size === l.sections.length, 'Section ids must be unique')
  .refine((l) => JSON.stringify(l).length <= LAYOUT_LIMITS.maxSerialisedBytes, 'Layout too large')

/** Result of validating untrusted input against {@link proposalLayoutSchema}. */
export type ParseResult = { ok: true; layout: ProposalLayout } | { ok: false; issues: string[] }

/**
 * Read the value at `path` inside `root` without throwing, so an issue
 * message can name the offending value even when Zod's own message (e.g.
 * an `invalid_union` discriminator mismatch) does not include it.
 */
function valueAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = root
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<PropertyKey, unknown>)[key as string]
  }
  return current
}

/** Validate untrusted input as a v2 layout. Never throws. */
export function parseProposalLayout(input: unknown): ParseResult {
  const result = proposalLayoutSchema.safeParse(input)
  if (result.success) return { ok: true, layout: result.data as ProposalLayout }
  const issues = result.error.issues.map((issue) => {
    const received = valueAtPath(input, issue.path)
    // `issues` is returned to callers and may end up in logs, so the
    // offending value is capped hard: an oversize node (e.g. a 5MB text
    // node) must never echo its full content back out.
    const detail = typeof received === 'string' || typeof received === 'number' || typeof received === 'boolean'
      ? ` (${JSON.stringify(received).slice(0, 200)})`
      : ''
    return `${issue.path.join('.')}: ${issue.message}${detail}`
  })
  return { ok: false, issues }
}

/** A fresh section / node id. `crypto.randomUUID` exists in Node 20+ and every supported browser. */
export function newSectionId(): string {
  return crypto.randomUUID().slice(0, 12)
}

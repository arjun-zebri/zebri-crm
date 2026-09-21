/**
 * The template editor's save path (Proposal Layout v2 Phase 2 Task 14)
 * against local Supabase: a doc using every rich-doc node type, run
 * through `normaliseEditorJSON` the same way the live editor would,
 * round-trips through `updateTemplateLayoutAction` -> `getTemplateAction`
 * byte-for-byte, and a cross-tenant write is refused with the row left
 * untouched.
 *
 * @module tests/integration/proposals/template-editor-save
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  button, createTemplateAction, doc, embed, getTemplateAction, heading, image, normaliseEditorJSON, paragraph,
  text, updateTemplateLayoutAction, variable, type ProposalLayout, type RichDoc, type Section,
} from '@/features/proposals'

import { createTestUser, type TestUser } from '../helpers/supabase'

let activeUser: TestUser | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (!activeUser) throw new Error('No active test user')
    return activeUser.client
  }),
}))

const pro = { account_type: 'vendor', subscription_status: 'active', subscription_plan: 'pro' }

const createdUsers: TestUser[] = []
async function newUser(): Promise<TestUser> {
  const user = await createTestUser({}, pro)
  createdUsers.push(user)
  return user
}

afterEach(async () => {
  for (const user of createdUsers.splice(0)) await user.cleanup()
  activeUser = null
})

/** One content section wrapping `content`, with a fixed id so the two layouts built from it are otherwise identical. */
function layoutWith(content: RichDoc): ProposalLayout {
  const section: Section = { id: 's1', kind: 'content', style: { height: 'fit', contentWidth: 'medium', padding: 'cozy' }, content }
  return { version: 2, sections: [section] }
}

/**
 * A doc exercising every entry in `NODE_TYPES` (mirrors the fixture in
 * `model/schema.test.ts`'s "accepts every node the spec lists"), passed
 * through `normaliseEditorJSON` the way a real TipTap `getJSON()` result
 * would be before it ever reaches a server action.
 */
function everyNodeTypeDoc(): RichDoc {
  return normaliseEditorJSON(doc(
    heading(1, text('Anna & Jake'), variable('couple_name')),
    paragraph(text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }),
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
    { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Two'))] }] },
    { type: 'blockquote', content: [paragraph(text('Quote'))] },
    {
      type: 'table',
      content: [{
        type: 'tableRow',
        content: [{ type: 'tableHeader', content: [paragraph(text('H'))] }, { type: 'tableCell', content: [paragraph(text('C'))] }],
      }],
    },
    { type: 'horizontalRule' },
    image({ src: 'https://x/a.jpg', alt: 'A', layout: 'full', widthPct: 100 }),
    button({ label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'center' }),
    embed('https://vimeo.com/123'),
    { type: 'audio', attrs: { src: 'https://x/a.mp3', title: 'Demo', durationSec: 12 } },
    {
      type: 'columns',
      attrs: { count: 2 },
      content: [
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('L'))] },
        { type: 'column', attrs: { ratio: 0.5 }, content: [paragraph(text('R'))] },
      ],
    },
    { type: 'spacer', attrs: { heightPx: 32 } },
  ))
}

describe('template editor save path', () => {
  it('saves a doc using every rich-doc node type and reads it back unchanged', async () => {
    activeUser = await newUser()
    const created = await createTemplateAction({ name: 'Every node', layout: layoutWith(doc(paragraph(text('start')))) })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const withEveryNode = layoutWith(everyNodeTypeDoc())
    const updated = await updateTemplateLayoutAction({ id: created.template.id, layout: withEveryNode, baseRevision: created.template.revision })
    expect(updated.ok).toBe(true)

    const reread = await getTemplateAction(created.template.id)
    expect(reread.ok).toBe(true)
    if (reread.ok) expect(reread.template.layout).toEqual(withEveryNode)
  })

  it('refuses a cross-tenant layout update and leaves the row unchanged', async () => {
    const owner = await newUser()
    activeUser = owner
    const created = await createTemplateAction({ name: 'Owner template', layout: layoutWith(doc(paragraph(text('Original')))) })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const intruder = await newUser()
    activeUser = intruder
    const attack = await updateTemplateLayoutAction({ id: created.template.id, layout: layoutWith(doc(paragraph(text('Hacked')))), baseRevision: created.template.revision })
    expect(attack.ok).toBe(false)

    activeUser = owner
    const stillOwners = await getTemplateAction(created.template.id)
    expect(stillOwners.ok).toBe(true)
    if (stillOwners.ok) {
      expect(stillOwners.template.layout).toEqual(layoutWith(doc(paragraph(text('Original')))))
    }
  })
})

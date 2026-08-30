import { describe, expect, it } from 'vitest'

import {
  CONTRACT_VARIABLES,
  buildContractVariables,
  findUnknownVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables'

const base = {
  couple: { name: 'Sam and Alex', email: 'sam@example.com' },
  firstEvent: { date: '2027-03-14', venue: 'The Barn' },
  userMeta: { business_name: 'Zebri MC' },
}

describe('contract variables after proposal removal', () => {
  it('offers exactly the surviving variables plus the vendor role', () => {
    expect(CONTRACT_VARIABLES.map((v) => v.id)).toEqual([
      'couple_name',
      'couple_email',
      'event_date',
      'venue',
      'mc_business_name',
      'vendor_role',
      'partner_1_name',
      'partner_2_name',
      'mc_abn',
      'mc_email',
      'mc_phone',
      'mc_website',
      'mc_address',
      'mc_signature_name',
      'today',
    ])
  })

  it('resolves the vendor role so templates need not say "MC"', () => {
    expect(buildContractVariables({ ...base, userMeta: { business_type: ['dj'] } }).vendor_role)
      .toBe('DJ')
  })

  it('builds values from the couple, event, and MC settings only', () => {
    const vars = buildContractVariables(base)
    expect(vars.couple_name).toBe('Sam and Alex')
    expect(vars.couple_email).toBe('sam@example.com')
    expect(vars.venue).toBe('The Barn')
    expect(vars.mc_business_name).toBe('Zebri MC')
  })

  it('no longer exposes proposal-derived money variables', () => {
    const vars = buildContractVariables(base)
    expect(vars).not.toHaveProperty('total_amount')
    expect(vars).not.toHaveProperty('deposit_amount')
  })

  it('renders a dash for missing couple/event fields', () => {
    const vars = buildContractVariables({
      couple: { name: '', email: null },
      firstEvent: null,
      userMeta: {},
    })
    expect(vars.couple_name).toBe('-')
    expect(vars.couple_email).toBe('-')
    expect(vars.event_date).toBe('-')
    expect(vars.venue).toBe('-')
    expect(vars.mc_business_name).toBe('-')
  })
})

const mention = (id: string) => ({ type: 'mention', attrs: { id } })
const para = (...content: unknown[]) => ({ type: 'paragraph', content })
const docOf = (...content: unknown[]) => ({ type: 'doc', content }) as never

describe('findUnknownVariables', () => {
  it('returns nothing for a body using only catalog variables', () => {
    const body = docOf(para({ type: 'text', text: 'For ' }, mention('couple_name')))
    expect(findUnknownVariables(body)).toEqual([])
  })

  it('flags the money mentions that shipped in the seeded default template', () => {
    const body = docOf(
      para({ type: 'text', text: 'The Fee is ' }, mention('total_amount')),
      para({ type: 'text', text: 'A deposit of ' }, mention('deposit_amount')),
    )
    expect(findUnknownVariables(body)).toEqual(['total_amount', 'deposit_amount'])
  })

  it('finds mentions nested inside lists and de-duplicates them', () => {
    const body = docOf({
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [para(mention('nope'))] },
        { type: 'listItem', content: [para(mention('nope'), mention('couple_name'))] },
      ],
    })
    expect(findUnknownVariables(body)).toEqual(['nope'])
  })

  it('agrees with what renderContractHtml would actually emit', () => {
    // The guard exists precisely because the renderer falls back to the raw
    // token rather than failing, so the two must not drift apart.
    const body = docOf(para({ type: 'text', text: 'Fee: ' }, mention('total_amount')))
    const html = renderContractHtml(body, buildContractVariables(base))
    expect(html).toContain('{{total_amount}}')
    expect(findUnknownVariables(body)).toEqual(['total_amount'])
  })
})

describe('mark preservation across substitution', () => {
  it('keeps a variable inside italic copy italic', () => {
    // Regression: substituteMentions used to return a bare text node, so
    // "<em> (the {{vendor_role}}) </em>" rendered as three runs with the
    // resolved value orphaned outside the <em>.
    const body = docOf({
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'italic' }], text: ' (the ' },
        { type: 'mention', attrs: { id: 'vendor_role' }, marks: [{ type: 'italic' }] },
        { type: 'text', marks: [{ type: 'italic' }], text: ') ' },
      ],
    })
    const html = renderContractHtml(body, {
      ...buildContractVariables(base),
      vendor_role: 'DJ',
    })
    expect(html).toContain('<em> (the DJ) </em>')
  })
})

describe('tables in the contract body', () => {
  const cell = (text: string, attrs: Record<string, unknown> = {}) => ({
    type: 'tableCell',
    attrs: { colspan: 1, rowspan: 1, colwidth: null, ...attrs },
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })
  const header = (text: string) => ({
    type: 'tableHeader',
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })
  const table = docOf({
    type: 'table',
    content: [
      { type: 'tableRow', content: [header('Service'), header('Fee')] },
      { type: 'tableRow', content: [cell('Reception'), cell('$900')] },
      { type: 'tableRow', content: [cell('Total', { colspan: 2 })] },
    ],
  })

  it('renders a table instead of throwing "Unknown node type"', () => {
    // Regression: the sanitiser allowed <table> long before any renderer
    // registered the extension, so a table would have failed the send.
    const html = renderContractHtml(table, buildContractVariables(base))
    expect(html).toContain('<table')
    expect(html).toContain('<th')
    expect(html).toContain('Reception')
  })

  it('keeps merged cells through sanitisation', () => {
    expect(renderContractHtml(table, buildContractVariables(base))).toContain('colspan="2"')
  })

  it('resolves variables inside table cells', () => {
    const withVar = docOf({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'venue' } }] }],
            },
          ],
        },
      ],
    })
    expect(renderContractHtml(withVar, buildContractVariables(base))).toContain('The Barn')
  })
})

describe('partner and supplier detail variables', () => {
  it('resolves each partner separately', () => {
    const vars = buildContractVariables({
      ...base,
      couple: {
        ...base.couple,
        primary_name: 'Sam Rivera',
        secondary_name: 'Alex Rivera',
      },
    })
    expect(vars.partner_1_name).toBe('Sam Rivera')
    expect(vars.partner_2_name).toBe('Alex Rivera')
  })

  it('falls back to the couple display name when partner 1 is unset', () => {
    // Couples created before the split fields existed only have `name`.
    expect(buildContractVariables(base).partner_1_name).toBe('Sam and Alex')
  })

  it('dashes partner 2 for a single-signatory couple', () => {
    expect(buildContractVariables(base).partner_2_name).toBe('-')
  })

  it('pulls supplier details from settings metadata and the account email', () => {
    const vars = buildContractVariables({
      ...base,
      userMeta: {
        business_name: 'Zebri',
        abn: '12 345 678 901',
        phone: '+61 400 000 000',
        website: 'https://zebri.example',
        address_text: '1 Test St, Melbourne',
      },
      userEmail: 'jo@example.com',
    })
    expect(vars.mc_abn).toBe('12 345 678 901')
    expect(vars.mc_email).toBe('jo@example.com')
    expect(vars.mc_phone).toBe('+61 400 000 000')
    expect(vars.mc_website).toBe('https://zebri.example')
    expect(vars.mc_address).toBe('1 Test St, Melbourne')
  })

  it('dashes blank and whitespace-only supplier details', () => {
    const vars = buildContractVariables({ ...base, userMeta: { abn: '   ' } })
    expect(vars.mc_abn).toBe('-')
    expect(vars.mc_email).toBe('-')
  })

  it('keeps every catalogue id resolvable, so none can print raw', () => {
    // The guard and the resolver must not drift: a catalogue entry with no
    // value would render as "{{id}}" in a signed document.
    const vars = buildContractVariables(base) as unknown as Record<string, unknown>
    for (const v of CONTRACT_VARIABLES) {
      expect(vars[v.id], `${v.id} has no resolved value`).toBeDefined()
    }
  })
})

describe('couple_name names both partners', () => {
  it('composes both partners in full', () => {
    const vars = buildContractVariables({
      ...base,
      couple: {
        name: 'Arjun',
        email: 'a@x.com',
        primary_name: 'Arjun Punekar',
        secondary_name: 'Anita Punekar',
      },
    })
    expect(vars.couple_name).toBe('Arjun Punekar and Anita Punekar')
  })

  it('falls back to the one partner on file', () => {
    // Reported: a service agreement naming the party as just "Arjun".
    const vars = buildContractVariables({
      ...base,
      couple: { name: 'Arjun', email: 'a@x.com', primary_name: 'Arjun Punekar' },
    })
    expect(vars.couple_name).toBe('Arjun Punekar')
  })

  it('uses the legacy couple name only when no partner is captured', () => {
    expect(
      buildContractVariables({ ...base, couple: { name: 'Arjun', email: null } }).couple_name,
    ).toBe('Arjun')
  })
})

describe('template preview renders tables', () => {
  it('does not throw on a table authored in a contract template', async () => {
    // The template editor now offers tables, and renderTemplateChips runs the
    // same generateHTML gauntlet: a missing extension throws outright.
    const { renderTemplateChips } = await import('@/lib/email/templates')
    const table = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Service' }] }],
                },
              ],
            },
          ],
        },
      ],
    }
    const html = renderTemplateChips(table as never)
    expect(html).toContain('<table')
    expect(html).toContain('Service')
  })
})

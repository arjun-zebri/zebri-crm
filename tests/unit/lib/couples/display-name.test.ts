import { describe, expect, it } from 'vitest'

import { coupleDisplayName } from '@/lib/couples/display-name'

describe('coupleDisplayName', () => {
  it('names both partners in full', () => {
    expect(
      coupleDisplayName({
        name: 'Arjun',
        primary_name: 'Arjun Punekar',
        secondary_name: 'Anita Punekar',
      }),
    ).toBe('Arjun Punekar and Anita Punekar')
  })

  it('falls back to the one partner on file', () => {
    // The reported case: a contract naming the party as just "Arjun".
    expect(coupleDisplayName({ name: 'Arjun', primary_name: 'Arjun Punekar' })).toBe(
      'Arjun Punekar',
    )
    expect(coupleDisplayName({ name: 'Arjun', secondary_name: 'Anita Punekar' })).toBe(
      'Anita Punekar',
    )
  })

  it('uses the legacy couple name only when no partner is captured', () => {
    expect(coupleDisplayName({ name: 'Arjun' })).toBe('Arjun')
  })

  it('treats whitespace-only values as missing', () => {
    expect(coupleDisplayName({ name: 'Arjun', primary_name: '  ', secondary_name: '' })).toBe(
      'Arjun',
    )
    expect(
      coupleDisplayName({ name: '  ', primary_name: 'Sam', secondary_name: '   ' }),
    ).toBe('Sam')
  })

  it('returns an empty string when nothing is on file', () => {
    expect(coupleDisplayName({})).toBe('')
    expect(coupleDisplayName(null)).toBe('')
  })
})

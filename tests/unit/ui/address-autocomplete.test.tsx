import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { AddressAutocomplete } from '@/components/ui/address-autocomplete'

function mockFetch() {
  return vi.fn(async (url: string) => {
    if (url.includes('address-autocomplete')) {
      return {
        json: async () => ({
          suggestions: [
            { placePrediction: { placeId: 'p1', text: { text: '12 Smith St, Fitzroy VIC' } } },
          ],
        }),
      } as Response
    }
    return {
      json: async () => ({ location: { latitude: -37.8, longitude: 144.9 } }),
    } as Response
  })
}

describe('AddressAutocomplete', () => {
  beforeEach(() => { vi.stubGlobal('fetch', mockFetch()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports typed text with null coordinates', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AddressAutocomplete value="" onChange={onChange} label="Home address" />)

    await user.type(screen.getByLabelText('Home address'), '12')

    expect(onChange).toHaveBeenLastCalledWith({ text: '12', lat: null, lng: null })
  })

  it('resolves coordinates when a suggestion is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AddressAutocomplete value="12" onChange={vi.fn()} onSelect={onSelect} label="Home address" />,
    )

    await user.type(screen.getByLabelText('Home address'), '2 Smith')
    const option = await screen.findByText('12 Smith St, Fitzroy VIC')
    await user.click(option)

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        text: '12 Smith St, Fitzroy VIC',
        lat: -37.8,
        lng: 144.9,
      })
    })
  })
})

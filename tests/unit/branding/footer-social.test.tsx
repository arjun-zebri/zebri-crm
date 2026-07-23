import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { RenderFooter } from '@/lib/branding/public-blocks/footer'
import { makeBranding } from './helpers'

describe('footer social links', () => {
  it('renders only toggled-on networks that have a URL', () => {
    const branding = makeBranding({
      instagram_url: 'https://insta/x',
      twitter_url: '',
    })
    render(
      <RenderFooter
        block={{
          id: 'f',
          type: 'footer',
          showInstagram: true,
          showTwitter: true,
        }}
        branding={branding}
      />,
    )
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute('href', 'https://insta/x')
    expect(screen.queryByRole('link', { name: /twitter/i })).toBeNull()
  })
})

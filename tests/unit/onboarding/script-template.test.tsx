import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ScriptTemplate } from '@/app/(dashboard)/onboarding/previews/script-template'

describe('ScriptTemplate', () => {
  it('shows the finished template under reduced motion', () => {
    render(<ScriptTemplate active reducedMotion />)
    expect(screen.getByText('Enquiry reply')).toBeInTheDocument()
    // The editor shows raw tokens, exactly like the real template editor.
    expect(screen.getByTestId('couple-name-chip')).toHaveTextContent('{{couple.primary_name}}')
    const templatesNav = screen.getAllByText('Templates').find(el => el.hasAttribute('data-active'))
    expect(templatesNav).toHaveAttribute('data-active', 'true')
  })

  it('shows nothing typed when inactive', () => {
    render(<ScriptTemplate active={false} reducedMotion={false} />)
    expect(screen.queryByTestId('couple-name-chip')).not.toBeInTheDocument()
  })
})

/**
 * The read-only contract-template preview must render tables.
 *
 * Two ways this broke: `renderTemplateChips` had no TableKit, so a table threw
 * "Unknown node type: table"; and the preview carries its own type scale
 * rather than `.contract-content`, so the shared table CSS never reached it
 * and tables rendered as unstyled text.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContractTemplatePreview } from '@/app/(dashboard)/templates/contract-template-preview'

const cell = (text: string, type: 'tableCell' | 'tableHeader' = 'tableCell') => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

const docWithTable = {
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('Service', 'tableHeader'), cell('Fee', 'tableHeader')] },
        { type: 'tableRow', content: [cell('Reception'), cell('$900')] },
      ],
    },
  ],
} as never

describe('ContractTemplatePreview', () => {
  it('renders a table rather than throwing', () => {
    const { container } = render(<ContractTemplatePreview content={docWithTable} />)
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect(container.querySelectorAll('th')).toHaveLength(2)
    expect(container.textContent).toContain('Reception')
  })

  it('carries the table styling utilities, since it does not use .contract-content', () => {
    const { container } = render(<ContractTemplatePreview content={docWithTable} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).not.toContain('contract-content')
    expect(wrapper.className).toContain('[&_td]:border')
    expect(wrapper.className).toContain('[&_table]:border-collapse')
  })
})

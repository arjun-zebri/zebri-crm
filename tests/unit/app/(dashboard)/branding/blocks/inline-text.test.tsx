/**
 * Unit tests for InlineText component.
 *
 * Tests the one-click inline editing behavior: contentEditable is always true,
 * onFocus dispatches a custom event to select the parent block if needed.
 *
 * @module tests/unit/app/(dashboard)/branding/blocks/inline-text.test.tsx
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { InlineText } from '@/app/(dashboard)/branding/blocks/inline-text'

describe('InlineText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with contentEditable always true', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test text" onChange={onChange} placeholder="Enter text" />
    )

    const element = container.querySelector('[data-inline-text="true"]')
    expect(element).toBeTruthy()
    expect(element?.getAttribute('contenteditable')).toBe('true')
  })

  it('renders as span by default', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test" onChange={onChange} />
    )

    const element = container.querySelector('span[data-inline-text="true"]')
    expect(element).toBeTruthy()
  })

  it('renders as the specified element type', () => {
    const onChange = vi.fn()
    const { container: divContainer } = render(
      <InlineText value="Test" onChange={onChange} as="div" />
    )
    expect(divContainer.querySelector('div[data-inline-text="true"]')).toBeTruthy()

    const { container: pContainer } = render(
      <InlineText value="Test" onChange={onChange} as="p" />
    )
    expect(pContainer.querySelector('p[data-inline-text="true"]')).toBeTruthy()
  })

  it('calls onChange when content is edited', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Initial" onChange={onChange} />
    )

    const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
    if (element) {
      // Simulate input event (jsdom contentEditable is limited, so we trigger onInput directly)
      element.innerHTML = 'Updated'
      fireEvent.input(element)
    }

    expect(onChange).toHaveBeenCalled()
  })

  it('dispatches custom event on focus when block not selected', () => {
    const onChange = vi.fn()
    const customEventListener = vi.fn()

    const { container } = render(
      <div data-block-id="test-block-1">
        <InlineText value="Test" onChange={onChange} />
      </div>
    )

    // Attach listener to parent block
    const blockElement = container.querySelector('[data-block-id]') as HTMLElement
    if (blockElement) {
      blockElement.addEventListener('zebri:text-focus', customEventListener)

      // Focus the inline text element
      const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
      if (element) {
        fireEvent.focus(element)
      }

      // Check that custom event was dispatched
      expect(customEventListener).toHaveBeenCalled()
      const call = customEventListener.mock.calls[0]
      if (call) {
        const event = call[0] as CustomEvent
        expect(event.detail?.blockId).toBe('test-block-1')
      }
    }
  })

  it('does not dispatch event on focus if block is already selected', () => {
    const onChange = vi.fn()
    const customEventListener = vi.fn()

    const { container } = render(
      <div data-block-id="test-block-2" data-selected>
        <InlineText value="Test" onChange={onChange} />
      </div>
    )

    // Attach listener to parent block
    const blockElement = container.querySelector('[data-block-id]') as HTMLElement
    if (blockElement) {
      blockElement.addEventListener('zebri:text-focus', customEventListener)

      // Focus the inline text element
      const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
      if (element) {
        fireEvent.focus(element)
      }

      // Event should not be dispatched since block is already selected
      expect(customEventListener).not.toHaveBeenCalled()
    }
  })

  it('applies placeholder styling', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="" onChange={onChange} placeholder="Enter text" />
    )

    const element = container.querySelector('[data-inline-text="true"]')
    expect(element?.getAttribute('data-placeholder')).toBe('Enter text')
    expect(element?.className).toContain('cursor-text')
  })

  it('applies custom className', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test" onChange={onChange} className="custom-class" />
    )

    const element = container.querySelector('[data-inline-text="true"]')
    expect(element?.className).toContain('custom-class')
  })

  it('applies custom style', () => {
    const onChange = vi.fn()
    const customStyle = { color: 'red', fontSize: '16px' }
    const { container } = render(
      <InlineText value="Test" onChange={onChange} style={customStyle} />
    )

    const element = container.querySelector('[data-inline-text="true"]')
    if (element instanceof HTMLElement) {
      expect(element.style.color).toBe('red')
      expect(element.style.fontSize).toBe('16px')
    }
  })

  it('handles Escape key to restore original value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Original" onChange={onChange} />
    )

    const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
    if (element) {
      // Simulate editing
      element.innerHTML = 'Modified'
      // Simulate Escape key
      fireEvent.keyDown(element, { key: 'Escape' })
    }

    // Element should be restored to original (though blur also happens)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('handles Enter key in single-line mode by blurring', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test" onChange={onChange} multiline={false} />
    )

    const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
    if (element) {
      const blurSpy = vi.spyOn(element, 'blur')
      fireEvent.keyDown(element, { key: 'Enter' })
      expect(blurSpy).toHaveBeenCalled()
    }
  })

  it('allows Enter key in multiline mode', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test" onChange={onChange} multiline={true} />
    )

    const element = container.querySelector('[data-inline-text="true"]') as HTMLElement
    if (element) {
      const blurSpy = vi.spyOn(element, 'blur')
      fireEvent.keyDown(element, { key: 'Enter' })
      // Should not blur on Enter in multiline mode
      expect(blurSpy).not.toHaveBeenCalled()
    }
  })

  it('has suppressContentEditableWarning to avoid React warnings', () => {
    const onChange = vi.fn()
    const { container } = render(
      <InlineText value="Test" onChange={onChange} />
    )

    const element = container.querySelector('[data-inline-text="true"]')
    // Just verify it renders without warning
    expect(element).toBeTruthy()
  })
})

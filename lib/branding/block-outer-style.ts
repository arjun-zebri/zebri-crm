import type { CSSProperties } from 'react'

// Type-only import (erased at runtime); block types live under the editor surface.
// eslint-disable-next-line no-restricted-imports
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

/**
 * Compute the outer wrapper styles for a block based on its padding, background,
 * border, alignment, and spacing fields. Returns only defined properties.
 * Used by both the editor (BlockFrame) and public renderer (BlockOuter) to
 * ensure consistency and prevent visual drift.
 */
export function blockOuterStyle(
  block: Block,
  opts: { cornerRadius: number }
): CSSProperties {
  const style: CSSProperties = {}

  // Padding: include only if set
  if (block.padTop !== undefined) {
    style.paddingTop = block.padTop
  }
  if (block.padRight !== undefined) {
    style.paddingRight = block.padRight
  }
  if (block.padBottom !== undefined) {
    style.paddingBottom = block.padBottom
  }
  if (block.padLeft !== undefined) {
    style.paddingLeft = block.padLeft
  }

  // Background color
  if (block.bgColor !== undefined) {
    style.background = block.bgColor
  }

  // Border (preserve existing border logic)
  const borderWidth = block.borderWidth ?? 0
  if (borderWidth > 0) {
    style.borderWidth = borderWidth
    style.borderColor = block.borderColor || '#E5E7EB'
    style.borderStyle = 'solid'
  }

  // Border radius: only apply when a border/radius override exists
  if (borderWidth > 0 || block.blockRadius !== undefined) {
    style.borderRadius = block.blockRadius ?? opts.cornerRadius
  }

  // Maximum width constraint
  if (block.maxWidthPx !== undefined) {
    style.maxWidth = block.maxWidthPx
  }

  // Horizontal alignment via margin
  if (block.align === 'center') {
    style.marginInline = 'auto'
  } else if (block.align === 'right') {
    style.marginLeft = 'auto'
  }

  // Vertical spacing (margins)
  if (block.spaceAbove !== undefined) {
    style.marginTop = block.spaceAbove
  }
  if (block.spaceBelow !== undefined) {
    style.marginBottom = block.spaceBelow
  }

  return style
}

/**
 * Check if a block has any outer style fields set. Used to determine if the
 * BlockOuter wrapper should render or take the fast path (no wrapper).
 */
export function hasOuterStyle(block: Block): boolean {
  return !!(
    block.padTop !== undefined ||
    block.padRight !== undefined ||
    block.padBottom !== undefined ||
    block.padLeft !== undefined ||
    block.bgColor !== undefined ||
    block.borderWidth !== undefined ||
    block.blockRadius !== undefined ||
    block.maxWidthPx !== undefined ||
    block.align !== undefined ||
    block.spaceAbove !== undefined ||
    block.spaceBelow !== undefined
  )
}

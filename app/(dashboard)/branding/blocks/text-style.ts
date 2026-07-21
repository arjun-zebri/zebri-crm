import { FONT_STACKS, type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import { applyCase, cssTextTransform, type TextCase } from '@/lib/branding/text-case'

import type { TextStyle } from './types'

export interface TextStyleDefaults {
  fontFamily: HeadingFont | BodyFont
  fontSize: number
  fontWeight: FontWeight
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  /** Text transformation default. Typically 'none'. */
  textTransform?: TextCase
}

export function resolveTextStyle(
  style: TextStyle | undefined,
  defaults: TextStyleDefaults,
): React.CSSProperties {
  const fontFamily = style?.fontFamily ?? defaults.fontFamily
  const css: React.CSSProperties = {
    fontFamily: FONT_STACKS[fontFamily],
    fontSize: `${style?.fontSize ?? defaults.fontSize}px`,
    fontWeight: style?.fontWeight ?? defaults.fontWeight,
    color: style?.color ?? defaults.color,
    textAlign: style?.align ?? defaults.align,
    lineHeight: style?.lineHeight ?? defaults.lineHeight,
    letterSpacing: `${style?.letterSpacing ?? defaults.letterSpacing}em`,
    // Sentence case has no CSS transform; it emits 'none' here and is applied
    // to the text string separately (see applyCase). The others map straight
    // to their CSS text-transform value.
    textTransform: cssTextTransform(style?.textTransform ?? defaults.textTransform),
  }
  if (style?.italic) css.fontStyle = 'italic'
  if (style?.underline) css.textDecoration = 'underline'
  return css
}

/**
 * Apply the effective case of a resolved text style to a plain string. Reads
 * the same effective transform as {@link resolveTextStyle} (block override
 * falling back to role defaults), so the string and its CSS always agree. Only
 * sentence case changes the string; every other case is handled by CSS and the
 * text is returned unchanged. Use on plain text nodes — never on HTML markup.
 *
 * @param text - The plain string to render.
 * @param style - The block-level style override (may be undefined).
 * @param defaults - The role defaults the style falls back to.
 * @returns The case-adjusted string.
 */
export function caseText(
  text: string,
  style: TextStyle | undefined,
  defaults: TextStyleDefaults,
): string {
  return applyCase(text, style?.textTransform ?? defaults.textTransform)
}

export const TEXT_COLOR_PRESETS = [
  '#111827',
  '#374151',
  '#6B7280',
  '#9CA3AF',
  '#FFFFFF',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
] as const

import { FONT_STACKS, type HeadingFont, type BodyFont, type FontWeight } from '@/lib/branding/fonts'
import type { TextStyle } from './types'

export interface TextStyleDefaults {
  fontFamily: HeadingFont | BodyFont
  fontSize: number
  fontWeight: FontWeight
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
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
  }
  if (style?.italic) css.fontStyle = 'italic'
  if (style?.underline) css.textDecoration = 'underline'
  return css
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

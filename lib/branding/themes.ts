import type { HeadingFont, BodyFont, FontWeight } from './fonts'

export type Density = 'compact' | 'cozy' | 'roomy'

export interface ThemePreset {
  name: string
  color: string         // primary / brand
  accent: string        // accent
  surface: string       // page surface
  text: string          // primary text
  heading: string       // primary heading colour
  subheading: string    // secondary heading / subtitle colour
  muted: string         // secondary / muted text
  border: string        // hairlines and borders
  headingFont: HeadingFont
  bodyFont: BodyFont
  headingWeight: FontWeight
  bodyWeight: FontWeight
  density: Density
  radius: number
  scale: number
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
  minimal: {
    name: 'Minimal',
    color: '#111827',
    accent: '#111827',
    surface: '#FFFFFF',
    text: '#6B7280',
    heading: '#111827',
    subheading: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    headingFont: 'inter',
    bodyFont: 'inter',
    headingWeight: 600,
    bodyWeight: 400,
    density: 'cozy',
    radius: 8,
    scale: 1,
  },
  bold: {
    name: 'Bold',
    color: '#FF6B35',
    accent: '#FFC107',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#0F172A',
    subheading: '#0F172A',
    muted: '#6B7280',
    border: '#E5E7EB',
    headingFont: 'space_grotesk',
    bodyFont: 'inter',
    headingWeight: 700,
    bodyWeight: 400,
    density: 'cozy',
    radius: 12,
    scale: 1,
  },
  elegant: {
    name: 'Elegant',
    color: '#0F172A',
    accent: '#B45309',
    surface: '#FAFAF7',
    text: '#1F2937',
    heading: '#1F2937',
    subheading: '#1F2937',
    muted: '#6B7280',
    border: '#E5E7EB',
    headingFont: 'playfair',
    bodyFont: 'inter',
    headingWeight: 500,
    bodyWeight: 400,
    density: 'roomy',
    radius: 4,
    scale: 1,
  },
  modern: {
    name: 'Modern',
    color: '#0EA5E9',
    accent: '#A7F3D0',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#0F172A',
    subheading: '#0F172A',
    muted: '#6B7280',
    border: '#E5E7EB',
    headingFont: 'dm_serif',
    bodyFont: 'dm_sans',
    headingWeight: 400,
    bodyWeight: 400,
    density: 'cozy',
    radius: 16,
    scale: 1,
  },
  classic: {
    name: 'Classic',
    color: '#7C2D12',
    accent: '#D97706',
    surface: '#FBF8F3',
    text: '#1F2937',
    heading: '#1F2937',
    subheading: '#1F2937',
    muted: '#78716C',
    border: '#E5E7EB',
    headingFont: 'cormorant',
    bodyFont: 'inter',
    headingWeight: 500,
    bodyWeight: 400,
    density: 'roomy',
    radius: 0,
    scale: 1.05,
  },
  editorial: {
    name: 'Editorial',
    color: '#111827',
    accent: '#DC2626',
    surface: '#F8F4EC',
    text: '#111827',
    heading: '#111827',
    subheading: '#111827',
    muted: '#57534E',
    border: '#E5E7EB',
    headingFont: 'fraunces',
    bodyFont: 'source_sans',
    headingWeight: 500,
    bodyWeight: 400,
    density: 'roomy',
    radius: 2,
    scale: 1,
  },
  blush: {
    name: 'Blush',
    color: '#BE185D',
    accent: '#F9A8D4',
    surface: '#FFF7FA',
    text: '#3F1530',
    heading: '#3F1530',
    subheading: '#3F1530',
    muted: '#9F7AA1',
    border: '#E5E7EB',
    headingFont: 'instrument_serif',
    bodyFont: 'public_sans',
    headingWeight: 400,
    bodyWeight: 400,
    density: 'cozy',
    radius: 14,
    scale: 1,
  },
}

export type ThemeId = keyof typeof THEME_PRESETS
export type ThemeIdOrCustom = ThemeId | 'custom'

export const THEME_IDS = Object.keys(THEME_PRESETS) as ThemeId[]

export const DEFAULT_THEME: ThemePreset = THEME_PRESETS.minimal

export const COLOR_PALETTE = [
  '#000000',
  '#0F172A',
  '#1E40AF',
  '#7C2D12',
  '#BE185D',
  '#FF6B35',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#6366F1',
  '#8B5CF6',
  '#DC2626',
] as const

export const ACCENT_PALETTE = [
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#A855F7',
  '#6366F1',
  '#3B82F6',
  '#0EA5E9',
  '#14B8A6',
  '#10B981',
  '#84CC16',
  '#FBBF24',
] as const

export const SURFACE_PALETTE = [
  '#FFFFFF',
  '#FAFAF7',
  '#FBF8F3',
  '#F8F4EC',
  '#F9FAFB',
  '#F3F4F6',
  '#FFF7FA',
] as const

export const TEXT_PALETTE = [
  '#0F172A',
  '#1F2937',
  '#374151',
  '#111827',
  '#FAFAFA',
  '#FFFFFF',
] as const

export const MUTED_PALETTE = [
  '#6B7280',
  '#78716C',
  '#9CA3AF',
  '#57534E',
  '#9F7AA1',
] as const

export const BORDER_PALETTE = [
  '#F3F4F6',
  '#E5E7EB',
  '#D1D5DB',
  '#9CA3AF',
  '#6B7280',
  '#111827',
] as const

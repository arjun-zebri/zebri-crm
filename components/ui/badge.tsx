interface BadgeProps {
  variant: 'default' | 'new' | 'contacted' | 'confirmed' | 'paid' | 'complete' | 'venue' | 'celebrant' | 'photographer' | 'videographer' | 'dj' | 'florist' | 'hair_makeup' | 'caterer' | 'photo_booth' | 'lighting_av' | 'planner' | 'other'
  children: React.ReactNode
}

const variantStyles: Record<BadgeProps['variant'], { bg: string; text: string; dot: string }> = {
  default: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  new: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  contacted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  confirmed: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  complete: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  venue: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  celebrant: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
  photographer: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400' },
  videographer: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  dj: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  florist: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-400' },
  hair_makeup: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  caterer: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  photo_booth: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-400' },
  lighting_av: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-400' },
  planner: { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-400' },
  other: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  const style = variantStyles[variant]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {children}
    </span>
  )
}

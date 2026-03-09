interface BadgeProps {
  variant: 'default' | 'new' | 'contacted' | 'confirmed' | 'paid' | 'complete'
  children: React.ReactNode
}

const variantStyles: Record<BadgeProps['variant'], { bg: string; text: string; dot: string }> = {
  default: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  new: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  contacted: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  confirmed: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  complete: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
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

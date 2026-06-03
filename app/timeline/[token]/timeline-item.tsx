import { CATEGORY_LABELS } from '@/types/contact';

interface PublicTimelineItemProps {
  time: string | null;
  title: string;
  description: string | null;
  duration_min: number | null;
  contact: { name: string; category: string } | null;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return " - ";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function PublicTimelineItem({
  time,
  title,
  description,
  duration_min,
  contact,
}: PublicTimelineItemProps) {
  const categoryLabel = contact?.category
    ? CATEGORY_LABELS[contact.category as keyof typeof CATEGORY_LABELS] ||
      contact.category
    : null;

  return (
    <div className="relative ml-4 pl-6 pb-6 border-l-2 border-border last:pb-0">
      {/* Rail dot */}
      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-border-strong" />

      {/* Time row */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {formatTime(time)}
        </span>
        {duration_min && (
          <span className="text-xs text-text-subtle">~{duration_min} min</span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-text">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-muted mt-0.5">{description}</p>
      )}

      {/* Assigned contact */}
      {contact && (
        <p className="text-xs text-text-subtle mt-1">
          {contact.name}
          {categoryLabel ? ` · ${categoryLabel}` : ""}
        </p>
      )}
    </div>
  );
}

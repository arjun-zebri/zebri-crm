/**
 * Template picker modal for creating a meeting type from a starting point.
 *
 * Lives behind a button rather than on the page so the tab stays about the
 * meeting types an MC already has. Choosing a template closes this modal and
 * opens the create form prefilled; nothing is written until that form is
 * saved, so browsing here is free.
 *
 * @module app/(dashboard)/calendar/meeting-type-template-picker
 */
'use client';

import { MapPin, Phone, Video } from 'lucide-react';

import { Modal } from '@/components/ui/modal';

import {
  MEETING_TYPE_TEMPLATES,
  templateDurationLabel,
  type MeetingTypeTemplate,
} from './meeting-type-templates';

/** Icon and wording for each way of meeting. */
const LOCATION: Record<
  MeetingTypeTemplate['locationType'],
  { label: string; Icon: typeof Video }
> = {
  video: { label: 'video', Icon: Video },
  phone: { label: 'phone', Icon: Phone },
  in_person: { label: 'in person', Icon: MapPin },
};

export interface MeetingTypeTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen template. The caller opens the prefilled form. */
  onSelect: (template: MeetingTypeTemplate) => void;
}

/**
 * Modal listing the starter meeting types.
 *
 * @param props - MeetingTypeTemplatePickerProps
 */
export function MeetingTypeTemplatePicker({
  isOpen,
  onClose,
  onSelect,
}: MeetingTypeTemplatePickerProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start from a template" size="lg">
      <p className="text-body text-text-muted mb-4">
        Built from how most MCs and celebrants run their week. Pick one to open a
        prefilled form, then change anything you like before saving.
      </p>

      <div className="flex flex-col gap-2">
        {MEETING_TYPE_TEMPLATES.map((template) => {
          const { label, Icon } = LOCATION[template.locationType];

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="text-left w-full p-3 rounded-control border border-border bg-surface hover:bg-surface-muted transition flex gap-3"
              data-testid={`meeting-type-template-${template.id}`}
            >
              <div className="w-8 h-8 rounded-control bg-surface-emphasis flex items-center justify-center shrink-0">
                <Icon size={16} strokeWidth={1.5} className="text-text-muted" />
              </div>
              <div className="min-w-0">
                <div className="text-body font-medium text-text">
                  {template.name}
                </div>
                <div className="text-body text-text-muted">
                  {templateDurationLabel(template.durationMinutes)} · {label}
                </div>
                {/* Two lines always: clamped so a long description cannot
                    push its row taller, and reserved so a short one cannot
                    make its row shorter. min-h-10 is exactly two lines at the
                    body line height of 20px. Without both halves the rows step
                    up and down the list. */}
                <p className="text-body text-text-subtle mt-1 line-clamp-2 min-h-10">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * Client-safe action UI catalogue.
 *
 * The action picker, inspector, and canvas need each action's display
 * metadata (label, icon, category, description) — but importing the full
 * `actionRegistry` (`lib/automations/actions`) would drag the server-only
 * handlers (and their transitive deps: nodemailer, node:crypto, the
 * service-role client, …) into the browser bundle. This module carries
 * just the metadata, with no handler imports, so client components can
 * read it safely. Parity with the registry is enforced by
 * `tests/unit/lib/automations/action-ui-parity.test.ts`.
 *
 * @module lib/automations/actions/ui
 */
import type { ActionType } from '@/types/automations'

/** Display metadata for one action type (picker tiles + inspector chrome). */
export interface ActionUi {
  category:
    | 'general'
    | 'couple'
    | 'calendar'
    | 'consultation'
    | 'payments'
    | 'compliance'
    | 'segmentation'
    | 'integration'
    | 'post_event'
    | 'flow'
  label: string
  description: string
  icon: string
  /** Render the picker tile in a disabled "coming soon" state. */
  comingSoon?: boolean
  /** Pre-fill a label when the action is added (the user can rename). */
  defaultLabel?: string
}

export const actionUi: Partial<Record<ActionType, ActionUi>> = {
    "send_email": {
      "category": "general",
      "label": "Send email",
      "description": "Send a custom email with variables",
      "icon": "Mail",
      "defaultLabel": "Send email"
    },
    "send_sms": {
      "category": "general",
      "label": "Send SMS",
      "description": "Send a text message (coming soon - needs Twilio)",
      "icon": "MessageSquare",
      "comingSoon": true
    },
    "send_whatsapp": {
      "category": "general",
      "label": "Send WhatsApp",
      "description": "Send a WhatsApp message (coming soon)",
      "icon": "MessageCircle",
      "comingSoon": true
    },
    "update_couple_stage": {
      "category": "couple",
      "label": "Update couple stage",
      "description": "Move the couple to a new pipeline status",
      "icon": "ArrowRight"
    },
    "add_note": {
      "category": "couple",
      "label": "Add note",
      "description": "Append a note to the couple",
      "icon": "StickyNote"
    },
    "update_custom_fields": {
      "category": "couple",
      "label": "Update custom fields",
      "description": "Set values on per-couple custom fields",
      "icon": "Settings2"
    },
    "send_portal_link": {
      "category": "couple",
      "label": "Send portal access link",
      "description": "Share the couple portal link with the couple",
      "icon": "Link2"
    },
    "request_information": {
      "category": "couple",
      "label": "Request information",
      "description": "Email the couple asking them to fill in a portal section",
      "icon": "MailQuestion"
    },
    "create_couple": {
      "category": "couple",
      "label": "Create couple",
      "description": "Add a new couple to your CRM",
      "icon": "UserPlus"
    },
    "pause_couple_automations": {
      "category": "flow",
      "label": "Pause this couple's automations",
      "description": "Halt every other running automation on this couple",
      "icon": "Pause"
    },
    "create_task": {
      "category": "general",
      "label": "Create task",
      "description": "Add a task for yourself",
      "icon": "ListPlus"
    },
    "update_task": {
      "category": "general",
      "label": "Update task",
      "description": "Update an existing task",
      "icon": "ListChecks"
    },
    "create_calendar_event": {
      "category": "calendar",
      "label": "Create calendar event",
      "description": "Add an event to your calendar",
      "icon": "CalendarPlus"
    },
    "create_reminder": {
      "category": "calendar",
      "label": "Create reminder",
      "description": "A reminder to yourself on a future date",
      "icon": "BellRing"
    },
    "send_quote": {
      "category": "payments",
      "label": "Send quote",
      "description": "Email the couple a quote",
      "icon": "FileText"
    },
    "send_contract": {
      "category": "payments",
      "label": "Send contract",
      "description": "Email the couple a contract for signing",
      "icon": "FileSignature"
    },
    "send_invoice": {
      "category": "payments",
      "label": "Send invoice",
      "description": "Email the couple an invoice",
      "icon": "Receipt"
    },
    "send_couple_questionnaire": {
      "category": "couple",
      "label": "Send questionnaire",
      "description": "Email the couple a questionnaire to fill in",
      "icon": "ClipboardList"
    },
    "trigger_payment_reminder": {
      "category": "payments",
      "label": "Send payment reminder",
      "description": "Re-send the most recent unpaid invoice",
      "icon": "AlertTriangle"
    },
    "generate_run_sheet_pdf": {
      "category": "post_event",
      "label": "Send run sheet",
      "description": "Email a link to the event run sheet (timeline)",
      "icon": "ClipboardList"
    },
    "create_timeline_event": {
      "category": "couple",
      "label": "Create timeline event",
      "description": "Add an item to the event timeline",
      "icon": "Clock"
    },
    "update_timeline_event": {
      "category": "couple",
      "label": "Update timeline event",
      "description": "Edit a timeline item",
      "icon": "Pencil"
    },
    "send_timeline_to_vendors": {
      "category": "couple",
      "label": "Send timeline to vendors",
      "description": "Email a shareable timeline link to every vendor contact",
      "icon": "Send"
    },
    "send_final_run_sheet": {
      "category": "post_event",
      "label": "Send final run sheet",
      "description": "Send the final event run sheet to couple + vendors",
      "icon": "ClipboardList"
    },
    "send_onboarding_pack": {
      "category": "couple",
      "label": "Send onboarding pack",
      "description": "A welcoming \"what happens next\" email",
      "icon": "PackageOpen"
    },
    "send_pre_event_checklist": {
      "category": "couple",
      "label": "Send pre-event checklist",
      "description": "A countdown checklist email",
      "icon": "CheckSquare"
    },
    "send_thank_you_message": {
      "category": "post_event",
      "label": "Send thank-you message",
      "description": "Post-event 'thank you' email",
      "icon": "Heart"
    },
    "request_review": {
      "category": "post_event",
      "label": "Request review",
      "description": "Ask the couple for a Google / vendor-site review",
      "icon": "Star"
    },
    "send_referral_request": {
      "category": "post_event",
      "label": "Send referral request",
      "description": "Ask for word-of-mouth referrals",
      "icon": "Share2"
    },
    "send_anniversary_message": {
      "category": "post_event",
      "label": "Send anniversary message",
      "description": "Annual anniversary touchpoint",
      "icon": "Cake"
    },
    "create_consultation": {
      "category": "consultation",
      "label": "Create consultation",
      "description": "Book a discovery / planning meeting with the couple",
      "icon": "CalendarPlus",
      "comingSoon": true
    },
    "cancel_consultation": {
      "category": "consultation",
      "label": "Cancel consultation",
      "description": "Cancel a scheduled meeting",
      "icon": "CalendarX",
      "comingSoon": true
    },
    "block_calendar_slot": {
      "category": "calendar",
      "label": "Block calendar slot",
      "description": "Block out a time on your calendar (travel, setup, etc.)",
      "icon": "CalendarOff",
      "comingSoon": true
    },
    "unblock_calendar_slot": {
      "category": "calendar",
      "label": "Unblock calendar slot",
      "description": "Release a previously blocked time",
      "icon": "CalendarCheck",
      "comingSoon": true
    },
    "send_calendar_invite": {
      "category": "calendar",
      "label": "Send calendar invite",
      "description": "Email an ICS / Google invite to the couple",
      "icon": "CalendarHeart",
      "comingSoon": true
    },
    "lodge_noim_reminder": {
      "category": "compliance",
      "label": "NOIM reminder",
      "description": "Email the couple a Notice-of-Intended-Marriage prompt",
      "icon": "FileCheck",
      "comingSoon": true
    },
    "generate_noim_pdf": {
      "category": "compliance",
      "label": "Generate NOIM PDF",
      "description": "Render a NOIM form for the couple to sign",
      "icon": "FileText",
      "comingSoon": true
    },
    "generate_donlim_pdf": {
      "category": "compliance",
      "label": "Generate DONLIM PDF",
      "description": "Render the Declaration of No Legal Impediment",
      "icon": "FileText",
      "comingSoon": true
    },
    "generate_marriage_certificate": {
      "category": "compliance",
      "label": "Generate marriage certificate",
      "description": "Produce ceremonial or BDM-official certificate PDF",
      "icon": "Award",
      "comingSoon": true
    },
    "lodge_bdm_paperwork": {
      "category": "compliance",
      "label": "Lodge BDM paperwork",
      "description": "Track state-registry lodgement deadline",
      "icon": "Stamp",
      "comingSoon": true
    },
    "print_label_for_certificate": {
      "category": "compliance",
      "label": "Print certificate label",
      "description": "Queue a mailing label for batch BDM lodgement",
      "icon": "Printer",
      "comingSoon": true
    },
    "assign_tag": {
      "category": "segmentation",
      "label": "Assign tag",
      "description": "Add a tag to the couple",
      "icon": "Tag",
      "comingSoon": true
    },
    "remove_tag": {
      "category": "segmentation",
      "label": "Remove tag",
      "description": "Remove a tag from the couple",
      "icon": "TagOff",
      "comingSoon": true
    },
    "update_lead_score": {
      "category": "segmentation",
      "label": "Update lead score",
      "description": "Adjust the couple's lead score (+/− or set)",
      "icon": "TrendingUp",
      "comingSoon": true
    },
    "add_to_segment": {
      "category": "segmentation",
      "label": "Add to segment",
      "description": "Place the couple in a saved segment",
      "icon": "Users",
      "comingSoon": true
    },
    "remove_from_segment": {
      "category": "segmentation",
      "label": "Remove from segment",
      "description": "Pull the couple out of a segment",
      "icon": "UserMinus",
      "comingSoon": true
    },
    "enqueue_for_newsletter": {
      "category": "segmentation",
      "label": "Queue for newsletter",
      "description": "Schedule the couple into a newsletter send",
      "icon": "Mailbox",
      "comingSoon": true
    },
    "create_invoice_from_quote": {
      "category": "payments",
      "label": "Create invoice from quote",
      "description": "Auto-draft an invoice from the accepted quote",
      "icon": "Receipt"
    },
    "create_quote_from_template": {
      "category": "payments",
      "label": "Create quote from template",
      "description": "Build a draft quote from a saved template",
      "icon": "FilePlus2",
      "comingSoon": true
    },
    "create_contract_from_template": {
      "category": "payments",
      "label": "Create contract from template",
      "description": "Build a draft contract from a saved template",
      "icon": "FileSignature",
      "comingSoon": true
    },
    "void_quote": {
      "category": "payments",
      "label": "Void quote",
      "description": "Cancel an outstanding quote",
      "icon": "Ban",
      "comingSoon": true
    },
    "void_invoice": {
      "category": "payments",
      "label": "Void invoice",
      "description": "Cancel an outstanding invoice",
      "icon": "Ban",
      "comingSoon": true
    },
    "revoke_contract": {
      "category": "payments",
      "label": "Revoke contract",
      "description": "Pull back a sent contract",
      "icon": "Undo2",
      "comingSoon": true
    },
    "apply_discount": {
      "category": "payments",
      "label": "Apply discount",
      "description": "Discount a quote or invoice",
      "icon": "BadgePercent",
      "comingSoon": true
    },
    "add_line_item": {
      "category": "payments",
      "label": "Add line item",
      "description": "Add an item to a quote or invoice (upsell)",
      "icon": "ListPlus",
      "comingSoon": true
    },
    "send_payment_link": {
      "category": "payments",
      "label": "Send payment link",
      "description": "Generate a standalone Stripe link and email it",
      "icon": "Link",
      "comingSoon": true
    },
    "record_offline_payment": {
      "category": "payments",
      "label": "Record offline payment",
      "description": "Log a bank transfer / cash payment to an invoice",
      "icon": "Banknote",
      "comingSoon": true
    },
    "request_payment_method_update": {
      "category": "payments",
      "label": "Request card update",
      "description": "Email the couple to refresh their payment method",
      "icon": "CreditCard",
      "comingSoon": true
    },
    "assign_contact_to_couple": {
      "category": "couple",
      "label": "Assign contact to couple",
      "description": "Link a vendor / contact to this couple",
      "icon": "Link2",
      "comingSoon": true
    },
    "request_vendor_confirmation": {
      "category": "couple",
      "label": "Request vendor confirmation",
      "description": "Ask vendors to confirm the run sheet by deadline",
      "icon": "ClipboardCheck",
      "comingSoon": true
    },
    "escalate_to_phone_call": {
      "category": "couple",
      "label": "Escalate to phone call",
      "description": "Create a high-priority \"call this couple\" task",
      "icon": "Phone",
      "comingSoon": true
    },
    "mark_couple_as_lost": {
      "category": "couple",
      "label": "Mark couple as lost",
      "description": "Terminal status — close out the lead",
      "icon": "XCircle",
      "comingSoon": true
    },
    "share_portal_section_with_vendor": {
      "category": "couple",
      "label": "Share portal section with vendor",
      "description": "Section-scoped magic link for a vendor",
      "icon": "Share2",
      "comingSoon": true
    },
    "clone_couple_to_new_event": {
      "category": "couple",
      "label": "Clone couple to new event",
      "description": "Repeat customer (renewal of vows / party anniversary)",
      "icon": "Copy",
      "comingSoon": true
    },
    "merge_couples": {
      "category": "couple",
      "label": "Merge couples",
      "description": "Combine duplicate couple records",
      "icon": "GitMerge",
      "comingSoon": true
    },
    "archive_couple": {
      "category": "couple",
      "label": "Archive couple",
      "description": "GDPR / Australian-Privacy retention close-out",
      "icon": "Archive",
      "comingSoon": true
    },
    "export_couple_data": {
      "category": "couple",
      "label": "Export couple data",
      "description": "Privacy / handover — email a data export",
      "icon": "Download",
      "comingSoon": true
    },
    "start_drip_campaign": {
      "category": "flow",
      "label": "Start drip campaign",
      "description": "Enrol this couple into a multi-touch nurture",
      "icon": "Send",
      "comingSoon": true
    },
    "pause_drip_campaign": {
      "category": "flow",
      "label": "Pause drip campaign",
      "description": "Halt a running drip for this couple",
      "icon": "Pause",
      "comingSoon": true
    },
    "resume_drip_campaign": {
      "category": "flow",
      "label": "Resume drip campaign",
      "description": "Continue a paused drip",
      "icon": "Play",
      "comingSoon": true
    },
    "pause_sequence": {
      "category": "flow",
      "label": "Pause sequence",
      "description": "Per-sequence pause (finer than couple-wide)",
      "icon": "PauseCircle",
      "comingSoon": true
    },
    "resume_sequence": {
      "category": "flow",
      "label": "Resume sequence",
      "description": "Continue a paused sequence",
      "icon": "PlayCircle",
      "comingSoon": true
    },
    "goto_step": {
      "category": "flow",
      "label": "Go to step",
      "description": "Jump to another step in this automation (advanced)",
      "icon": "CornerUpLeft",
      "comingSoon": true
    },
    "send_to_slack": {
      "category": "integration",
      "label": "Send to Slack",
      "description": "Post a message into a Slack channel",
      "icon": "MessageSquare",
      "comingSoon": true
    },
    "send_to_webhook": {
      "category": "integration",
      "label": "Send to webhook",
      "description": "POST a JSON payload to any URL",
      "icon": "Webhook",
      "comingSoon": true
    },
    "add_to_zapier": {
      "category": "integration",
      "label": "Send to Zapier",
      "description": "Fire a Zapier trigger from this step",
      "icon": "Zap",
      "comingSoon": true
    },
    "notify_couple_via_push": {
      "category": "general",
      "label": "Notify couple (push)",
      "description": "PWA push notification to the couple's portal app",
      "icon": "Bell",
      "comingSoon": true
    }
}

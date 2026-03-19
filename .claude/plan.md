# Zebri — 6-Month Product Plan

**Created:** March 19, 2026
**Target audience:** Wedding MCs and Celebrants
**North star:** Replace every spreadsheet, WhatsApp thread, and Google Doc an MC uses — in one calm, focused tool.

---

## Current State (What's Built)

- Authentication (email/password, Supabase Auth)
- Couples management (list, kanban, calendar views)
- Couple profiles (overview, events, vendors, tasks tabs)
- Vendors management (list view, categories, profiles)
- Events (tied to couples, with vendor + task assignment)
- Tasks (inline creation, tied to couples/events)
- Dashboard (upcoming weddings, recent couples, quick stats)
- Settings (personal info, password, billing placeholder)
- Stripe subscription scaffolding (trial, checkout, portal — not fully wired)

---

## Month 1 — Foundation & Polish (April 2026)

**Theme:** Finish what's started. Make the existing CRM rock-solid before adding new features.

### Week 1–2: Payments & Onboarding

- **Stripe webhooks (complete implementation)**
  - API route for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
  - Sync subscription status to `user_metadata` reliably
  - Handle trial expiry → paywall flow
  - Test with Stripe CLI locally
- **Pricing page / upgrade flow**
  - In-app upgrade prompt when trial expires
  - Settings → Plans & Billing fully functional (current plan, next billing date, cancel/resume)
- **Onboarding flow**
  - First-login welcome screen: name, business name, phone
  - Guided "add your first couple" prompt after setup
  - Empty states across all pages with clear CTAs

### Week 3: UI Component Library

- Extract and standardise reusable components (many are currently inline):
  - `Button` (primary, secondary, ghost, danger variants)
  - `Input` / `Textarea` with consistent styling
  - `Select` / `Combobox` (dropdown with search)
  - `Tabs` component
  - `Tooltip`
  - `ConfirmDialog` (for destructive actions)
- Audit all pages to use shared components consistently

### Week 4: Mobile Responsiveness & Command Palette

- **Mobile layout**
  - Collapsible sidebar (hamburger menu on mobile)
  - Responsive tables → card layout on small screens
  - Touch-friendly interactions (tap instead of hover)
  - Bottom navigation bar on mobile as alternative to sidebar
- **Command palette (Cmd+K)**
  - Search across couples, vendors, events
  - Quick actions: add couple, add vendor, go to settings
  - Keyboard-first navigation
  - Recent searches

---

## Month 2 — Timelines (May 2026)

**Theme:** The killer feature. No CRM does this well for MCs. This is what makes Zebri indispensable.

### Timeline Builder

- **New data model**
  - `timelines` table: `id`, `user_id`, `event_id`, `title`, `created_at`, `updated_at`
  - `timeline_items` table: `id`, `timeline_id`, `time`, `end_time`, `title`, `description`, `category`, `sort_order`, `created_at`
  - Categories: `ceremony`, `reception`, `speech`, `dance`, `meal`, `entertainment`, `transition`, `custom`
- **Builder UI**
  - Accessed from Event profile → new "Timeline" tab
  - Vertical timeline layout with time markers
  - Drag-and-drop reordering (using existing dnd library)
  - Inline editing — click any item to edit time/title/description
  - Quick-add: type a time and title, hit Enter
  - Duration display between items (e.g., "15 min gap")
  - Category color coding on left border
  - Bulk time shift — select multiple items and shift forward/back by X minutes
- **Timeline templates**
  - `timeline_templates` table: `id`, `user_id`, `title`, `description`, `is_default`, `created_at`
  - `template_items` table: mirrors `timeline_items` but linked to template
  - Pre-built defaults:
    - "Classic Reception" (entries, first dance, speeches, cake, bouquet, last dance)
    - "Ceremony + Reception" (full day)
    - "Indian Wedding" (multi-event: sangeet, ceremony, reception)
    - "Cultural Ceremony" (flexible structure for non-western weddings)
  - Users can save any timeline as a template
  - Apply template to new event → copies items with editable times
- **Export & sharing**
  - PDF export with clean formatting (couple names, date, venue as header)
  - Shareable read-only link (no login required) for vendors/couples
  - `timeline_shares` table: `id`, `timeline_id`, `share_token`, `expires_at`, `created_at`
  - Shared view: clean, print-friendly layout with Zebri branding
  - Works offline once loaded (service worker cache for remote venues)

---

## Month 3 — Couple Portal & Forms (June 2026)

**Theme:** Stop chasing couples for information. Send one link, get everything back.

### Couple Portal

- **Portal access**
  - Each couple gets a unique portal link (no login required, token-based)
  - `couple_portals` table: `id`, `couple_id`, `access_token`, `is_active`, `created_at`
  - MC sends link via email or copies to clipboard
  - Portal is a clean, minimal public page (Zebri-branded but MC's business name shown)
- **Information collection forms**
  - `portal_forms` table: `id`, `user_id`, `title`, `description`, `form_schema` (JSONB), `created_at`
  - `portal_submissions` table: `id`, `form_id`, `couple_id`, `data` (JSONB), `submitted_at`
  - Pre-built form templates tailored for MCs:
    - **Wedding Details Form**: date, venue, guest count, ceremony type, cultural considerations
    - **Couple Story Form**: how they met, proposal story, fun facts (for MC script material)
    - **Bridal Party Form**: names, roles, pronunciation guides, relationships
    - **Song Choices Form**: first dance, father-daughter, bridal entry, cake cutting, must-play, do-not-play
    - **Cultural Notes Form**: traditions to include, family customs, religious elements, language preferences
    - **Pronunciation Guide Form**: names of couple, bridal party, family members with phonetic guides
  - Form builder for custom forms (drag-and-drop fields: text, textarea, select, multi-select, date, file upload)
- **Portal pages**
  - Couple sees: submitted forms, timeline (read-only), key details
  - MC sees: submission notifications, form responses synced into couple profile
  - Song choices auto-categorised and stored on event
- **Notifications**
  - In-app notification when couple submits a form
  - Optional email notification to MC

### Form Activity on Dashboard

- "Recent Form Activity" module on dashboard (inspired by Dubsado)
- Shows recent submissions with couple name, form title, timestamp
- Click to jump to couple profile → relevant data

---

## Month 4 — Scripts & Event Mode (July 2026)

**Theme:** The MC's performance tools. Move from planning to execution.

### Script Organiser

- **Data model**
  - `scripts` table: `id`, `user_id`, `event_id`, `title`, `created_at`, `updated_at`
  - `script_sections` table: `id`, `script_id`, `title`, `content` (rich text), `section_type`, `sort_order`, `timeline_item_id` (optional link to timeline), `created_at`
  - Section types: `opening`, `introduction`, `transition`, `speech_intro`, `activity`, `announcement`, `closing`, `custom`
- **Editor UI**
  - Accessed from Event profile → new "Script" tab
  - Collapsible sections (accordion-style)
  - Rich text editing within sections (bold, italic, highlight for emphasis cues)
  - Drag-and-drop section reordering
  - Link sections to timeline items (shows time cue next to section)
  - Pronunciation highlights — mark words with phonetic guide tooltip
  - "Notes to self" — private annotations that don't appear in exports
- **Script templates**
  - Save any script as reusable template
  - Pre-built templates:
    - "Classic MC Script" (welcome, introductions, speeches, activities, farewell)
    - "Ceremony Script" (for celebrants: welcome, readings, vows, ring exchange, declaration)
    - "Bilingual Ceremony" (sections with language toggle)
  - Apply template → edit for specific couple
- **AI script assistance (future-ready placeholder)**
  - Design the UI with an "AI Assist" button on each section
  - Initially disabled with "Coming soon" tooltip
  - When enabled: generate opening lines from couple's story form, suggest transitions, draft speech introductions
  - This is scaffolding only — no AI integration in Month 4

### Event Mode

- **Dedicated live performance view**
  - Accessed via "Go Live" button on event profile
  - Full-screen, distraction-free interface
  - Large text, high contrast (dark mode default)
  - Shows: current timeline item (highlighted), next item (preview), script content for current section
- **Navigation**
  - Swipe or arrow keys to advance
  - Current time display
  - "Running late" / "ahead of schedule" indicator vs planned timeline
  - Quick jump — tap any timeline item to skip to it
- **Offline support**
  - Service worker caches event data, timeline, and script on "Go Live"
  - Works without internet (critical for remote venues)
  - Syncs any notes/changes when back online
- **PDF export of script + timeline combined**
  - For MCs who prefer paper backup
  - Clean, large-font print layout

---

## Month 5 — Workflows, Invoicing & Dashboard 2.0 (August 2026)

**Theme:** Automate the admin. Inspired by Dubsado but simplified for solopreneurs.

### Simple Workflows

- **Not Dubsado-level automation** — simplified, opinionated flows for MCs
  - `workflows` table: `id`, `user_id`, `title`, `trigger_type`, `is_active`, `created_at`
  - `workflow_steps` table: `id`, `workflow_id`, `step_type`, `config` (JSONB), `delay_days`, `sort_order`
  - Trigger types: `new_enquiry`, `status_change`, `days_before_event`, `days_after_event`, `form_submitted`
  - Step types: `send_email`, `create_task`, `change_status`, `send_form`
- **Pre-built workflow templates**
  - "New Enquiry Flow": auto-create task "Follow up within 24h", send welcome email with portal link
  - "Booking Confirmed": send details form, create task "Schedule planning call", change status to Confirmed
  - "2 Weeks Before Wedding": send final details form, create task "Confirm timeline with couple"
  - "Day After Wedding": send thank-you email, create task "Request testimonial", change status to Complete
  - "Follow-up Flow": 3 days after enquiry if no response → reminder task
- **Workflow editor**
  - Visual step-by-step builder (vertical flow, not complex flowchart)
  - Each step is a card: icon + type + config
  - Add/remove/reorder steps
  - Toggle workflows on/off
  - Activity log showing workflow executions

### Basic Invoicing

- **Keep it simple** — MCs typically send 1-2 invoices per wedding (deposit + balance)
  - `invoices` table: `id`, `user_id`, `couple_id`, `event_id`, `invoice_number`, `items` (JSONB), `subtotal`, `tax_rate`, `tax_amount`, `total`, `status`, `due_date`, `paid_date`, `notes`, `created_at`
  - Invoice statuses: `draft`, `sent`, `viewed`, `paid`, `overdue`, `cancelled`
  - `packages` table: `id`, `user_id`, `name`, `description`, `price`, `items` (JSONB), `is_active`, `created_at`
- **Invoice UI**
  - Create invoice from couple/event profile
  - Line items with description + amount
  - Apply a saved package (auto-fills line items)
  - PDF generation with MC's business branding
  - Send invoice via email or shareable link
  - Mark as paid manually (no payment gateway for couples in MVP)
  - Payment status visible on couple profile and dashboard
- **Packages** (from Settings)
  - Define reusable service packages (e.g., "MC Package — $1,500", "MC + DJ Package — $2,500")
  - Each package has line items
  - Apply package when creating invoice → auto-fills
- **Invoice section on Dashboard**
  - Summary: total outstanding, overdue, received this month
  - Recent invoice activity

### Dashboard 2.0

- **Modular dashboard** (inspired by Dubsado's display settings)
  - Configurable modules — user can show/hide and reorder:
    - Tasks waiting on you (overdue + due today)
    - Upcoming weddings (next 30 days)
    - Recent couples
    - Recent form submissions
    - Invoice summary (outstanding, overdue, received)
    - Quick stats (total couples, conversion rate, weddings this month)
  - Dashboard settings: toggle modules on/off, drag to reorder
- **Activity feed**
  - `activity_log` table: `id`, `user_id`, `activity_type`, `entity_type`, `entity_id`, `metadata` (JSONB), `created_at`
  - Recent activity: form submitted, status changed, invoice paid, task completed
  - Compact timeline view on dashboard

---

## Month 6 — Multi-Role Support, Polish & Launch (September 2026)

**Theme:** Expand beyond MCs. Harden for real users. Prepare for launch.

### Celebrant Mode

- **User role selection** during onboarding: "I'm a Wedding MC" / "I'm a Celebrant" / "I do both"
  - Stored in `user_metadata.role`: `mc`, `celebrant`, `both`
- **Role-based UI adjustments**
  - **Celebrant-specific**:
    - Default script templates switch to ceremony scripts (vows, readings, declarations)
    - Form templates include: "Vow Preferences", "Ceremony Style", "Legal Requirements"
    - Timeline defaults to ceremony structure
    - Status pipeline labels: Enquiry → Consultation → Booked → Ceremony → Lodged → Complete
    - "Lodge paperwork" task auto-created after ceremony
  - **MC-specific** (current default):
    - Reception-focused timelines and scripts
    - Status pipeline: New → Contacted → Confirmed → Paid → Complete
  - **Both**:
    - Can toggle between MC view and Celebrant view per event
    - Event type field: `ceremony`, `reception`, `both`
- **Minimal changes** — same core product, different defaults and labels. Not a separate app.

### Corporate Mode (Light)

- Based on Nathan's feedback: MCs also do corporate events
- **Event type selector**: Wedding / Corporate / Other
  - Corporate events use simplified forms (no bridal party, no couple story)
  - Timeline templates for corporate: "Conference MC", "Awards Night", "Gala Dinner"
  - Scripts adjusted: no couple-specific sections
- **Not a major feature** — just ensures the tool doesn't feel wedding-only when an MC books a corporate gig

### Collaboration & Sharing

- **Vendor timeline sharing** (Nathan's top request)
  - Share timeline with specific vendors per wedding
  - Vendors see read-only timeline filtered to items relevant to them
  - Category-based filtering: photographer sees photo moments, DJ sees music cues
  - No vendor login required — token-based access
- **Export improvements**
  - Timeline PDF with vendor-specific views
  - Full wedding run sheet PDF (timeline + vendor contacts + notes)
  - Script PDF with large-font print option

### Polish & Hardening

- **Performance audit**
  - Lighthouse scores > 90 on all pages
  - Optimise Supabase queries (indexes, query plans)
  - Lazy load heavy components (timeline builder, script editor)
- **Error handling & edge cases**
  - Global error boundary with friendly error states
  - Offline detection banner
  - Form validation improvements
  - Undo support for destructive actions (delete couple, remove vendor)
- **Email system**
  - Transactional emails via Resend or similar
  - Templates: welcome, form submission notification, invoice sent, invoice reminder
  - MC's business name in sender field
- **Testing**
  - E2E tests for critical flows (auth, add couple, create timeline, go live)
  - Integration tests for Stripe webhooks
  - Component tests for form validation
- **Launch prep**
  - Marketing site (separate repo, but plan content)
  - Help docs / knowledge base (in-app links)
  - Feedback widget (simple "Send feedback" in sidebar)
  - Analytics (PostHog or similar — basic usage tracking, not user-facing analytics)

---

## Feature Priority Matrix

Based on Nathan's ranking and Dubsado analysis:

| Priority | Feature | Why |
|----------|---------|-----|
| 1 | CRM polish + payments | Foundation must be solid before adding features |
| 2 | Timeline builder + sharing | #1 differentiator — no competitor does this for MCs |
| 3 | Couple portal + forms | Eliminates the biggest time sink (chasing info) |
| 4 | Scripts + Event Mode | Performance tools — makes Zebri indispensable day-of |
| 5 | Workflows | Automation saves weekly admin hours |
| 6 | Invoicing | Nice to have but many MCs use Xero/QuickBooks already |
| 7 | Celebrant/corporate mode | Market expansion with minimal engineering effort |

---

## What We're NOT Building (6-Month Scope)

Deliberately excluded to stay focused:

- **DJ features / Spotify integration** — Nathan confirmed this is low priority
- **Marketplace** — not in scope, maybe future
- **In-app messaging / email client** — use email templates + links instead
- **Advanced analytics / reporting** — simple dashboard stats are enough
- **Team/multi-user accounts** — MCs are solopreneurs, not agencies
- **Calendar sync (Google/Apple)** — would be nice but not critical for launch
- **Payment gateway for couples** — MCs handle payments via bank transfer or existing tools
- **White-labeling** — not needed for launch

---

## Key Dates

| Date | Milestone |
|------|-----------|
| April 18, 2026 | Nathan's 5th anniversary — demo timeline feature to him (even if rough) |
| End of April | Month 1 complete — CRM solid, payments working, mobile-ready |
| End of May | Timeline builder shipped — shareable timelines working |
| End of June | Couple portal live — forms collecting data |
| End of July | Scripts + Event Mode — full wedding-day toolkit |
| End of August | Workflows + invoicing — admin automation |
| End of September | Celebrant mode + launch prep — ready for real users |

---

## Revenue Model

- **Free trial**: 14 days
- **Zebri Pro**: $29/month or $290/year (save 2 months)
- **Future consideration**: Zebri Pro+ with AI script generation, advanced workflows ($49/month)
- **Target**: 10k+ celebrants in Australia alone (Nathan's data) + MC market

---

## Success Metrics (Post-Launch)

- MCs who create a timeline within first session (activation)
- Couples who submit at least one form via portal (value delivered)
- MCs who use Event Mode at a real wedding (retention signal)
- Trial → paid conversion rate
- Monthly churn rate

---

## Architecture Notes for Implementation

- **Keep server components as default** — only use client components when interactivity is needed
- **React Query for all data** — consistent cache invalidation patterns
- **Supabase RLS on every new table** — no exceptions
- **JSONB for flexible schemas** — form definitions, invoice line items, workflow configs
- **Service workers for offline** — critical for Event Mode at remote venues
- **PDF generation** — use `@react-pdf/renderer` or server-side Puppeteer
- **Email** — Resend for transactional, react-email for templates
- **Rich text** — Tiptap for script editor (lightweight, extensible)

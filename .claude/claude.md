# Zebri --- Claude Development Guide

Zebri is a **minimal CRM for Wedding MCs**.

The goal is to build the **simplest command centre possible** for MCs to
manage enquiries, bookings, and weddings.

---

# Document Maintenance

The files inside the .claude directory are the source of truth for Zebri's product, design, and architecture.

Whenever implementing new functionality or modifying existing behaviour, Claude must check whether any documentation needs to be updated.

If changes affect any of the following areas, the relevant documentation files must also be updated:

Product behaviour:
.claude/page-specs.md
.claude/product-principles.md

Design system
.claude/frontend-design.md
.claude/component-library.md

Database structure:
.claude/database-schema.md

Authentication:
.claude/authentication.md

Payments:
.claude/payments.md

---

# Always Load These Files

Before generating ANY code, always load:

.claude/frontend-design.md .claude/component-library.md
.claude/database-schema.md .claude/product-principles.md
.claude/page-specs.md .claude/authentication.md
.claude/payments.md

These files define:

• UI design system • allowed components • database structure • product
philosophy • page requirements • authentication • payments

All generated code must follow them.

---

# Product Summary

Zebri replaces spreadsheets, WhatsApp messages, and notes used by
wedding MCs.

Typical workflow:

Couple → Enquiry → Quote → Booked → Wedding → Follow‑up

The CRM should feel:

• minimal\
• fast\
• calm\
• modern

Avoid enterprise‑style complexity.

---

# MVP Scope

Build ONLY the CRM.

Do NOT build:

• analytics • automation • AI • messaging • marketplace

Focus on:

• Authentication • Payments/Subscriptions • Couples (with events) • Vendors • Tasks

---

# Layout

App layout:

Sidebar (240px)

Navigation:

Dashboard Couples Vendors

Main content area on the right.

---

# UX Rules

Follow these principles:

Fast interactions No page reloads

Minimal forms

Keyboard friendly

Command palette

Shortcut:

Cmd + K

---

# Tech Stack

Frontend

Next.js (App Router) React Tailwind

Backend

Supabase Postgres

Libraries

tanstack-table react-query lucide-react dnd-kit

---

# Brand Assets

Brand assets are stored in:

.claude/brand_assets/

Contents:

- zebri-logo.svg — the official Zebri wordmark logo (black on white, SVG)
- zebri-icon.svg — the square Zebri icon (used in collapsed sidebar, favicons, etc.)

Copy logos to public/ when using them in the app. Always use the official assets — do not recreate or approximate them.

---

# Component Rules

Only use components defined in:

.claude/component-library.md

Do NOT invent new components unless necessary.

---

# Component Architecture

Follow React/Next.js best practices for component structure:

- **Split pages into section components.** Each logical section of a page (e.g. a form card, a settings panel) should be its own component file, co-located with the page.
- **Co-locate section components** next to their page file (e.g. `app/account/profile-section.tsx` alongside `app/account/page.tsx`).
- **Page files are orchestrators.** They load data, manage top-level state, and compose section components. They should not contain form logic or complex UI.
- **Each section component owns its own state and handlers.** Pass initial data via props. Keep side effects (API calls, mutations) inside the component that triggers them.
- **Shared UI components** (Button, Input, Card, Badge, etc.) live in `components/ui/` and are used across section components.
- **Keep components small and focused.** If a component exceeds ~150 lines, it likely needs to be split further.

---

# Typography

All body text, labels, inputs, and buttons must use `text-sm` (14px) unless they are headings.

- Page titles: `text-3xl font-semibold`
- Section titles: `text-xl font-semibold`
- Everything else: `text-sm` (14px)

---

# Database Rules

Follow the schema defined in:

.claude/database-schema.md

Do NOT change column names unless explicitly required.

---

# Performance

Prefer:

• server components • simple React patterns • minimal dependencies

Avoid heavy UI frameworks.

---

# Product Tone

Zebri should feel:

Professional\
Simple\
Friendly\
Confident

Avoid:

Corporate UI\
Enterprise dashboards\
Over‑designed interfaces

---

# Summary

Zebri is:

A **simple CRM command centre for wedding MCs.**

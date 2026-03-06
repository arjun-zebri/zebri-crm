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

---

# Always Load These Files

Before generating ANY code, always load:

.claude/frontend-design.md .claude/component-library.md
.claude/database-schema.md .claude/product-principles.md
.claude/page-specs.md

These files define:

• UI design system • allowed components • database structure • product
philosophy • page requirements

All generated code must follow them.

---

# Product Summary

Zebri replaces spreadsheets, WhatsApp messages, and notes used by
wedding MCs.

Typical workflow:

Lead → Enquiry → Quote → Booked → Wedding → Follow‑up

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

• payments • analytics • automation • AI • messaging • marketplace

Focus on:

• Leads • Couples • Events • Tasks

---

# Layout

App layout:

Sidebar (240px)

Navigation:

Dashboard Leads Couples Events Tasks

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

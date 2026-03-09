# Zebri Component Library

This file defines the **core reusable UI components** for Zebri.

Claude should always prefer these components instead of creating new UI
patterns.

Goal: Consistency, speed, and minimal design.

---

# Core Components

## Button

Primary CTA button.

Styles: - bg-black - text-white - rounded-lg - px-4 py-2 -
hover:bg-neutral-800 - transition

Variants: - primary - secondary - ghost

Props: variant size icon loading disabled

---

## Input

Standard text input.

Styles: border\
rounded-lg\
px-3 py-2\
focus:ring-2\
focus:ring-green-200

Props: label placeholder value onChange error

---

## Select (Custom)

A fully custom dropdown select component used across Zebri instead of the native HTML <select>.

This component should provide a modern SaaS-style searchable dropdown that matches the rest of the UI system.

Native <select> elements should not be used anywhere in Zebri.

The Select component should be built using a combobox pattern.

Recommended libraries:

@radix-ui/react-popover - cmdk - lucide-react

Structure:

Button Trigger
Popover
Search Input
Options List

The Select trigger should visually match the Input component.

Trigger styles:

border - rounded-lg - px-3 - py-2 - bg-white - flex - items-center - justify-between - text-sm

Focus state:

ring-2 - ring-green-200

Dropdown menu styles:

bg-white - border - rounded-lg - shadow-lg - max-h-60 - overflow-y-auto p-1

Option styles:

px-3 - py-2 - rounded-md - cursor-pointer - hover:bg-gray-50

Selected option:

bg-green-50 - text-green-700

---

## Card

Used for dashboard modules and containers.

Styles: bg-white\
border\
rounded-xl\
shadow-sm\
p-6

Props: title description actions

---

## Table

Used for lists such as Couples, Vendors, Events.

Built using: tanstack-table

Features: sorting\
pagination\
search

Style: Notion-style clean table. No card wrapper (no border/rounded-xl container). White header with bottom border, sentence-case text. No clickable sort on table headers (sorting via header toolbar dropdown). Plain text pagination (Previous/Next). Rows: hover:bg-gray-50.

---

## Badge

Status indicator with colored dot prefix. Uses `rounded-full`, `px-2 py-0.5`, `text-xs font-medium`.

Variants:

- `new`: amber-50 bg, amber-700 text, amber-400 dot
- `contacted`: blue-50 bg, blue-700 text, blue-400 dot
- `confirmed`: purple-50 bg, purple-700 text, purple-400 dot
- `paid`: emerald-50 bg, emerald-700 text, emerald-400 dot
- `complete`: gray-100 bg, gray-600 text, gray-400 dot
- `default`: gray-50 bg, gray-600 text, gray-400 dot

---

## Modal

Centered modal dialog. `rounded-2xl shadow-xl max-w-lg max-h-[85vh]`, centered with `flex items-center justify-center`. Footer has `rounded-b-2xl bg-gray-50`.

Used for: - create couple - create task - edit vendor

Features: overlay background escape to close click outside to close

---

## Sidebar

Main navigation.

Contains: Dashboard Couples Vendors Events Tasks

Width: 240px

Style: minimal light dividers active state indicator

---

## Command Palette

Keyboard shortcut: Cmd + K

Functions: - create couple - create task - search vendors - navigate pages

Style inspired by: Linear / Vercel

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

Used for lists such as Leads, Couples, Events.

Built using: tanstack-table

Features: sorting\
pagination\
search

Style: clean SaaS style rows hover:bg-gray-50

---

## Badge

Status indicator.

Examples:

Lead: bg-yellow-100 text-yellow-700

Booked: bg-green-100 text-green-700

Completed: bg-neutral-200 text-neutral-700

---

## Modal

Reusable modal dialog.

Used for: - create lead - create task - edit couple

Features: overlay background escape to close click outside to close

---

## Sidebar

Main navigation.

Contains: Dashboard Leads Couples Events Tasks

Width: 240px

Style: minimal light dividers active state indicator

---

## Command Palette

Keyboard shortcut: Cmd + K

Functions: - create lead - create task - search couples - navigate pages

Style inspired by: Linear / Vercel

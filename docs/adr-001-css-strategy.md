# ADR-001: CSS Strategy

**Status:** Accepted
**Date:** 2026-03-29

## Context

The frontend currently has no styling — bare HTML elements only. We need to choose a CSS approach before building out the UI. The app is a small, self-hosted React SPA (mobile-first, accessible) with straightforward UI needs: forms, lists, buttons, tables, modals, and a credit allocation slider/input.

## Options Considered

### 1. Plain CSS (CSS Modules or vanilla)

**Pros:**
- Zero dependencies, zero build config
- Full control, no abstractions to learn or fight
- Smallest possible bundle
- No coupling to any framework's release cycle

**Cons:**
- Everything from scratch: responsive layout, form styles, button states, focus rings, dark mode
- Maintaining visual consistency is manual work — no design tokens or component primitives out of the box
- Accessibility details (focus indicators, contrast, reduced motion) require discipline
- Slower to reach a polished result

### 2. Tailwind CSS (v4)

**Pros:**
- Utility-first — fast iteration, co-located styles, no naming decisions
- Built-in responsive, dark mode, focus/hover variants
- Enforces a consistent design scale (spacing, colors, typography)
- Tiny production bundle (only ships used utilities)
- v4 works as a Vite plugin — no PostCSS config needed

**Cons:**
- Verbose class strings in JSX
- Still need to build every component yourself (buttons, inputs, cards, etc.)
- Learning curve for utility class names

### 3. Tailwind + shadcn/ui

**Pros:**
- Everything from Tailwind, plus a library of accessible, composable components (Button, Input, Dialog, Table, Card, etc.) that map directly to our UI needs
- Components are copied into the project (not a node_module) — fully ownable, no version lock-in
- Built on Radix UI primitives — solid keyboard nav, ARIA, focus management out of the box
- Gets to a polished, accessible UI fastest
- Widely adopted — AI tools and docs understand it well

**Cons:**
- Largest initial setup surface (Tailwind + shadcn init + component files)
- Pulls in Radix UI runtime packages as dependencies
- More files in the repo (one per component under `components/ui/`)
- Could be seen as heavy for a small app

### 4. CSS framework (e.g., Pico CSS, Open Props, Bulma)

**Pros:**
- Drop-in stylesheet, near-zero config
- Reasonable defaults for semantic HTML

**Cons:**
- Limited customization without overriding
- Aesthetic may not fit; fighting the framework costs time
- Smaller communities, less tooling support
- No component logic (modals, focus traps, etc.)

## Decision

**Tailwind CSS v4** — without shadcn/ui.

### Rationale

- **Plain CSS** is viable but slow for a project that values getting to a polished, accessible, mobile-first UI quickly. We'd end up re-inventing what Tailwind gives for free (responsive breakpoints, consistent spacing scale, state variants).
- **shadcn/ui** is appealing but heavier than warranted. Our component surface is small (a handful of pages, simple forms and lists). The Radix dependencies and generated component files add weight we don't need yet. If we later find ourselves building complex components (comboboxes, accessible dialogs with focus traps), we can adopt individual shadcn components incrementally — they're designed for that.
- **CSS frameworks** like Pico are too opinionated and not flexible enough for custom UI work.
- **Tailwind alone** hits the sweet spot: enforced design consistency, built-in responsive/dark-mode/a11y utilities, near-zero config with v4's Vite plugin, and minimal dependencies. The component count is small enough that hand-building with utility classes is fast and keeps the codebase simple.

### Migration path

If component complexity grows (e.g., adding PIN entry modals, keyboard-shortcut discoverable menus), adopt shadcn/ui components one at a time. Tailwind is the prerequisite for shadcn, so this path is always open with no rework.
